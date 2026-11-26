// Small pieces of interface logic, kept out of the components so they can be
// tested with Node's own test runner (no browser APIs, no React).

/** "3:07", or "" when the length is unknown. */
export function formatTime(seconds) {
    if (seconds === null || seconds === undefined || seconds === '') return '';
    const total = Math.floor(Number(seconds));
    if (!Number.isFinite(total) || total < 0) return '';
    const mins = Math.floor(total / 60);
    const secs = total % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
}

/** Whether two tracks are the same one. Rows stored before every track had a
 *  source belong to `defaultSource`. */
export function sameTrack(a, b, defaultSource) {
    if (!a || !b) return false;
    const id = (t) => t.id || t.videoId;
    return id(a) === id(b) && (a.source || defaultSource) === (b.source || defaultSource);
}

// --- Like ------------------------------------------------------------------

export const likeLabel = (liked) => (liked ? 'Remove from Liked Songs' : 'Save to Liked Songs');
export const likeToast = (likedNow) => (likedNow ? 'Added to Liked Songs.' : 'Removed from Liked Songs.');

/**
 * Likes or unlikes `track`, whichever undoes the current state, and resolves
 * to the new state. Throws (state unchanged) when the call fails or when the
 * way back is not available here (no `onUnlike`, say).
 */
export async function toggleLike({ liked, track, onLike, onUnlike }) {
    const action = liked ? onUnlike : onLike;
    if (typeof action !== 'function') throw new Error(liked ? 'Unliking is not available here.' : 'Liking is not available here.');
    await action(track);
    return !liked;
}

// --- Flash: a state that shows for a moment ("✓ Queued", "✓" on a card) -----

/**
 * `trigger()` calls onChange(true), then onChange(false) after `ms`. Triggering
 * again while it shows starts the time again; `cancel()` drops the pending
 * reset (on unmount).
 */
export function createFlash(onChange, ms) {
    let timer = null;
    return {
        trigger() {
            clearTimeout(timer);
            onChange(true);
            timer = setTimeout(() => { timer = null; onChange(false); }, ms);
        },
        cancel() {
            clearTimeout(timer);
            timer = null;
        }
    };
}

export const QUEUED_MS = 1200;
export const queueToast = (title) => `Added “${title || 'this track'}” to your queue.`;

// --- Player bar --------------------------------------------------------------

/** Previous restarts the track once it has played for more than this. */
export const RESTART_AFTER_SEC = 3;
export const previousAction = (position) => (Number(position) > RESTART_AFTER_SEC ? 'restart' : 'previous');

/** A value moved by `delta` and kept between `min` and `max`. */
export function nudge(value, delta, min, max) {
    const next = Number(value || 0) + delta;
    return Math.min(max, Math.max(min, next));
}

/** The seek bar's accessible name: "Seek, 1:05 of 3:40". */
export function seekLabel(position, duration) {
    return `Seek, ${formatTime(position) || '0:00'} of ${formatTime(duration) || '0:00'}`;
}
