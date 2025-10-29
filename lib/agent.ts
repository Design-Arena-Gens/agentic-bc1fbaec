import { getKV } from "./kv";
import { GeneratedMetadata, generateVideoMetadata } from "./openai";
import {
  downloadDriveFile,
  getAuthorizedClient,
  getGoogleProfile,
  listDriveVideos,
  uploadVideoToYouTube
} from "./google";

export type AgentConfig = {
  driveFolderId: string;
  dailyPublishTimeUTC: string;
  privacyStatus: "private" | "public" | "unlisted";
  notifySubscribers: boolean;
  metadataContext: string;
  includeAutoChapters: boolean;
};

export type AgentStatus = {
  config: AgentConfig | null;
  nextRunISO: string | null;
  googleProfileEmail: string | null;
  lastUploadedVideoId: string | null;
  lastUploadAt: string | null;
  pendingCount: number;
};

const CONFIG_KEY = "agent:config";
const LAST_UPLOAD_KEY = "agent:last-upload";
const UPLOAD_HISTORY_KEY = "agent:upload-history";
const SCHEDULE_KEY = "agent:schedule";

const DEFAULT_CONFIG: AgentConfig = {
  driveFolderId: "",
  dailyPublishTimeUTC: "15:00",
  privacyStatus: "private",
  notifySubscribers: false,
  metadataContext:
    "You are posting daily videos sourced from Google Drive. Craft SEO-friendly metadata with clear CTAs.",
  includeAutoChapters: false
};

export async function getAgentConfig(): Promise<AgentConfig> {
  const kv = getKV();
  const config = await kv.get<AgentConfig>(CONFIG_KEY);
  return config ?? DEFAULT_CONFIG;
}

export async function setAgentConfig(config: AgentConfig) {
  const kv = getKV();
  await kv.set(CONFIG_KEY, config);
  await scheduleNextRun(config);
}

export async function scheduleNextRun(config?: AgentConfig) {
  const kv = getKV();
  const cfg = config ?? (await getAgentConfig());
  if (!cfg.driveFolderId) {
    await kv.del(SCHEDULE_KEY);
    return null;
  }

  const [hour, minute] = cfg.dailyPublishTimeUTC.split(":").map(Number);
  const now = new Date();
  const next = new Date(Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate(),
    hour,
    minute,
    0,
    0
  ));
  if (next <= now) {
    next.setUTCDate(next.getUTCDate() + 1);
  }
  await kv.set(SCHEDULE_KEY, next.toISOString());
  return next;
}

export async function getAgentStatus(): Promise<AgentStatus> {
  const kv = getKV();
  const [config, scheduleIso, lastUpload, googleProfile] = await Promise.all([
    getAgentConfig(),
    kv.get<string | null>(SCHEDULE_KEY),
    kv.get<{ videoId: string; uploadedAt: string } | null>(LAST_UPLOAD_KEY),
    getGoogleProfile().catch(() => null)
  ]);

  let pendingCount = 0;
  try {
    if (config.driveFolderId) {
      const files = await listDriveVideos(config.driveFolderId, 50);
      pendingCount = files.length;
    }
  } catch {
    pendingCount = 0;
  }

  return {
    config: config ?? null,
    nextRunISO: scheduleIso || null,
    googleProfileEmail: googleProfile?.email ?? null,
    lastUploadedVideoId: lastUpload?.videoId ?? null,
    lastUploadAt: lastUpload?.uploadedAt ?? null,
    pendingCount
  };
}

async function markUpload(videoId: string, metadata: GeneratedMetadata) {
  const kv = getKV();
  const entry = {
    videoId,
    uploadedAt: new Date().toISOString(),
    title: metadata.title
  };
  await kv.set(LAST_UPLOAD_KEY, entry);
  await kv.lpush(UPLOAD_HISTORY_KEY, JSON.stringify(entry));
  await kv.ltrim(UPLOAD_HISTORY_KEY, 0, 49);
}

async function getRecentTitles(): Promise<string[]> {
  const kv = getKV();
  const items = await kv.lrange<string>(UPLOAD_HISTORY_KEY, 0, 9);
  const titles: string[] = [];
  items.forEach((json) => {
    try {
      const parsed = JSON.parse(json);
      if (parsed.title) {
        titles.push(parsed.title);
      }
    } catch {
      // ignore invalid entries
    }
  });
  return titles;
}

export async function runAgentOnce(): Promise<{
  success: boolean;
  reason?: string;
  metadata?: GeneratedMetadata;
  youtubeVideoId?: string;
}> {
  const config = await getAgentConfig();
  if (!config.driveFolderId) {
    return { success: false, reason: "Drive folder is not configured." };
  }

  await getAuthorizedClient();

  const driveFiles = await listDriveVideos(config.driveFolderId, 50);
  if (!driveFiles.length) {
    return { success: false, reason: "No videos available in the configured Drive folder." };
  }

  const nextFile = driveFiles[0];
  if (!nextFile.id) {
    return { success: false, reason: "Video file is missing an ID." };
  }

  const metadata = await generateVideoMetadata({
    context: config.metadataContext,
    historicalTitles: await getRecentTitles()
  });

  const { stream, mimeType } = await downloadDriveFile(nextFile.id);
  const youtubeVideo = await uploadVideoToYouTube({
    stream,
    title: metadata.title,
    description: metadata.description,
    tags: metadata.tags,
    privacyStatus: config.privacyStatus,
    notifySubscribers: config.notifySubscribers
  });

  if (!youtubeVideo.id) {
    throw new Error("YouTube did not return a video ID.");
  }

  await markUpload(youtubeVideo.id, metadata);
  await scheduleNextRun(config);

  const kv = getKV();
  await kv.hset(`agent:uploaded:${youtubeVideo.id}`, {
    driveFileId: nextFile.id,
    driveFileName: nextFile.name || "",
    mimeType: mimeType || "",
    title: metadata.title,
    createdAt: new Date().toISOString()
  });

  return {
    success: true,
    metadata,
    youtubeVideoId: youtubeVideo.id
  };
}
