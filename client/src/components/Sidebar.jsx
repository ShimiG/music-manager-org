import React from 'react';
import { useMusic } from '../context/hook';

const VIEWS = [
    { id: 'search', label: '🔍 Search' },
    { id: 'library', label: '📚 My Library' },
    { id: 'history', label: '🕒 Recently Played' },
    { id: 'settings', label: '⚙️ Settings' }
];

export default function Sidebar({ view, setView, handleLogout }) {
    const { currentTrack } = useMusic();

    return (
        // Room at the bottom while the player bar lies over the column, so
        // Logout stays above it.
        <nav className={`sidebar${currentTrack ? ' has-player' : ''}`} aria-label="Main">
            <h2 className="sidebar-title">🎵 Music</h2>
            {VIEWS.map(({ id, label }) => (
                <button
                    key={id}
                    type="button"
                    className="sidebar-item pressable"
                    aria-current={view === id ? 'page' : undefined}
                    onClick={() => setView(id)}
                >
                    {label}
                </button>
            ))}
            <div className="sidebar-spacer" />
            {/* Shrink-wrapped to its label, so only the words are clickable. */}
            <button type="button" className="sidebar-logout pressable" onClick={handleLogout}>
                Logout
            </button>
        </nav>
    );
}
