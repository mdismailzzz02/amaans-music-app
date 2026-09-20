import { NextRequest, NextResponse } from 'next/server';
import { DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getR2Client, getR2Bucket } from '@/lib/r2/client';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

// GET /api/songs — list all songs for the authenticated user
export async function GET() {
  const supabase = createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: songs, error } = await supabase
    .from('songs')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ songs });
}

// DELETE /api/songs?id=<song-id> — delete a song from R2 and DB
export async function DELETE(req: NextRequest) {
  const supabase = createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  if (!id) {
    return NextResponse.json({ error: 'Song ID is required' }, { status: 400 });
  }

  // Get song to find R2 key (RLS ensures user owns it)
  const { data: song, error: fetchError } = await supabase
    .from('songs')
    .select('id, file_key')
    .eq('id', id)
    .single();

  if (fetchError || !song) {
    return NextResponse.json({ error: 'Song not found' }, { status: 404 });
  }

  // Delete from R2
  try {
    const r2Client = getR2Client();
    const R2_BUCKET = getR2Bucket();
    await r2Client.send(
      new DeleteObjectCommand({ Bucket: R2_BUCKET, Key: song.file_key })
    );
  } catch (err) {
    console.error('R2 delete error:', err);
    // Continue even if R2 delete fails — remove DB record
  }

  // Delete from Supabase
  const { error: deleteError } = await supabase
    .from('songs')
    .delete()
    .eq('id', id);

  if (deleteError) {
    return NextResponse.json({ error: deleteError.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
