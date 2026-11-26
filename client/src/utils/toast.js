// Tiny app-wide toast bus. Any module (components, MusicContext, utils) can
// call toast(); <Toaster /> renders whatever is pending. No React context, so
// it works from plain functions like the connect helpers too.
const listeners = new Set();
let nextId = 1;

// How long a toast stays: a confirmation is read at a glance; a warning or an
// error usually says what to do next, so it stays longer. A caller can set its own.
export const TOAST_MS = { info: 2800, warning: 6000, error: 6000 };

export function toast(message, { kind = 'info', timeoutMs } = {}) {
    const item = { id: nextId++, message, kind, timeoutMs: timeoutMs || TOAST_MS[kind] || TOAST_MS.info };
    listeners.forEach((fn) => fn(item));
    return item.id;
}

export function subscribeToasts(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
}
