export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { buildAuthUrl, getOAuthClient } from "@/lib/google";
import { getKV } from "@/lib/kv";

const SCOPES = [
  "https://www.googleapis.com/auth/youtube.upload",
  "https://www.googleapis.com/auth/drive.readonly",
  "https://www.googleapis.com/auth/userinfo.email",
  "https://www.googleapis.com/auth/userinfo.profile"
];

export async function GET() {
  const state = crypto.randomUUID();
  const kv = getKV();
  await kv.set(`agent:oauth-state:${state}`, "1", { ex: 600 });

  const url = buildAuthUrl(SCOPES);
  const withState = new URL(url);
  withState.searchParams.set("state", state);

  return NextResponse.redirect(withState.toString(), {
    status: 302
  });
}
