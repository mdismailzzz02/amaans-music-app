'use client';

import { useRef, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';

export const dynamic = 'force-dynamic';

interface UploadFormData {
  title: string;
  artist: string;
  album: string;
}

interface UploadState {
  file: File | null;
  progress: number;
  uploading: boolean;
  error: string;
  success: boolean;
}

export default function UploadPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [state, setState] = useState<UploadState>({
    file: null, progress: 0, uploading: false, error: '', success: false,
  });
  const [form, setForm] = useState<UploadFormData>({
    title: '', artist: '', album: '',
  });

  function handleFile(file: File) {
    if (!file.type.startsWith('audio/')) {
      setState(s => ({ ...s, error: 'Please select an audio file (MP3, WAV, etc.)' }));
      return;
    }
    if (file.size > 50 * 1024 * 1024) {
      setState(s => ({ ...s, error: 'File is too large. Maximum size is 50 MB.' }));
      return;
    }
    // Auto-fill title from filename
    const nameWithoutExt = file.name.replace(/\.[^/.]+$/, '');
    setState(s => ({ ...s, file, error: '' }));
    setForm(f => ({ ...f, title: f.title || nameWithoutExt }));
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  }

  // Get duration from audio file
  async function getAudioDuration(file: File): Promise<number> {
    return new Promise(resolve => {
      const url = URL.createObjectURL(file);
      const audio = new Audio(url);
      audio.addEventListener('loadedmetadata', () => {
        URL.revokeObjectURL(url);
        resolve(Math.round(audio.duration));
      });
      audio.addEventListener('error', () => resolve(0));
    });
  }

  const handleUpload = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!state.file) return;

    setState(s => ({ ...s, uploading: true, error: '', progress: 5 }));

    // Get audio duration
    const duration = await getAudioDuration(state.file);
    setState(s => ({ ...s, progress: 15 }));

    const formData = new FormData();
    formData.append('file', state.file);
    formData.append('title', form.title || state.file.name.replace(/\.[^/.]+$/, ''));
    formData.append('artist', form.artist || 'Unknown Artist');
    formData.append('album', form.album || 'Unknown Album');
    formData.append('duration', String(duration));

    // Simulate progress (real upload doesn't expose progress in fetch API easily)
    const progressInterval = setInterval(() => {
      setState(s => ({
        ...s,
        progress: s.progress < 85 ? s.progress + Math.random() * 15 : s.progress,
      }));
    }, 400);

    const res = await fetch('/api/upload', { method: 'POST', body: formData });
    clearInterval(progressInterval);

    if (res.ok) {
      setState(s => ({ ...s, progress: 100, uploading: false, success: true }));
      setTimeout(() => router.push('/library'), 1500);
    } else {
      const data = await res.json().catch(() => ({}));
      setState(s => ({
        ...s,
        uploading: false,
        progress: 0,
        error: data.error || 'Upload failed. Please try again.',
      }));
    }
  }, [state.file, form, router]);

  const formatSize = (bytes: number) => `${(bytes / (1024 * 1024)).toFixed(1)} MB`;

  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Upload Music</h1>
          <p className="page-subtitle">Add MP3 files to your personal library</p>
        </div>
      </div>

      {/* Drop zone */}
      <div
        id="upload-dropzone"
        className={`upload-zone ${dragOver ? 'drag-over' : ''}`}
        onDragOver={e => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => !state.file && fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          id="upload-file-input"
          type="file"
          accept="audio/*,.mp3,.wav,.flac,.aac,.ogg"
          onChange={handleInputChange}
          style={{ display: 'none' }}
        />

        <div className="upload-icon">
          {state.file ? (
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#34d399" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          ) : (
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--accent-violet)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
          )}
        </div>

        {state.file ? (
          <>
            <h2 className="upload-title" style={{ color: 'var(--text-primary)' }}>{state.file.name}</h2>
            <p className="upload-subtitle">{formatSize(state.file.size)}</p>
            <button
              className="btn btn-ghost btn-sm"
              onClick={e => {
                e.stopPropagation();
                setState(s => ({ ...s, file: null, progress: 0 }));
                setForm({ title: '', artist: '', album: '' });
              }}
            >
              Choose different file
            </button>
          </>
        ) : (
          <>
            <h2 className="upload-title">Drop your music here</h2>
            <p className="upload-subtitle">or click to browse · MP3, WAV, FLAC, AAC up to 50 MB</p>
            <button className="btn btn-primary btn-sm" onClick={e => { e.stopPropagation(); fileInputRef.current?.click(); }}>
              Browse files
            </button>
          </>
        )}
      </div>

      {/* Error */}
      {state.error && (
        <div className="auth-error mt-4">{state.error}</div>
      )}

      {/* Success */}
      {state.success && (
        <div style={{
          padding: '16px',
          background: 'rgba(16, 185, 129, 0.1)',
          border: '1px solid rgba(16, 185, 129, 0.25)',
          borderRadius: 'var(--radius-md)',
          color: '#34d399',
          marginTop: 16,
          display: 'flex',
          alignItems: 'center',
          gap: 10,
        }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
          Upload complete! Redirecting to your library…
        </div>
      )}

      {/* Metadata form */}
      {state.file && !state.success && (
        <div className="upload-form-card animate-fade-in">
          <h3>Song details</h3>
          <form onSubmit={handleUpload}>
            <div className="upload-form-grid">
              <div className="form-group">
                <label className="form-label" htmlFor="upload-title">Title *</label>
                <input
                  id="upload-title"
                  className="form-input"
                  placeholder="Song title"
                  value={form.title}
                  onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="upload-artist">Artist</label>
                <input
                  id="upload-artist"
                  className="form-input"
                  placeholder="Artist name"
                  value={form.artist}
                  onChange={e => setForm(f => ({ ...f, artist: e.target.value }))}
                />
              </div>
              <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                <label className="form-label" htmlFor="upload-album">Album</label>
                <input
                  id="upload-album"
                  className="form-input"
                  placeholder="Album name (optional)"
                  value={form.album}
                  onChange={e => setForm(f => ({ ...f, album: e.target.value }))}
                />
              </div>
            </div>

            {/* Progress bar */}
            {state.uploading && (
              <div style={{ marginTop: 24 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                  <span>Uploading to Cloudflare R2…</span>
                  <span>{Math.round(state.progress)}%</span>
                </div>
                <div className="progress-bar-container">
                  <div className="progress-bar-fill" style={{ width: `${state.progress}%` }} />
                </div>
              </div>
            )}

            <div style={{ display: 'flex', gap: 12, marginTop: 24, justifyContent: 'flex-end' }}>
              <button
                id="upload-cancel"
                type="button"
                className="btn btn-ghost"
                onClick={() => { setState(s => ({ ...s, file: null })); setForm({ title: '', artist: '', album: '' }); }}
                disabled={state.uploading}
              >
                Cancel
              </button>
              <button
                id="upload-submit"
                type="submit"
                className="btn btn-primary"
                disabled={state.uploading || state.success}
              >
                {state.uploading ? (
                  <>Uploading…</>
                ) : (
                  <>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                      <polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" />
                    </svg>
                    Upload to library
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
