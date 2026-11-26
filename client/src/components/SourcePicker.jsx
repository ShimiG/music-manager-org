import React from 'react';
import { openSettings } from '../utils/navigation';

// The one source switch, shared by Library and Search. Takes the sources from
// useSources(): a usable source is selectable; one that needs a connection the
// user does not have is shown greyed and clicking it opens its connect action
// instead (or, when this installation is not set up for it yet, Settings ->
// Accounts, where that is done). No service is named here.
//
// `requiresConnection(source)` says whether this screen needs the user's own
// connection for that source. The Library always does; Search passes its own
// rule, because some sources search public content without one.
// `tipFor(source, selected)` gives the tooltip for a usable chip (none: no
// tooltip); greyed chips always say how to make them usable.
export default function SourcePicker({ sources, value, onChange, filter, requiresConnection, tipFor, ariaLabel = 'Source' }) {
    const visible = (sources || []).filter(s => (filter ? filter(s) : true));
    if (visible.length === 0) return null;

    const required = requiresConnection || ((s) => Boolean(s.connect && s.connect.required));
    const needsConnect = (s) => Boolean(required(s) && !s.connected);
    const unavailable = (s) => needsConnect(s) && !(s.connect && s.connect.available);

    const handleClick = (s) => {
        if (!needsConnect(s)) return onChange(s.name);
        if (unavailable(s)) return openSettings('accounts');
        if (s.connectAction) return s.connectAction();
        return undefined;
    };

    return (
        <div role="tablist" aria-label={ariaLabel} className="source-picker">
            {visible.map(s => {
                const selected = s.name === value;
                const greyed = needsConnect(s);
                const blocked = unavailable(s);
                const tip = blocked
                    ? `${s.label} is not set up on this computer yet. Open Settings, Accounts.`
                    : greyed ? `Connect ${s.label}` : (tipFor ? tipFor(s, selected) : '');
                const classes = ['source-chip', 'pressable', greyed && 'is-greyed', blocked && 'is-blocked'].filter(Boolean).join(' ');
                return (
                    <button
                        key={s.name}
                        type="button"
                        role="tab"
                        aria-selected={selected}
                        className={classes}
                        data-tip={tip || undefined}
                        data-tip-pos="below"
                        onClick={() => handleClick(s)}
                        // The service's own colours: its fill (with its label
                        // colour) when selected, its text colour for the glyph.
                        style={{ '--chip-fill': s.fill, '--chip-on-fill': s.onFill, '--chip-glyph': s.text }}
                    >
                        <span aria-hidden="true" className="source-chip-glyph">{s.icon}</span>{s.label}
                    </button>
                );
            })}
        </div>
    );
}
