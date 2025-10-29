export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAgentConfig, setAgentConfig } from "@/lib/agent";

const configSchema = z.object({
  driveFolderId: z.string().min(1),
  dailyPublishTimeUTC: z
    .string()
    .regex(/^\d{2}:\d{2}$/, "Must be HH:MM in 24-hour UTC time"),
  privacyStatus: z.enum(["private", "public", "unlisted"]),
  notifySubscribers: z.boolean(),
  metadataContext: z.string().min(1),
  includeAutoChapters: z.boolean()
});

export async function GET() {
  const config = await getAgentConfig();
  return NextResponse.json(config);
}

export async function POST(req: NextRequest) {
  const json = await req.json();
  const parsed = configSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten() },
      { status: 400 }
    );
  }
  await setAgentConfig(parsed.data);
  return NextResponse.json({ ok: true });
}
