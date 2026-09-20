import { S3Client } from '@aws-sdk/client-s3';

/** Returns a validated R2 S3Client. Call this inside API route handlers. */
export function getR2Client(): S3Client {
  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;

  if (!accountId) throw new Error('Missing R2_ACCOUNT_ID');
  if (!accessKeyId) throw new Error('Missing R2_ACCESS_KEY_ID');
  if (!secretAccessKey) throw new Error('Missing R2_SECRET_ACCESS_KEY');

  return new S3Client({
    region: 'auto',
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId, secretAccessKey },
  });
}

export function getR2Bucket(): string {
  const bucket = process.env.R2_BUCKET_NAME;
  if (!bucket) throw new Error('Missing R2_BUCKET_NAME');
  return bucket;
}
