import {
  S3Client,
  GetObjectCommand,
  PutObjectCommand,
} from "@aws-sdk/client-s3";
import { writeFile } from "fs/promises";
import type { Readable } from "stream";

const r2 = new S3Client({
  region: "auto",
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID ?? "",
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY ?? "",
  },
});

const BUCKET = process.env.R2_BUCKET_NAME ?? "devsoc";

/**
 * Download a file from R2 and save it to the local filesystem.
 */
export async function downloadFromR2(
  key: string,
  destPath: string
): Promise<void> {
  console.log(`[r2] Downloading s3://${BUCKET}/${key} → ${destPath}`);

  const command = new GetObjectCommand({ Bucket: BUCKET, Key: key });
  const response = await r2.send(command);

  if (!response.Body) {
    throw new Error(`[r2] Empty response body for key: ${key}`);
  }

  // Collect the stream into a buffer
  const chunks: Uint8Array[] = [];
  const stream = response.Body as Readable;
  for await (const chunk of stream) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  }
  const buffer = Buffer.concat(chunks);

  await writeFile(destPath, buffer);
  console.log(
    `[r2] Downloaded ${key} (${(buffer.byteLength / 1024).toFixed(1)} KB)`
  );
}

/**
 * Upload a file (as a string or Buffer) to R2.
 */
export async function uploadToR2(
  key: string,
  body: string | Buffer,
  contentType = "text/csv"
): Promise<{ key: string; bucket: string }> {
  console.log(`[r2] Uploading → s3://${BUCKET}/${key}`);

  const command = new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    Body: body,
    ContentType: contentType,
  });

  await r2.send(command);

  const size =
    typeof body === "string" ? Buffer.byteLength(body) : body.byteLength;
  console.log(`[r2] Uploaded ${key} (${(size / 1024).toFixed(1)} KB)`);

  return { key, bucket: BUCKET };
}
