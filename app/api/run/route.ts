export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { runAgentOnce } from "@/lib/agent";

export async function POST() {
  try {
    const result = await runAgentOnce();
    if (!result.success) {
      return NextResponse.json(result, { status: 400 });
    }
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { success: false, reason: String(error) },
      { status: 500 }
    );
  }
}
