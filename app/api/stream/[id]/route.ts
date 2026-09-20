import { NextRequest, NextResponse } from 'next/server';
import { GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { getR2Client, getR2Bucket } from '@/lib/r2/client';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  // 1. Auth check
  const supabase = createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // 2. Fetch song and verify ownership (RLS handles this)
  const { data: song, error: dbError } = await supabase
    .from('songs')
    .select('id, file_key, user_id, play_count')
    .eq('id', params.id)
    .single();

  if (dbError || !song) {
    return NextResponse.json({ error: 'Song not found' }, { status: 404 });
  }

  // 3. Increment play count (fire and forget)
  supabase
    .from('songs')
    .update({ play_count: (song.play_count ?? 0) + 1 })
    .eq('id', song.id)
    .then(() => {});

  // 4. Generate a signed URL (expires in 1 hour)
  try {
    const r2Client = getR2Client();
    const R2_BUCKET = getR2Bucket();

    const command = new GetObjectCommand({
      Bucket: R2_BUCKET,
      Key: song.file_key,
    });

    const signedUrl = await getSignedUrl(r2Client, command, {
      expiresIn: 3600, // 1 hour
    });

    return NextResponse.json({ url: signedUrl });
  } catch (err) {
    console.error('Presign error:', err);
    return NextResponse.json({ error: 'Failed to generate stream URL' }, { status: 500 });
  }
}
