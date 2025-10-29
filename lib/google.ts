import { google, oauth2_v2 } from "googleapis";
import { Readable } from "stream";
import { getKV } from "./kv";
import { getEnv } from "./env";

export type StoredGoogleTokens = {
  access_token: string;
  refresh_token: string;
  scope: string;
  token_type: string;
  expiry_date: number;
};

const TOKEN_KEY = "agent:google:tokens";

export function getOAuthClient() {
  const env = getEnv();
  return new google.auth.OAuth2(
    env.GOOGLE_CLIENT_ID,
    env.GOOGLE_CLIENT_SECRET,
    env.GOOGLE_REDIRECT_URI
  );
}

export async function storeTokens(tokens: StoredGoogleTokens) {
  const kv = getKV();
  await kv.set(TOKEN_KEY, tokens);
}

export async function getTokens(): Promise<StoredGoogleTokens | null> {
  const kv = getKV();
  const tokens = await kv.get<StoredGoogleTokens>(TOKEN_KEY);
  return tokens || null;
}

export async function revokeTokens() {
  const client = getOAuthClient();
  const tokens = await getTokens();
  if (!tokens) return;
  client.setCredentials(tokens);
  if (tokens.refresh_token) {
    await client.revokeToken(tokens.refresh_token);
  }
  if (tokens.access_token) {
    await client.revokeToken(tokens.access_token);
  }
  const kv = getKV();
  await kv.del(TOKEN_KEY);
}

export async function getAuthorizedClient() {
  const client = getOAuthClient();
  const tokens = await getTokens();
  if (!tokens) {
    throw new Error("Google OAuth tokens are not stored yet.");
  }
  client.setCredentials(tokens);
  const currentTokens = await client.getAccessToken();
  if (!currentTokens.token) {
    throw new Error("Unable to refresh Google access token.");
  }
  const refreshed = client.credentials;
  if (refreshed && refreshed.expiry_date && refreshed.access_token) {
    await storeTokens({
      access_token: refreshed.access_token,
      refresh_token: refreshed.refresh_token || tokens.refresh_token,
      scope: refreshed.scope || tokens.scope,
      token_type: refreshed.token_type || tokens.token_type,
      expiry_date: refreshed.expiry_date
    });
  }
  return client;
}

export function buildAuthUrl(scopes: string[]) {
  const client = getOAuthClient();
  return client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: scopes
  });
}

export async function exchangeCodeForTokens(code: string) {
  const client = getOAuthClient();
  const { tokens } = await client.getToken(code);
  if (!tokens.refresh_token) {
    throw new Error("Google did not return a refresh token. Ensure access_type=offline.");
  }
  await storeTokens({
    access_token: tokens.access_token!,
    refresh_token: tokens.refresh_token,
    scope: tokens.scope || "",
    token_type: tokens.token_type || "Bearer",
    expiry_date: tokens.expiry_date || Date.now()
  });
  return tokens;
}

export async function getGoogleProfile(): Promise<oauth2_v2.Schema$Userinfo | null> {
  const client = await getAuthorizedClient();
  const oauth2 = google.oauth2({
    auth: client,
    version: "v2"
  });
  const { data } = await oauth2.userinfo.get();
  return data;
}

export async function listDriveVideos(folderId: string, maxResults = 10) {
  const client = await getAuthorizedClient();
  const drive = google.drive({ version: "v3", auth: client });
  const { data } = await drive.files.list({
    q: `'${folderId}' in parents and trashed = false and mimeType contains 'video/'`,
    orderBy: "createdTime asc",
    fields: "files(id, name, mimeType, videoMediaMetadata, createdTime, size)",
    pageSize: maxResults
  });
  return data.files ?? [];
}

export async function downloadDriveFile(
  fileId: string
): Promise<{ stream: Readable; mimeType?: string; fileName?: string }> {
  const client = await getAuthorizedClient();
  const drive = google.drive({ version: "v3", auth: client });
  const res = await drive.files.get(
    {
      fileId,
      alt: "media"
    },
    { responseType: "stream" }
  );

  const meta = await drive.files.get({
    fileId,
    fields: "name, mimeType"
  });

  return {
    stream: res.data as unknown as Readable,
    mimeType: meta.data.mimeType || undefined,
    fileName: meta.data.name || undefined
  };
}

export async function uploadVideoToYouTube(options: {
  stream: Readable;
  title: string;
  description: string;
  tags: string[];
  privacyStatus: "private" | "public" | "unlisted";
  notifySubscribers: boolean;
}) {
  const client = await getAuthorizedClient();
  const youtube = google.youtube({
    version: "v3",
    auth: client
  });

  const { data } = await youtube.videos.insert({
    part: ["snippet", "status"],
    requestBody: {
      snippet: {
        title: options.title,
        description: options.description,
        tags: options.tags
      },
      status: {
        privacyStatus: options.privacyStatus,
        selfDeclaredMadeForKids: false
      }
    },
    media: {
      body: options.stream
    },
    notifySubscribers: options.notifySubscribers
  });

  return data;
}
