import React, { useLayoutEffect, useRef, useState } from 'react';
import { useMusic } from '../context/hook';
import { useSources } from '../hooks/useSources';
import { DEFAULT_SOURCE, serviceOf } from '../utils/services';
import { artOf } from '../utils/artwork';
import { likeTrack, unlikeTrack } from '../utils/library';
import { formatTime, nudge, seekLabel } from '../utils/ui';
import Artwork from './Artwork';
import { LikeButton } from './SharedUI';
import { usePlaybackTime } from '../utils/playbackClock';

// Arrow keys move the seek bar by this many seconds, the volume by this much.
const SEEK_STEP_SEC = 5;
const VOLUME_STEP = 0.05;

// Material-style 24px glyphs, drawn in currentColor.
const Icon = ({ d, size = 20 }) => (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="currentColor" aria-hidden="true"><path d={d} /></svg>
);
const ICONS = {
    shuffle: 'M10.59 9.17L5.41 4 4 5.41l5.17 5.17 1.42-1.41zM14.5 4l2.04 2.04L4 18.59 5.41 20 17.96 7.46 20 9.5V4h-5.5zm.33 9.41l-1.41 1.41 3.13 3.13L14.5 20H20v-5.5l-2.04 2.04-3.13-3.13z',
    repeat: 'M7 7h10v3l4-4-4-4v3H5v6h2V7zm10 10H7v-3l-4 4 4 4v-3h12v-6h-2v4z',
    previous: 'M6 6h2v12H6zm3.5 6l8.5 6V6z',
    next: 'M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z',
    play: 'M8 5v14l11-7z',
    pause: 'M6 19h4V5H6v14zm8-14v14h4V5h-4z',
    volume: 'M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z',
    muted: 'M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z',
    chevron: 'M7.4 15.4 12 10.800l4.600 4.600L18 14l-6-6-6 6z'
};

// A round transport button with its tooltip; `pressed` makes it a toggle.
const TransportButton = ({ label, onClick, pressed, className = '', children }) => (
    <button
        type="button"
        className={`icon-btn transport-btn pressable${pressed ? ' is-on' : ''} ${className}`}
        onClick={onClick}
        aria-label={label}
        aria-pressed={pressed === undefined ? undefined : pressed}
        data-tip={label}
    >
        {children}
    </button>
);

export default function PlayerFooter({ expanded = false, onToggleExpanded }) {
    const {
        currentTrack, isPlaying, isLoading, togglePlay, playNext, playPrev,
        duration, volume, updateVolume, toggleMute, seek, isShuffle, toggleShuffle, isRepeat, toggleRepeat
    } = useMusic();
    const currentTime = usePlaybackTime();
    const { sources } = useSources();

    const [sliderValue, setSliderValue] = useState(0);
    const [isDragging, setIsDragging] = useState(false);

    // Publish the bar's height, so the Now Playing drawer can stop exactly at
    // its top edge and the controls stay put while the drawer slides.
    const barRef = useRef(null);
    const hasTrack = Boolean(currentTrack);
    useLayoutEffect(() => {
        const bar = barRef.current;
        if (!bar) return undefined;
        const publish = () => document.documentElement.style.setProperty('--player-height', `${bar.offsetHeight}px`);
        publish();
        if (typeof ResizeObserver === 'undefined') return undefined;
        const observer = new ResizeObserver(publish);
        observer.observe(bar);
        return () => observer.disconnect();
    }, [hasTrack]);

    if (!currentTrack) return null;

    const sourceName = currentTrack.source || DEFAULT_SOURCE;
    const service = serviceOf(sourceName);
    const artist = currentTrack.channelTitle || currentTrack.artist || 'Unknown Artist';
    const shownTime = isDragging ? sliderValue : (currentTime || 0);
    const playedPct = duration ? Math.min(100, Math.max(0, (shownTime / duration) * 100)) : 0;

    // Like the playing track where its source allows it and is connected.
    const source = sources.find((s) => s.name === sourceName);
    const canLike = Boolean(source && source.capabilities && source.capabilities.like && source.connected);
    const onLike = canLike ? (track) => likeTrack(track.source || DEFAULT_SOURCE, track.id) : undefined;
    const onUnlike = canLike ? (track) => unlikeTrack(track.source || DEFAULT_SOURCE, track.id) : undefined;

    const seekKeys = (e) => {
        if (!duration || (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight')) return;
        e.preventDefault();
        seek(nudge(currentTime, e.key === 'ArrowRight' ? SEEK_STEP_SEC : -SEEK_STEP_SEC, 0, duration));
    };
    const volumeKeys = (e) => {
        if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight' && e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
        e.preventDefault();
        const up = e.key === 'ArrowRight' || e.key === 'ArrowUp';
        updateVolume(Number(nudge(volume, up ? VOLUME_STEP : -VOLUME_STEP, 0, 1).toFixed(2)));
    };
    const endDrag = () => { setIsDragging(false); seek(sliderValue); };
    const muted = volume === 0;

    return (
        <div ref={barRef} className="player-footer player-bar">
            {/* Track: opens Now Playing. */}
            <div className="player-track" data-tip={`${currentTrack.title} · ${artist}`} data-tip-pos="start">
                <button
                    type="button"
                    className="player-track-button"
                    onClick={onToggleExpanded}
                    aria-expanded={expanded}
                    aria-label={`${expanded ? 'Close' : 'Open'} Now Playing: ${currentTrack.title} by ${artist}`}
                >
                    <Artwork src={artOf(currentTrack)} alt="" className="player-track-art" />
                    <span className="player-track-text">
                        <span className="player-track-title">{currentTrack.title}</span>
                        <span className="player-track-sub">
                            <span className="player-track-service" style={{ color: service.text }}><span aria-hidden="true">{service.icon}</span> {service.label}</span>
                            <span className="player-track-artist"> · {artist}</span>
                        </span>
                    </span>
                    <span className="chevron"><Icon d={ICONS.chevron} /></span>
                </button>
                {canLike && <LikeButton track={currentTrack} onLike={onLike} onUnlike={onUnlike} />}
            </div>

            {/* Controls and seek bar */}
            <div className="player-center">
                <div className="player-transport">
                    <TransportButton label={isShuffle ? 'Turn shuffle off' : 'Shuffle'} pressed={isShuffle} onClick={toggleShuffle}>
                        <Icon d={ICONS.shuffle} />
                    </TransportButton>
                    <TransportButton label="Previous" onClick={playPrev}>
                        <Icon d={ICONS.previous} size={24} />
                    </TransportButton>
                    <TransportButton label={isPlaying ? 'Pause' : 'Play'} onClick={togglePlay} className="is-play">
                        {isLoading ? <span className="loader player-loader" aria-hidden="true" /> : <Icon d={isPlaying ? ICONS.pause : ICONS.play} size={22} />}
                    </TransportButton>
                    <TransportButton label="Next" onClick={playNext}>
                        <Icon d={ICONS.next} size={24} />
                    </TransportButton>
                    <TransportButton label={isRepeat ? 'Turn repeat off' : 'Repeat this track'} pressed={isRepeat} onClick={toggleRepeat}>
                        <Icon d={ICONS.repeat} />
                    </TransportButton>
                </div>

                <div className="player-seek">
                    <span className="player-time is-elapsed">{formatTime(shownTime) || '0:00'}</span>
                    <input
                        type="range"
                        className="rail-slider seek-slider"
                        aria-label={seekLabel(shownTime, duration)}
                        min="0"
                        max={duration || 0}
                        step="any"
                        value={shownTime}
                        disabled={!duration}
                        onMouseDown={() => setIsDragging(true)}
                        onTouchStart={() => setIsDragging(true)}
                        onChange={(e) => setSliderValue(Number(e.target.value))}
                        onMouseUp={endDrag}
                        onTouchEnd={endDrag}
                        onKeyDown={seekKeys}
                        // The fill takes the playing track's source colour (issue #28).
                        style={{ '--rail-fill': service.color, '--rail-pct': `${playedPct}%` }}
                        data-source={sourceName}
                    />
                    <span className="player-time">{formatTime(duration) || '0:00'}</span>
                </div>
            </div>

            {/* Volume */}
            <div className="player-volume">
                <button
                    type="button"
                    className="icon-btn pressable"
                    onClick={toggleMute}
                    aria-label={muted ? 'Unmute' : 'Mute'}
                    data-tip={muted ? 'Unmute' : 'Mute'}
                    data-tip-pos="end"
                >
                    <Icon d={muted ? ICONS.muted : ICONS.volume} />
                </button>
                <input
                    type="range"
                    className="rail-slider volume-rail"
                    aria-label="Volume"
                    aria-valuetext={`${Math.round(volume * 100)}%`}
                    min="0"
                    max="1"
                    step="0.01"
                    value={volume}
                    onChange={(e) => updateVolume(parseFloat(e.target.value))}
                    onKeyDown={volumeKeys}
                    style={{ '--rail-fill': 'var(--theme-accent)', '--rail-pct': `${volume * 100}%` }}
                />
            </div>
        </div>
    );
}
