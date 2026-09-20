/**
 * lib/api.ts
 * Client-side API functions — replaces all Next.js API routes.
 * Uses Supabase client SDK directly for DB and Storage operations.
 */

import { createClient } from '@/lib/supabase/client';
import type { Song } from '@/lib/types';

const STORAGE_BUCKET = 'songs';

// ─── Songs ────────────────────────────────────────────────────────────────────

export async function fetchSongs(): Promise<Song[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('songs')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function deleteSong(id: string, fileKey: string): Promise<void> {
  const supabase = createClient();

  // Delete from Storage first
  await supabase.storage.from(STORAGE_BUCKET).remove([fileKey]);

  // Delete from DB
  const { error } = await supabase.from('songs').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

export async function uploadSong(
  file: File,
  metadata: { title: string; artist: string; album: string; duration: number },
  onProgress?: (pct: number) => void
): Promise<Song> {
  const supabase = createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) throw new Error('Unauthorized');

  onProgress?.(10);

  // Generate a unique path: {userId}/{uuid}.{ext}
  const ext = file.name.split('.').pop() || 'mp3';
  const uuid = crypto.randomUUID();
  const fileKey = `${user.id}/${uuid}.${ext}`;

  onProgress?.(20);

  // Upload to Supabase Storage
  const { error: uploadError } = await supabase.storage
    .from(STORAGE_BUCKET)
    .upload(fileKey, file, {
      contentType: file.type || 'audio/mpeg',
      upsert: false,
    });

  if (uploadError) throw new Error(uploadError.message);

  onProgress?.(80);

  // Insert song metadata into DB
  const { data: song, error: dbError } = await supabase
    .from('songs')
    .insert({
      user_id: user.id,
      title: metadata.title,
      artist: metadata.artist || 'Unknown Artist',
      album: metadata.album || 'Unknown Album',
      duration: metadata.duration,
      file_key: fileKey,
      file_size: file.size,
    })
    .select()
    .single();

  if (dbError) {
    // Cleanup orphaned storage file
    await supabase.storage.from(STORAGE_BUCKET).remove([fileKey]);
    throw new Error(dbError.message);
  }

  onProgress?.(100);
  return song;
}

// ─── Streaming ────────────────────────────────────────────────────────────────

export async function getStreamUrl(songId: string, fileKey: string): Promise<string> {
  const supabase = createClient();

  // Increment play count (fire and forget)
  supabase
    .from('songs')
    .select('play_count')
    .eq('id', songId)
    .single()
    .then(({ data }) => {
      if (data) {
        supabase.from('songs').update({ play_count: (data.play_count ?? 0) + 1 }).eq('id', songId).then(() => {});
      }
    });

  // Strip old R2 bucket prefix if present (e.g. "songs/{userId}/.." → "{userId}/..")
  // Old R2 keys were stored as "songs/{userId}/{uuid}.mp3"
  // Supabase Storage keys should be "{userId}/{uuid}.mp3" (bucket name is separate)
  const storageKey = fileKey.startsWith(`${STORAGE_BUCKET}/`)
    ? fileKey.slice(STORAGE_BUCKET.length + 1)
    : fileKey;

  // Create a 1-hour signed URL
  const { data, error } = await supabase.storage
    .from(STORAGE_BUCKET)
    .createSignedUrl(storageKey, 3600);

  if (error || !data?.signedUrl) throw new Error(error?.message ?? 'Failed to get stream URL');
  return data.signedUrl;
}

// ─── Profile ──────────────────────────────────────────────────────────────────

export interface Profile {
  id: string;
  is_public: boolean;
  created_at: string;
  updated_at: string;
}

export async function fetchProfile(): Promise<Profile> {
  const supabase = createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) throw new Error('Unauthorized');

  // Try to fetch existing profile
  const { data: existing } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .maybeSingle();

  if (existing) return existing;

  // Profile doesn't exist — create it
  const { data: newProfile, error: insertError } = await supabase
    .from('profiles')
    .insert({ id: user.id, is_public: false })
    .select()
    .single();

  if (insertError) throw new Error(insertError.message);
  return newProfile;
}

export async function updateProfile(data: Partial<{ is_public: boolean }>): Promise<Profile> {
  const supabase = createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) throw new Error('Unauthorized');

  const { data: profile, error } = await supabase
    .from('profiles')
    .update({ ...data, updated_at: new Date().toISOString() })
    .eq('id', user.id)
    .select()
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      // Row doesn't exist yet — insert
      const { data: newProfile, error: insertError } = await supabase
        .from('profiles')
        .insert({ id: user.id, ...data })
        .select()
        .single();
      if (insertError) throw new Error(insertError.message);
      return newProfile;
    }
    throw new Error(error.message);
  }

  return profile;
}
