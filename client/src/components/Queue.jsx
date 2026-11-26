import React from 'react';
import { useMusic } from '../context/hook';
import VirtualList from './VirtualList';

// "Up Next". `theme="dark"` is used inside the Now Playing view; the default
// light card is the one beside Search and Recently Played. `heading={false}`
// leaves the title out where a tab already names the list.
const THEMES = {
    light: { panel: 'var(--panel-light)', heading: 'var(--ink-on-light)', rule: 'var(--panel-light-rule)', row: 'var(--panel-light-row)', rowActive: 'var(--accent-tint)', text: 'var(--ink-on-light)', empty: 'var(--text-subtle)', shadow: 'var(--shadow-light-card)', marker: 'var(--accent)' },
    dark: { panel: 'transparent', heading: 'var(--text-primary)', rule: 'var(--border-200)', row: 'var(--overlay-row)', rowActive: 'var(--overlay-active)', text: 'var(--text-strong)', empty: 'var(--text-dim)', shadow: 'none', marker: 'var(--theme-accent)' }
};

// Every row is this tall, its 8 px gap included (VirtualList needs equal rows).
const ROW_HEIGHT = 46;

export default function Queue({ theme = 'light', heading = true }) {
    const { queue, queueIndex, playQueueIndex, removeFromQueue } = useMusic();
    const c = THEMES[theme] || THEMES.light;

    return (
        <div style={{ background: c.panel, padding: theme === 'dark' ? 0 : '15px', borderRadius: '8px', height: 'fit-content' }}>
            {heading && <h2 style={{ borderBottom: `1px solid ${c.rule}`, paddingBottom: '10px', marginTop: 0, color: c.heading }}>Up Next</h2>}
            
            {!queue || queue.length === 0 ? (
                <p style={{ color: c.empty, fontStyle: 'italic' }}>Your queue is empty.</p>
            ) : (
                // A playlist played from a click is the whole list: only the rows
                // near the screen are drawn once it is long (VirtualList).
                <div style={{ display: 'flex', flexDirection: 'column', marginTop: '10px' }}>
                    <VirtualList
                        items={queue}
                        rowHeight={ROW_HEIGHT}
                        renderRow={(track, index) => {
                            const isPlayingNode = index === queueIndex;
                            return (
                                <div key={index} style={{
                                    display: 'flex', alignItems: 'center', gap: '10px', padding: '8px', marginBottom: '8px',
                                    height: `${ROW_HEIGHT - 8}px`, boxSizing: 'border-box', flexShrink: 0,
                                    background: isPlayingNode ? c.rowActive : c.row,
                                    borderLeft: isPlayingNode ? `4px solid ${c.marker}` : '4px solid transparent',
                                    borderRadius: '4px', boxShadow: c.shadow
                                }}>
                                    <div style={{ flex: 1, cursor: 'pointer', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} onClick={() => playQueueIndex(index)}>
                                        <div style={{ fontSize: '14px', fontWeight: isPlayingNode ? 'bold' : 'normal', color: c.text, overflow: 'hidden', textOverflow: 'ellipsis' }}>{track.title}</div>
                                    </div>
                                    <button type="button" className="queue-remove pressable" onClick={() => removeFromQueue(index)} aria-label={`Remove ${track.title} from the queue`} data-tip="Remove from queue" data-tip-pos="end">✕</button>
                                </div>
                            );
                        }}
                    />
                </div>
            )}
        </div>
    );
}
