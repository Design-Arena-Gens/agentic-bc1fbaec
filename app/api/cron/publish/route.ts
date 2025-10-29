export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { runAgentOnce, scheduleNextRun } from "@/lib/agent";

export async function POST() {
  const result = await runAgentOnce();
  if (!result.success) {
    await scheduleNextRun();
    return NextResponse.json(result, { status: 200 });
  }
  return NextResponse.json(result);
}
