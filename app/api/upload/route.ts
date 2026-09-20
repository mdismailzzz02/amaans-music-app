import { NextRequest, NextResponse } from 'next/server';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { getR2Client, getR2Bucket } from '@/lib/r2/client';
import { createClient } from '@/lib/supabase/server';
import { randomUUID } from 'crypto';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  // 1. Auth check
  const supabase = createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // 2. Parse multipart form data
  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: 'Invalid form data' }, { status: 400 });
  }

  const file = formData.get('file') as File | null;
  const title = (formData.get('title') as string) || 'Untitled';
  const artist = (formData.get('artist') as string) || 'Unknown Artist';
  const album = (formData.get('album') as string) || 'Unknown Album';
  const durationStr = formData.get('duration') as string | null;
  const duration = durationStr ? parseInt(durationStr, 10) : 0;

  if (!file) {
    return NextResponse.json({ error: 'No file provided' }, { status: 400 });
  }

  // Validate file type
  if (!file.type.includes('audio')) {
    return NextResponse.json({ error: 'File must be an audio file' }, { status: 400 });
  }

  // Max 50 MB
  if (file.size > 50 * 1024 * 1024) {
    return NextResponse.json({ error: 'File too large (max 50 MB)' }, { status: 400 });
  }

  // 3. Upload to Cloudflare R2
  const r2Client = getR2Client();
  const R2_BUCKET = getR2Bucket();

  const fileId = randomUUID();
  const ext = file.name.split('.').pop() || 'mp3';
  const fileKey = `songs/${user.id}/${fileId}.${ext}`;

  const fileBuffer = Buffer.from(await file.arrayBuffer());

  try {
    await r2Client.send(
      new PutObjectCommand({
        Bucket: R2_BUCKET,
        Key: fileKey,
        Body: fileBuffer,
        ContentType: file.type || 'audio/mpeg',
        ContentLength: file.size,
        Metadata: {
          userId: user.id,
          title,
          artist,
          album,
        },
      })
    );
  } catch (err) {
    console.error('R2 upload error:', err);
    return NextResponse.json({ error: 'Failed to upload to storage' }, { status: 500 });
  }

  // 4. Insert song record into Supabase
  const { data: song, error: dbError } = await supabase
    .from('songs')
    .insert({
      user_id: user.id,
      title,
      artist,
      album,
      duration,
      file_key: fileKey,
      file_size: file.size,
    })
    .select()
    .single();

  if (dbError) {
    console.error('Supabase insert error:', dbError);
    return NextResponse.json({ error: 'Failed to save song metadata' }, { status: 500 });
  }

  return NextResponse.json({ song }, { status: 201 });
}
