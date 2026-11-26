import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toast, subscribeToasts, TOAST_MS } from './toast.js';

test('toasts reach subscribers with a timeout by kind', () => {
    const seen = [];
    const stop = subscribeToasts((item) => seen.push(item));
    toast('Added to Liked Songs.');
    toast('SoundCloud is slow to answer.', { kind: 'warning' });
    toast('Could not play this track.', { kind: 'error' });
    toast('Custom', { timeoutMs: 1000 });
    stop();
    toast('after unsubscribing');
    assert.deepEqual(seen.map((t) => [t.kind, t.timeoutMs]), [
        ['info', 2800], ['warning', TOAST_MS.warning], ['error', TOAST_MS.error], ['info', 1000]
    ]);
    assert.equal(new Set(seen.map((t) => t.id)).size, 4, 'each toast has its own id');
});
