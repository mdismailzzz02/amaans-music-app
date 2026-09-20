'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import type { Song } from '@/lib/types';
import { usePlayer } from '@/components/PlayerContext';

export const dynamic = 'force-dynamic';

function formatTime(seconds: number): string {
  if (!seconds || !isFinite(seconds)) return '--:--';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function formatSize(bytes: number): string {
  if (!bytes) return '';
  const mb = bytes / (1024 * 1024);
  return `${mb.toFixed(1)} MB`;
}

type ViewMode = 'grid' | 'list';

export default function LibraryPage() {
  const [songs, setSongs] = useState<Song[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<ViewMode>('grid');
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isPublic, setIsPublic] = useState(false);
  const [isUpdatingPublic, setIsUpdatingPublic] = useState(false);
  const { playSong, currentSong, isPlaying } = usePlayer();

  const fetchSongsAndProfile = useCallback(async () => {
    try {
      const [songsRes, profileRes] = await Promise.all([
        fetch('/api/songs'),
        fetch('/api/profile')
      ]);
      
      if (songsRes.ok) {
        const { songs } = await songsRes.json();
        setSongs(songs ?? []);
      }
      
      if (profileRes.ok) {
        const { profile } = await profileRes.json();
        if (profile) setIsPublic(profile.is_public);
      }
    } catch (err) {
      console.error('Failed to load data:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchSongsAndProfile(); }, [fetchSongsAndProfile]);

  async function handleDelete(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    if (!confirm('Remove this song?')) return;
    setDeletingId(id);
    const res = await fetch(`/api/songs?id=${id}`, { method: 'DELETE' });
    if (res.ok) {
      setSongs(prev => prev.filter(s => s.id !== id));
    }
    setDeletingId(null);
  }

  function handlePlay(song: Song) {
    playSong(song, songs);
  }

  async function togglePublic() {
    setIsUpdatingPublic(true);
    const newStatus = !isPublic;
    try {
      const res = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_public: newStatus })
      });
      if (res.ok) {
        setIsPublic(newStatus);
      } else {
        alert('Failed to update library visibility');
      }
    } catch (err) {
      alert('Network error');
    } finally {
      setIsUpdatingPublic(false);
    }
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}>
        <div style={{ textAlign: 'center' }}>
          <div className="playing-indicator" style={{ justifyContent: 'center', height: 40, marginBottom: 16 }}>
            <span /><span /><span />
          </div>
          <p style={{ color: 'var(--text-muted)' }}>Loading your library…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">My Library</h1>
          <p className="page-subtitle">
            {songs.length === 0 ? 'No songs yet' : `${songs.length} song${songs.length !== 1 ? 's' : ''}`}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          {/* View toggle */}
          <div className="view-toggle">
            <button
              id="view-grid"
              className={`view-toggle-btn ${view === 'grid' ? 'active' : ''}`}
              onClick={() => setView('grid')}
              aria-label="Grid view"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" />
                <rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" />
              </svg>
            </button>
            <button
              id="view-list"
              className={`view-toggle-btn ${view === 'list' ? 'active' : ''}`}
              onClick={() => setView('list')}
              aria-label="List view"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="8" y1="6" x2="21" y2="6" /><line x1="8" y1="12" x2="21" y2="12" /><line x1="8" y1="18" x2="21" y2="18" />
                <line x1="3" y1="6" x2="3.01" y2="6" /><line x1="3" y1="12" x2="3.01" y2="12" /><line x1="3" y1="18" x2="3.01" y2="18" />
              </svg>
            </button>
          </div>
          {/* Public Toggle */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginRight: 8 }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              {isPublic ? 'Public' : 'Private'}
            </span>
            <button
              className={`toggle-switch ${isPublic ? 'on' : 'off'}`}
              onClick={togglePublic}
              disabled={isUpdatingPublic}
              aria-label="Toggle public library"
              style={{
                position: 'relative',
                width: 44,
                height: 24,
                borderRadius: 12,
                border: 'none',
                background: isPublic ? 'var(--primary)' : 'var(--bg-elevated)',
                cursor: isUpdatingPublic ? 'wait' : 'pointer',
                transition: 'background 0.2s',
                opacity: isUpdatingPublic ? 0.7 : 1
              }}
            >
              <div style={{
                position: 'absolute',
                top: 2,
                left: isPublic ? 22 : 2,
                width: 20,
                height: 20,
                borderRadius: '50%',
                background: 'white',
                transition: 'left 0.2s',
                boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
              }} />
            </button>
          </div>

          <Link href="/upload" className="btn btn-primary btn-sm">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Upload
          </Link>
        </div>
      </div>

      {/* Empty state */}
      {songs.length === 0 && (
        <div className="empty-state animate-fade-in">
          <div className="empty-state-icon">
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 18V5l12-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" />
            </svg>
          </div>
          <h3>No songs yet</h3>
          <p>Upload your first MP3 to start building your personal music library.</p>
          <Link href="/upload" className="btn btn-primary">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
            Upload songs
          </Link>
        </div>
      )}

      {/* Grid view */}
      {songs.length > 0 && view === 'grid' && (
        <div className="songs-grid stagger">
          {songs.map(song => {
            const isCurrentPlaying = currentSong?.id === song.id && isPlaying;
            const isCurrent = currentSong?.id === song.id;
            return (
              <div
                key={song.id}
                id={`song-card-${song.id}`}
                className={`song-card animate-fade-in ${isCurrent ? 'playing' : ''}`}
                onClick={() => handlePlay(song)}
              >
                {/* Actions */}
                <div className="song-card-actions">
                  <button
                    id={`delete-${song.id}`}
                    className="btn btn-icon btn-danger"
                    onClick={(e) => handleDelete(song.id, e)}
                    disabled={deletingId === song.id}
                    aria-label="Delete song"
                    title="Delete song"
                  >
                    {deletingId === song.id ? '…' : (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
                      </svg>
                    )}
                  </button>
                </div>

                {/* Cover art */}
                <div className="song-card-cover">
                  <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.7 }}>
                    <path d="M9 18V5l12-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" />
                  </svg>
                  <div className="song-card-play-btn">
                    {isCurrentPlaying ? (
                      <div className="playing-indicator">
                        <span /><span /><span />
                      </div>
                    ) : (
                      <svg width="28" height="28" viewBox="0 0 24 24" fill="white">
                        <polygon points="5 3 19 12 5 21 5 3" />
                      </svg>
                    )}
                  </div>
                </div>

                <div className="song-card-title">{song.title}</div>
                <div className="song-card-artist">{song.artist}</div>
                {song.duration > 0 && (
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 6 }}>
                    {formatTime(song.duration)}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* List view */}
      {songs.length > 0 && view === 'list' && (
        <div className="songs-list stagger">
          {songs.map((song, i) => {
            const isCurrentPlaying = currentSong?.id === song.id && isPlaying;
            const isCurrent = currentSong?.id === song.id;
            return (
              <div
                key={song.id}
                id={`song-list-${song.id}`}
                className={`song-list-item animate-fade-in ${isCurrent ? 'playing' : ''}`}
                onClick={() => handlePlay(song)}
              >
                <div className="song-list-num">
                  {isCurrentPlaying ? (
                    <div className="playing-indicator" style={{ height: 16 }}>
                      <span /><span /><span />
                    </div>
                  ) : (
                    <span>{i + 1}</span>
                  )}
                </div>
                <div className="song-list-cover">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.7 }}>
                    <path d="M9 18V5l12-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" />
                  </svg>
                </div>
                <div className="song-list-info">
                  <div className="song-list-title">{song.title}</div>
                  <div className="song-list-artist">{song.artist} {song.album !== 'Unknown Album' ? `• ${song.album}` : ''}</div>
                </div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{formatSize(song.file_size)}</div>
                <div className="song-list-duration">{formatTime(song.duration)}</div>
                <button
                  id={`list-delete-${song.id}`}
                  className="btn btn-icon btn-danger"
                  style={{ opacity: 0.6 }}
                  onClick={(e) => handleDelete(song.id, e)}
                  disabled={deletingId === song.id}
                  aria-label="Delete song"
                >
                  {deletingId === song.id ? '…' : (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
                    </svg>
                  )}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
