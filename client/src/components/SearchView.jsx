import React, { useEffect, useState } from 'react';
import { TrackRow } from './SharedUI';
import SourcePicker from './SourcePicker';
import VirtualList from './VirtualList';
import { useMusic } from '../context/hook';
import { useSources } from '../hooks/useSources';
import { useSearch } from '../hooks/useLibrary';
import { describeSourceError } from '../utils/services';
import { likeTrack, unlikeTrack } from '../utils/library';

// Search through the generic /api/search/:source route. The source switch is
// the shared SourcePicker, limited to sources that can search. No service is
// named in this file.
const TYPING_PAUSE_MS = 350;
const MIN_LIVE_CHARS = 2;

export default function SearchView() {
    const { playTrack, addToQueue } = useMusic();
    const { sources, loading: sourcesLoading } = useSources();

    const [chosenSource, setChosenSource] = useState(null);
    const [input, setInput] = useState('');

    // Searching needs the user's own connection only for sources that say so
    // (the server's searchRequiresConnection); others search public content.
    const searchNeedsConnection = (s) => s.searchRequiresConnection !== false && Boolean(s.connect && s.connect.required);
    const canSearchNow = (s) => s.connected || !searchNeedsConnection(s);

    // Default to the first searchable source that can be searched right now,
    // else the first searchable one at all, until the user picks another.
    const searchable = sources.filter(s => s.capabilities && s.capabilities.search);
    const activeSource = chosenSource && searchable.some(s => s.name === chosenSource)
        ? chosenSource
        : ((searchable.find(canSearchNow) || searchable[0] || {}).name || null);
    const service = searchable.find(s => s.name === activeSource) || null;

    const search = useSearch(activeSource);

    // The query stays when the source changes, so the same words are looked
    // up there (one request, as before when the user pressed Enter again).
    const switchSource = (name) => {
        if (name === activeSource) return;
        setChosenSource(name);
        if (!input.trim()) search.clear();
    };

    // Search as the user types: once they pause for a moment, the words are
    // sent (one request per pause, the same search request as before). Enter
    // sends at once. Clearing the field clears the results.
    const { run: runSearch, clear: clearSearch } = search;
    useEffect(() => {
        const words = input.trim();
        if (!words) { clearSearch(); return undefined; }
        if (words.length < MIN_LIVE_CHARS) return undefined;
        const timer = setTimeout(() => runSearch(words), TYPING_PAUSE_MS);
        return () => clearTimeout(timer);
    }, [input, runSearch, clearSearch]);

    const handleSubmit = (e) => {
        e.preventDefault();
        if (input.trim()) search.run(input);
    };

    // The chip tooltips: how many results the active source gave.
    const resultTip = (s, selected) => {
        if (!selected || !search.query || !search.loaded) return `Search ${s.label}`;
        const n = search.items.length;
        return `${n}${search.hasMore ? '+' : ''} ${n === 1 ? 'result' : 'results'} on ${s.label}`;
    };

    const canLike = Boolean(service && service.capabilities && service.capabilities.like && service.connected);
    const onLike = canLike ? (track) => likeTrack(track.source, track.id) : undefined;
    const onUnlike = canLike ? (track) => unlikeTrack(track.source, track.id) : undefined;

    const error = search.error ? describeSourceError(search.error, service) : null;
    const connect = service && service.connectAction;

    return (
        <div>
            <form onSubmit={handleSubmit} role="search" className="search-form">
                <input
                    type="search"
                    className="search-input"
                    placeholder="Songs or artists"
                    aria-label={service ? `Search ${service.label}` : 'Search'}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                />
                {!sourcesLoading && (
                    <SourcePicker
                        sources={searchable}
                        value={activeSource}
                        onChange={switchSource}
                        requiresConnection={searchNeedsConnection}
                        tipFor={resultTip}
                        ariaLabel="Search source"
                    />
                )}
            </form>

            {error && (
                <div className="error-panel" style={{ marginBottom: '20px' }}>
                    <p style={{ marginTop: 0 }}>{error.message}</p>
                    {error.canConnect && connect && (
                        <button
                            type="button"
                            className="fill-pill pressable"
                            onClick={() => connect(error.scope ? { scope: error.scope } : undefined)}
                            style={{ '--pill-fill': service.fill, '--pill-on-fill': service.onFill }}
                        >
                            {error.connectLabel || service.connectLabel}
                        </button>
                    )}
                </div>
            )}

            {search.items.length > 0 && (
                <h2 className="list-heading">Search Results</h2>
            )}
            <div className="track-list">
                <VirtualList
                    items={search.items}
                    rowHeight={78}
                    renderRow={(track) => (
                        <TrackRow key={`search-${track.source}-${track.id}`} track={track} onPlay={playTrack} onQueue={addToQueue} onLike={onLike} onUnlike={onUnlike} canAddToPlaylist imageSize={60} />
                    )}
                />
            </div>

            {search.loading && <p className="list-message">Searching…</p>}
            {!search.loading && search.loaded && !search.error && search.items.length === 0 && search.query && (
                <p className="list-message">No results for “{search.query}”. Try another source or check the spelling.</p>
            )}

            {search.hasMore && !search.loading && (
                <button type="button" className="btn-neutral load-more pressable" onClick={search.loadMore}>
                    Load more
                </button>
            )}

            {service && service.attribution && search.items.length > 0 && (
                <p className="attribution-note">
                    Results and audio provided by <a href={service.attribution.url} target="_blank" rel="noreferrer" style={{ color: service.text }}>{service.attribution.text}</a>.
                </p>
            )}
        </div>
    );
}
