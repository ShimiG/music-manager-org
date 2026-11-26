import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import {
    formatTime, sameTrack, likeLabel, likeToast, toggleLike, createFlash, QUEUED_MS,
    queueToast, previousAction, nudge, seekLabel
} from './ui.js';

test('formatTime', () => {
    assert.equal(formatTime(0), '0:00');
    assert.equal(formatTime(7), '0:07');
    assert.equal(formatTime(187.9), '3:07');
    assert.equal(formatTime(null), '');
    assert.equal(formatTime(undefined), '');
    assert.equal(formatTime(-1), '');
});

test('sameTrack compares id and source, with the default source for old rows', () => {
    assert.equal(sameTrack({ id: 'a', source: 'youtube' }, { id: 'a' }, 'youtube'), true);
    assert.equal(sameTrack({ id: 'a', source: 'deezer' }, { id: 'a' }, 'youtube'), false);
    assert.equal(sameTrack({ videoId: 'a' }, { id: 'a', source: 'youtube' }, 'youtube'), true);
    assert.equal(sameTrack(null, { id: 'a' }, 'youtube'), false);
});

test('like labels and toasts', () => {
    assert.equal(likeLabel(false), 'Save to Liked Songs');
    assert.equal(likeLabel(true), 'Remove from Liked Songs');
    assert.equal(likeToast(true), 'Added to Liked Songs.');
    assert.equal(likeToast(false), 'Removed from Liked Songs.');
});

test('toggleLike likes, then unlikes, calling the matching function', async () => {
    const calls = [];
    const onLike = async (t) => { calls.push(['like', t.id]); };
    const onUnlike = async (t) => { calls.push(['unlike', t.id]); };
    const track = { id: 't1' };
    let liked = false;
    liked = await toggleLike({ liked, track, onLike, onUnlike });
    assert.equal(liked, true);
    liked = await toggleLike({ liked, track, onLike, onUnlike });
    assert.equal(liked, false);
    assert.deepEqual(calls, [['like', 't1'], ['unlike', 't1']]);
});

test('toggleLike keeps the state when the call fails or the way back is missing', async () => {
    const failing = async () => { throw new Error('offline'); };
    await assert.rejects(toggleLike({ liked: false, track: {}, onLike: failing }), /offline/);
    await assert.rejects(toggleLike({ liked: true, track: {}, onLike: async () => {} }), /not available/);
});

test('createFlash shows for its time, restarts on a second trigger, and cancels', () => {
    mock.timers.enable({ apis: ['setTimeout'] });
    try {
        const seen = [];
        const flash = createFlash((on) => seen.push(on), QUEUED_MS);
        flash.trigger();
        assert.deepEqual(seen, [true]);
        mock.timers.tick(QUEUED_MS - 1);
        assert.deepEqual(seen, [true]);
        flash.trigger(); // again before it ended: the time starts over
        mock.timers.tick(QUEUED_MS - 1);
        assert.deepEqual(seen, [true, true]);
        mock.timers.tick(1);
        assert.deepEqual(seen, [true, true, false]);

        flash.trigger();
        flash.cancel();
        mock.timers.tick(QUEUED_MS * 2);
        assert.deepEqual(seen, [true, true, false, true]);
    } finally {
        mock.timers.reset();
    }
});

test('queue toast quotes the title with curly quotes', () => {
    assert.equal(queueToast('Roads'), 'Added “Roads” to your queue.');
});

test('previous restarts after 3 seconds, else goes back', () => {
    assert.equal(previousAction(0), 'previous');
    assert.equal(previousAction(3), 'previous');
    assert.equal(previousAction(3.1), 'restart');
    assert.equal(previousAction(undefined), 'previous');
});

test('nudge keeps values in range', () => {
    assert.equal(nudge(10, 5, 0, 12), 12);
    assert.equal(nudge(2, -5, 0, 12), 0);
    assert.equal(Number(nudge(0.5, 0.05, 0, 1).toFixed(2)), 0.55);
});

test('seek label', () => {
    assert.equal(seekLabel(65, 220), 'Seek, 1:05 of 3:40');
    assert.equal(seekLabel(0, 0), 'Seek, 0:00 of 0:00');
});
