export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { exchangeCodeForTokens } from "@/lib/google";
import { getKV } from "@/lib/kv";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error");

  if (error) {
    return NextResponse.redirect(`/?connected=0&error=${encodeURIComponent(error)}`);
  }

  if (!code || !state) {
    return NextResponse.redirect("/?connected=0&error=missing_code");
  }

  const kv = getKV();
  const stateKey = `agent:oauth-state:${state}`;
  const isValidState = await kv.get<string | null>(stateKey);
  if (!isValidState) {
    return NextResponse.redirect("/?connected=0&error=invalid_state");
  }
  await kv.del(stateKey);

  try {
    await exchangeCodeForTokens(code);
    return NextResponse.redirect("/?connected=1");
  } catch (err) {
    return NextResponse.redirect(`/?connected=0&error=${encodeURIComponent(String(err))}`);
  }
}
