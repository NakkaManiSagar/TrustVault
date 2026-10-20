
import { createClient } from "@supabase/supabase-js";

let storageClient;

function getStorageClient() {
  if (storageClient) return storageClient;

  const url = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    throw new Error("Private storage configuration is missing");
  }

  storageClient = createClient(url, serviceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });

  return storageClient;
}

function getBucket() {
  const bucket = process.env.SUPABASE_BUCKET;

  if (!bucket) {
    throw new Error("SUPABASE_BUCKET is not configured");
  }

  return bucket;
}

export async function uploadObject({
  storageKey,
  buffer,
  contentType,
}) {
  const { data, error } = await getStorageClient()
    .storage
    .from(getBucket())
    .upload(storageKey, buffer, {
      contentType,
      upsert: false,
    });

  if (error) {
    throw new Error(`Storage upload failed: ${error.message}`);
  }

  return data;
}

export async function downloadObject(storageKey) {
  const { data, error } = await getStorageClient()
    .storage
    .from(getBucket())
    .download(storageKey);

  if (error) {
    throw new Error(`Storage download failed: ${error.message}`);
  }

  if (!data) {
    throw new Error("Storage returned no file data");
  }

  return Buffer.from(await data.arrayBuffer());
}

export async function deleteObject(storageKey) {
  const { error } = await getStorageClient()
    .storage
    .from(getBucket())
    .remove([storageKey]);

  if (error) {
    throw new Error(`Storage deletion failed: ${error.message}`);
  }
}
