import { useEffect, useRef, useState } from 'react';
import { addTrackToCustomPlaylist, createCustomPlaylist, listCustomPlaylists } from '../utils/library';
import { toast } from '../utils/toast';

// The list icon with a plus: "add to a playlist".
const PlaylistIcon = ({ size }) => (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
        <path d="M3 5h9M3 9h9M3 13h5M15 10v6M12 13h6" />
    </svg>
);

// The menu normally hangs from the button's right edge, reaching to the left
// (up to about 300px with its "new playlist" field). Whether there is room for that inside the area that
// scrolls (a card in the first column of a grid has none).
const MENU_ROOM = 300;
function roomOnTheLeft(element, width) {
    let box = element.parentElement;
    while (box && box !== document.body) {
        const overflow = getComputedStyle(box).overflowY;
        if (overflow === 'auto' || overflow === 'scroll') break;
        box = box.parentElement;
    }
    const edge = box && box !== document.body ? box.getBoundingClientRect().left : 0;
    return element.getBoundingClientRect().right - width >= edge + 8;
}

// "+ Playlist" on a track row: a small menu of the user's custom playlists,
// plus a field to create a new one and add the track to it in one step.
// `compact`: a small icon button instead (on a card's picture).
export default function AddToPlaylist({ track, compact = false }) {
    const [open, setOpen] = useState(false);
    const [playlists, setPlaylists] = useState(null); // null = loading
    const [newName, setNewName] = useState('');
    const [busy, setBusy] = useState(false);
    const rootRef = useRef(null);
    const [hangLeft, setHangLeft] = useState(false); // the menu starts at the button and reaches right

    // Close on a click outside or Escape.
    useEffect(() => {
        if (!open) return;
        const onDown = (e) => { if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false); };
        const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
        document.addEventListener('mousedown', onDown);
        document.addEventListener('keydown', onKey);
        return () => {
            document.removeEventListener('mousedown', onDown);
            document.removeEventListener('keydown', onKey);
        };
    }, [open]);

    const toggle = (e) => {
        e.stopPropagation();
        if (open) return setOpen(false);
        setHangLeft(compact && rootRef.current ? !roomOnTheLeft(rootRef.current, MENU_ROOM) : false);
        setOpen(true);
        setPlaylists(null);
        listCustomPlaylists()
            .then(setPlaylists)
            .catch(() => { setPlaylists([]); toast('Could not load your playlists.', { kind: 'error' }); });
    };

    const addTo = async (playlist) => {
        if (busy) return;
        setBusy(true);
        try {
            const result = await addTrackToCustomPlaylist(playlist.id, track);
            const title = track.title || 'this track';
            toast(result && result.alreadyInPlaylist ? `“${title}” is already in ${playlist.name}.` : `Added “${title}” to ${playlist.name}.`);
            window.dispatchEvent(new Event('custom-playlists-changed'));
            setOpen(false);
        } catch (err) {
            toast(err.message || 'Could not add the track.', { kind: 'error' });
        } finally {
            setBusy(false);
        }
    };

    const createAndAdd = async (e) => {
        e.preventDefault();
        const name = newName.trim();
        if (!name || busy) return;
        setBusy(true);
        try {
            const created = await createCustomPlaylist(name);
            setNewName('');
            setBusy(false);
            await addTo({ id: created.id, name: created.name });
        } catch (err) {
            setBusy(false);
            toast(err.message || 'Could not create the playlist.', { kind: 'error' });
        }
    };

    return (
        <span ref={rootRef} className={`playlist-menu-anchor${compact ? ' is-compact' : ''}`}>
            {compact ? (
                <button type="button" className="card-action pressable" onClick={toggle} aria-haspopup="menu" aria-expanded={open} aria-label="Add to playlist" data-tip={open ? undefined : 'Add to playlist'} data-tip-pos="end">
                    <PlaylistIcon size={16} />
                </button>
            ) : (
                <button type="button" className="icon-btn pressable" onClick={toggle} aria-haspopup="menu" aria-expanded={open} aria-label="Add to playlist" data-tip={open ? undefined : 'Add to playlist'}>
                    <PlaylistIcon size={20} />
                </button>
            )}
            {open && (
                <div role="menu" className={`playlist-menu${hangLeft ? ' hangs-right' : ''}`} onClick={(e) => e.stopPropagation()}>
                    {playlists === null && <div className="playlist-menu-item is-note">Loading…</div>}
                    {playlists && playlists.length === 0 && (
                        <div className="playlist-menu-item is-note">No playlists yet</div>
                    )}
                    {playlists && playlists.map(p => (
                        <button
                            key={p.id}
                            type="button"
                            role="menuitem"
                            className="playlist-menu-item"
                            disabled={busy}
                            onClick={() => addTo(p)}
                        >
                            {p.name}
                        </button>
                    ))}
                    <form onSubmit={createAndAdd} className="playlist-menu-new">
                        <input
                            value={newName}
                            onChange={(e) => setNewName(e.target.value)}
                            placeholder="New playlist…"
                            maxLength={120}
                            aria-label="New playlist name"
                        />
                        <button type="submit" className="pressable" disabled={busy || !newName.trim()}>
                            Add
                        </button>
                    </form>
                </div>
            )}
        </span>
    );
}
