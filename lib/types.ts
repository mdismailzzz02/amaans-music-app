export interface Song {
  id: string;
  user_id: string;
  title: string;
  artist: string;
  album: string;
  duration: number;
  file_key: string;
  cover_key: string | null;
  file_size: number;
  play_count: number;
  created_at: string;
  updated_at: string;
}
