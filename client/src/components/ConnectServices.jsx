import React from 'react';
import { useSources } from '../hooks/useSources';
import { openSettings } from '../utils/navigation';

// One-click connect banner shown at the top of the home screen. Lists every
// source the server says needs a connection, can be connected here, and this
// user has not connected yet. A source that cannot be connected because this
// installation has no credentials for it yet is named too, with the way to
// Settings -> Accounts, instead of silently having no button. Disappears once
// everything is linked. No service is named in this file; useSources() and
// the registry supply the details.
export default function ConnectServices() {
    const { sources, loading } = useSources();

    // While loading, render nothing rather than flashing buttons that may hide.
    if (loading) return null;

    const missing = sources.filter(s =>
        s.connect && s.connect.required && s.connect.available && !s.connected && typeof s.connectAction === 'function'
    );
    // Needs a connection even to search, has none, and the server cannot start
    // one yet. A source that works without an account is not nagged about.
    const notSetUp = sources.filter(s => s.connect && s.connect.required && s.searchRequiresConnection && !s.connect.available && !s.connected);
    if (missing.length === 0 && notSetUp.length === 0) return null;
    const names = notSetUp.map(s => s.label).join(' and ');

    return (
        <div className="connect-banner">
            <span className="connect-banner-text">
                {missing.length > 0
                    ? 'Connect your streaming services to search and play music.'
                    : `${names} ${notSetUp.length > 1 ? 'are' : 'is'} not set up on this computer yet.`}
            </span>
            <div className="connect-banner-buttons">
                {missing.map(s => (
                    <button
                        key={s.name}
                        type="button"
                        className="fill-pill pressable"
                        onClick={() => s.connectAction()}
                        style={{ '--pill-fill': s.fill, '--pill-on-fill': s.onFill }}
                    >
                        {s.connectLabel}
                    </button>
                ))}
                {notSetUp.length > 0 && (
                    <button
                        type="button"
                        className="outline-pill pressable"
                        onClick={() => openSettings('accounts')}
                        data-tip={`${names}: not set up on this computer yet`}
                        data-tip-pos="end"
                    >
                        {missing.length > 0 ? `Set up ${names}` : 'Open Accounts'}
                    </button>
                )}
            </div>
        </div>
    );
}
