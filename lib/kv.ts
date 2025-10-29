import { createClient } from "@vercel/kv";

export function getKV() {
  if (!process.env.KV_REST_API_URL || !process.env.KV_REST_API_TOKEN) {
    throw new Error(
      "Vercel KV credentials are not configured. Set KV_REST_API_URL and KV_REST_API_TOKEN."
    );
  }

  return createClient({
    url: process.env.KV_REST_API_URL,
    token: process.env.KV_REST_API_TOKEN,
    automaticDeserialization: true
  });
}
