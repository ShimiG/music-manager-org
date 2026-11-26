import React, { useEffect, useRef, useState } from 'react';
import { PlaylistCard, TrackRow } from './SharedUI';
import SourcePicker from './SourcePicker';
import VirtualList from './VirtualList';
import LocalFoldersPanel from './LocalFoldersPanel';
import { useMusic } from '../context/hook';
import { useSources } from '../hooks/useSources';
import { useLibrary, usePlaylistTracks } from '../hooks/useLibrary';
import { describeSourceError } from '../utils/services';
import { likeTrack, unlikeTrack, createCustomPlaylist } from '../utils/library';
import { toast } from '../utils/toast';


// One error panel for every source: "Connect <label>" / "Reconnect <label>"
// for whichever source is active, a retry for anything else.
function renderError(err, service, retry) {
    if (!err) return null;
    const info = describeSourceError(err, service);
    const connect = service && service.connectAction;
    return (
        <div className="error-panel">
            <h3 style={{ marginTop: 0 }}>{info.canConnect ? 'Connection needed' : 'Something went wrong'}</h3>
            <p>{info.message}</p>
            {info.canConnect && connect && (
                <button type="button" className="fill-pill pressable" onClick={() => connect(info.scope ? { scope: info.scope } : undefined)} style={{ '--pill-fill': service.fill, '--pill-on-fill': service.onFill }}>
                    {info.connectLabel || service.connectLabel}
                </button>
            )}
            {!info.canConnect && retry && (
                <button type="button" className="btn-neutral pressable" onClick={retry}>Try again</button>
            )}
        </div>
    );
}

function renderLoadMore(list) {
    if (!list.hasMore) return null;
    return (
        <button type="button" className="btn-neutral load-more pressable" onClick={list.loadMore} disabled={list.loading}>
            {list.loading ? 'Loading…' : 'Load more'}
        </button>
    );
}

function renderAttribution(service, what) {
    if (!service || !service.attribution) return null;
    return (
        <p className="attribution-note">
            {what} provided by <a href={service.attribution.url} target="_blank" rel="noreferrer" style={{ color: service.text }}>{service.attribution.text}</a>.
        </p>
    );
}

const REFRESH_AFTER_MS = 5 * 60 * 1000;

// One fetch path for every source. Which sources exist, what they can do and
// whether they are connected come from useSources(); playlists and tracks come
// from the generic library API. No service is named in this file.
export default function LibraryView({ active = true }) {
    const { playFrom, addToQueue } = useMusic();
    const { sources, loading: sourcesLoading, reload: reloadSources } = useSources();

    const [chosenSource, setChosenSource] = useState(null);
    const [selectedPlaylist, setSelectedPlaylist] = useState(null);

    // The first listed source (the local one, per the registry order) until the
    // user picks another.
    // Only sources with a library (playlists) belong here; search-only sources
    // such as Audius appear in Search instead.
    const librarySources = sources.filter(s => !s.capabilities || s.capabilities.playlists);
    const activeSource = chosenSource && librarySources.some(s => s.name === chosenSource) ? chosenSource : (librarySources[0] ? librarySources[0].name : null);
    const service = sources.find(s => s.name === activeSource) || null;

    const playlists = useLibrary(activeSource);
    const tracks = usePlaylistTracks(selectedPlaylist && selectedPlaylist.source, selectedPlaylist && selectedPlaylist.id);

    // "Create Playlist" card: turns into a small form in place.
    const [creating, setCreating] = useState(false);
    const [newName, setNewName] = useState('');
    const [saving, setSaving] = useState(false);

    const submitNewPlaylist = async (e) => {
        e.preventDefault();
        const name = newName.trim();
        if (!name || saving) return;
        setSaving(true);
        try {
            await createCustomPlaylist(name);
            toast(`Created “${name}”.`);
            setNewName('');
            setCreating(false);
            playlists.reload();
        } catch (err) {
            toast(err.message || 'Could not create the playlist.', { kind: 'error' });
        } finally {
            setSaving(false);
        }
    };

    // A track added from a row's "+ Playlist" menu changes the song counts
    // (and may have created a playlist): refresh the local source's list.
    // The view stays alive while Search is on screen, so it also has to
    // bring an open custom playlist up to date, and the liked list after a like.
    const reloadPlaylists = playlists.reload;
    const reloadTracks = tracks.reload;
    const isLocal = Boolean(service && service.local);
    const openSource = selectedPlaylist ? selectedPlaylist.source : null;
    const openKind = selectedPlaylist ? selectedPlaylist.kind : null;
    const openIsCustom = openKind === 'custom';
    useEffect(() => {
        if (!isLocal) return;
        const onChange = () => {
            reloadPlaylists();
            if (openIsCustom) reloadTracks();
        };
        window.addEventListener('custom-playlists-changed', onChange);
        return () => window.removeEventListener('custom-playlists-changed', onChange);
    }, [isLocal, openIsCustom, reloadPlaylists, reloadTracks]);
    useEffect(() => {
        if (openKind !== 'liked') return undefined;
        const onLiked = (event) => { if (event.detail && event.detail.source === openSource) reloadTracks(); };
        window.addEventListener('liked-changed', onLiked);
        return () => window.removeEventListener('liked-changed', onLiked);
    }, [openKind, openSource, reloadTracks]);

    // Coming back to the Library asks for nothing, unless it has been a while:
    // playlists can change elsewhere (another computer through cloud sync, the
    // service's own app).
    const lastLookAt = useRef(0);
    useEffect(() => {
        if (!active) return;
        const now = Date.now();
        if (lastLookAt.current && now - lastLookAt.current > REFRESH_AFTER_MS) reloadPlaylists();
        if (!lastLookAt.current || now - lastLookAt.current > REFRESH_AFTER_MS) lastLookAt.current = now;
    }, [active, reloadPlaylists]);

    const selectSource = (name) => {
        if (name === activeSource) return;
        setSelectedPlaylist(null);
        setChosenSource(name);
    };

    // A track clicked in a playlist plays as part of it: the tracks loaded
    // so far become the queue, and playback carries on down the list.
    const playInList = (track) => playFrom(tracks.items, track);
    const playAll = (items, name) => {
        const first = items.find(t => t.playable !== false);
        if (!first) return false;
        playFrom(items, first);
        toast(`Playing ${name}.`);
        return true;
    };
    const handlePlayAll = () => playAll(tracks.items, selectedPlaylist.name);

    // The play disc on a playlist card: open the playlist, as a click on the
    // card does, and play it once its first page of tracks is in (the same
    // request opening it makes).
    const [playWhenLoaded, setPlayWhenLoaded] = useState(null);
    const playPlaylist = (playlist) => {
        setSelectedPlaylist(playlist);
        setPlayWhenLoaded(`${playlist.source}:${playlist.id}`);
    };
    const openKey = selectedPlaylist ? `${selectedPlaylist.source}:${selectedPlaylist.id}` : null;
    const openName = selectedPlaylist ? selectedPlaylist.name : '';
    useEffect(() => {
        if (!playWhenLoaded) return;
        if (playWhenLoaded !== openKey) { setPlayWhenLoaded(null); return; }
        if (!tracks.loaded || tracks.loading) return;
        if (!tracks.error && !playAll(tracks.items, openName)) toast(`${openName} has nothing to play.`, { kind: 'warning' });
        setPlayWhenLoaded(null);
    // playAll is rebuilt every render; what matters is the list arriving.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [playWhenLoaded, openKey, openName, tracks.loaded, tracks.loading, tracks.error, tracks.items]);

    const canLike = Boolean(service && service.capabilities && service.capabilities.like);
    const inLiked = Boolean(selectedPlaylist && selectedPlaylist.kind === 'liked');
    // Every row can like and unlike (a heart toggle); inside the liked list
    // the rows start liked, and unliking takes the row away.
    const onLike = canLike ? (track) => likeTrack(track.source, track.id) : undefined;
    const onUnlike = canLike
        ? async (track) => {
            await unlikeTrack(track.source, track.id);
            if (inLiked) tracks.removeItem(t => t.id === track.id);
        }
        : undefined;

    if (!selectedPlaylist) {
        return (
            <div className="library-view" style={{ padding: '20px' }}>
                <div className="library-head">
                    <h1>Your Library</h1>
                    {sourcesLoading
                        ? <span className="list-message">Loading sources…</span>
                        : <SourcePicker sources={librarySources} value={activeSource} onChange={selectSource} ariaLabel="Library source" />}
                </div>

                {service && service.manageFolders && <LocalFoldersPanel onChange={reloadPlaylists} />}

                <div className="card-grid">
                    {service && service.local && !creating && (
                        <button type="button" className="create-tile pressable" onClick={() => setCreating(true)}>
                            <span className="plus" aria-hidden="true">+</span>
                            <span>Create playlist</span>
                        </button>
                    )}
                    {service && service.local && creating && (
                        <form onSubmit={submitNewPlaylist} className="create-tile is-form">
                            <label htmlFor="new-playlist-name">New playlist</label>
                            <input
                                id="new-playlist-name"
                                autoFocus
                                value={newName}
                                onChange={(e) => setNewName(e.target.value)}
                                onKeyDown={(e) => { if (e.key === 'Escape') { setCreating(false); setNewName(''); } }}
                                placeholder="Playlist name"
                                maxLength={120}
                            />
                            <div className="create-tile-actions">
                                <button type="submit" className="is-primary pressable" disabled={saving || !newName.trim()}>
                                    {saving ? 'Creating…' : 'Create'}
                                </button>
                                <button type="button" className="is-quiet pressable" onClick={() => { setCreating(false); setNewName(''); }}>
                                    Cancel
                                </button>
                            </div>
                        </form>
                    )}

                    {renderError(playlists.error, service, () => { reloadSources(); playlists.reload(); })}

                    {!playlists.error && playlists.items.map(playlist => (
                        <PlaylistCard key={`${playlist.source}-${playlist.id}`} playlist={playlist} onClick={setSelectedPlaylist} onPlay={playPlaylist} />
                    ))}

                    {!playlists.error && playlists.loaded && !playlists.loading && playlists.items.length === 0 && (
                        <div className="list-message is-panel">No playlists here yet.</div>
                    )}
                </div>

                {playlists.loading && playlists.items.length === 0 && <p className="list-message">Loading…</p>}
                {renderLoadMore(playlists)}
                {renderAttribution(service, 'Playlists and audio')}
            </div>
        );
    }

    return (
        <div className="library-view" style={{ padding: '20px' }}>
            <div className="playlist-head">
                <div className="playlist-head-title">
                    <button type="button" className="btn-neutral pressable" onClick={() => setSelectedPlaylist(null)}>
                        ← Back
                    </button>
                    <h2>
                        {inLiked && service && <span aria-hidden="true" style={{ color: service.text, marginRight: '8px' }}>♥</span>}
                        {selectedPlaylist.name}
                    </h2>
                    {selectedPlaylist.permalinkUrl && service && service.attribution && (
                        <a href={selectedPlaylist.permalinkUrl} target="_blank" rel="noreferrer" className="badge is-link" style={{ color: service.text }}>
                            Open on {service.attribution.text} ↗
                        </a>
                    )}
                </div>
                <button type="button" className="fill-pill pressable" onClick={handlePlayAll} disabled={tracks.items.length === 0}>
                    ▶ Play all
                </button>
            </div>

            <div className="track-list">
                {renderError(tracks.error, service, tracks.reload)}
                {!tracks.error && (
                    <VirtualList
                        items={tracks.items}
                        rowHeight={68}
                        renderRow={(track, index) => (
                            <TrackRow key={`pl-track-${track.source}-${track.id}-${index}`} track={track} onPlay={playInList} onQueue={addToQueue} onLike={onLike} onUnlike={onUnlike} likedInitially={inLiked} canAddToPlaylist={selectedPlaylist.source !== 'custom'} />
                        )}
                    />
                )}
                {!tracks.error && tracks.loading && tracks.items.length === 0 && (
                    <div className="list-message is-panel">Loading tracks…</div>
                )}
                {!tracks.error && tracks.loaded && !tracks.loading && tracks.items.length === 0 && (
                    <div className="list-message is-panel">This playlist is empty.</div>
                )}
            </div>
            {renderLoadMore(tracks)}
            {renderAttribution(service, 'Playlists and audio')}
        </div>
    );
}
