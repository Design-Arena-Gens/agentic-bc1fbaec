# DriveTube Agent

DriveTube Agent automates daily YouTube uploads from a curated Google Drive folder. Authenticate once, define your publishing window, and let the agent pull fresh videos, generate metadata with AI, and publish to your channel every day.

## Features

- OAuth handshake with Google Drive and YouTube scopes
- Configurable Drive folder, daily UTC publish time, visibility, and subscriber notifications
- AI-generated titles, descriptions, and tag sets powered by OpenAI
- On-demand manual run plus Vercel Cron integration for unattended scheduling
- Status dashboard with connection health, pending queue, and last upload summary

## Getting Started

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment

Create `.env.local` (and set the same values in your Vercel project):

```
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
GOOGLE_REDIRECT_URI=https://agentic-bc1fbaec.vercel.app/api/google/callback
OPENAI_API_KEY=sk-xxx
YOUTUBE_CHANNEL_ID=UCxxxxxxxxxxxxxxxx
KV_REST_API_URL=your_vercel_kv_rest_url
KV_REST_API_TOKEN=your_vercel_kv_rest_token
KV_REST_API_READ_ONLY_TOKEN=your_vercel_kv_ro_token
```

You must provision a Vercel KV database and connect it to the project to persist OAuth tokens, schedules, and upload history.

### 3. Run locally

```bash
npm run dev
```

Visit `http://localhost:3000`, connect your Google account, and configure the Drive folder and publishing rules.

### 4. Production deploy

The project is optimized for Vercel. The included `vercel.json` schedules the `/api/cron/publish` route daily at 15:00 UTC. Adjust the cron expression if you prefer a different cadence.

```bash
vercel deploy --prod --yes --token $VERCEL_TOKEN --name agentic-bc1fbaec
```

After deployment, confirm:

```bash
curl https://agentic-bc1fbaec.vercel.app
```

## Architecture Overview

- **Next.js 14 / App Router** for UI, API routes, and server actions
- **Tailwind CSS** for styling
- **@vercel/kv** for durable state
- **googleapis** SDK to pull Drive assets and upload to YouTube
- **OpenAI** SDK to synthesize channel-optimized metadata

The scheduled worker selects the next video from your Drive folder, generates metadata, uploads to YouTube with the configured privacy settings, and records progress so each asset posts exactly once.

## Manual override

From the dashboard use **Post Next Video Now** to immediately run the agent. The same route backs the cron job, so manual runs mirror automated behavior and log identical telemetry.

## Notes

- The YouTube account must grant `youtube.upload` scope and the Drive account must have read access to the configured folder.
- Ensure the OAuth consent screen is published (External or Internal) for the Google Cloud project tied to your credentials.
- Large uploads rely on streaming from Drive; make sure your Vercel plan supports the expected payload sizes, or consider preprocessing/encoding files.
- OpenAI usage incurs standard API costs; tweak the prompt or swap models to balance quality and spend.
