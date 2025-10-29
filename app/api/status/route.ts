export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { getAgentStatus } from "@/lib/agent";

export async function GET() {
  const status = await getAgentStatus();
  return NextResponse.json(status);
}
