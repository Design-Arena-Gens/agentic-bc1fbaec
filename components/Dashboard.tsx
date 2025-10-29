"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import type { AgentConfig, AgentStatus } from "@/lib/agent";

type Props = {
  initialStatus: AgentStatus;
};

const DEFAULT_CONFIG: AgentConfig = {
  driveFolderId: "",
  dailyPublishTimeUTC: "15:00",
  privacyStatus: "private",
  notifySubscribers: false,
  metadataContext:
    "You are posting daily videos sourced from Google Drive. Craft SEO-friendly metadata with clear CTAs.",
  includeAutoChapters: false
};

export default function Dashboard({ initialStatus }: Props) {
  const [status, setStatus] = useState(initialStatus);
  const [config, setConfig] = useState<AgentConfig>(
    initialStatus.config ?? DEFAULT_CONFIG
  );
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const url = new URL(window.location.href);
    const connected = url.searchParams.get("connected");
    const err = url.searchParams.get("error");
    if (connected) {
      if (connected === "1") {
        setMessage("Google account connected successfully.");
      } else {
        setError(`Google connection failed: ${err ?? "Unknown error"}`);
      }
      url.searchParams.delete("connected");
      url.searchParams.delete("error");
      window.history.replaceState({}, "", url.toString());
    }
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      refreshStatus();
    }, 30_000);
    return () => clearInterval(interval);
  }, []);

  const refreshStatus = () => {
    fetch("/api/status")
      .then((res) => res.json())
      .then((data) => {
        setStatus(data);
        if (data.config) {
          setConfig(data.config);
        }
      })
      .catch(() => {});
  };

  const onSubmit: React.FormEventHandler<HTMLFormElement> = (event) => {
    event.preventDefault();
    startTransition(async () => {
      setError(null);
      setMessage(null);
      try {
        const res = await fetch("/api/config", {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify(config)
        });
        if (!res.ok) {
          const payload = await res.json();
          throw new Error(payload.error ? JSON.stringify(payload.error) : res.statusText);
        }
        setMessage("Agent configuration saved.");
        refreshStatus();
      } catch (err) {
        setError(String(err));
      }
    });
  };

  const triggerRun = () => {
    startTransition(async () => {
      setMessage(null);
      setError(null);
      const res = await fetch("/api/run", {
        method: "POST"
      });
      const payload = await res.json();
      if (!res.ok || !payload.success) {
        setError(payload.reason ?? "Failed to execute agent run.");
      } else {
        setMessage(`Uploaded video https://youtube.com/watch?v=${payload.youtubeVideoId}`);
      }
      refreshStatus();
    });
  };

  const nextRun = useMemo(() => {
    if (!status.nextRunISO) return null;
    const date = new Date(status.nextRunISO);
    return `${date.toUTCString()}`;
  }, [status.nextRunISO]);

  return (
    <div className="space-y-10">
      <section className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6 shadow-lg shadow-black/30 backdrop-blur">
        <h2 className="text-xl font-semibold text-white">Connection</h2>
        <p className="text-slate-300 mt-2">
          Connect the agent with a Google account that has access to your Drive
          folder and the YouTube channel you want to publish to.
        </p>
        <div className="mt-6 flex items-center justify-between rounded-xl border border-slate-800 bg-slate-900/60 px-4 py-3">
          <div>
            <p className="text-sm font-medium text-slate-200">Google OAuth</p>
            {status.googleProfileEmail ? (
              <p className="text-sm text-emerald-400">
                Connected as {status.googleProfileEmail}
              </p>
            ) : (
              <p className="text-sm text-slate-400">Not connected</p>
            )}
          </div>
          <button
            className="rounded-md bg-indigo-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-400"
            onClick={() => {
              window.location.href = "/api/google/auth";
            }}
          >
            {status.googleProfileEmail ? "Reconnect" : "Connect"}
          </button>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6 shadow-lg shadow-black/30 backdrop-blur">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold text-white">Daily Publishing</h2>
          <button
            className="rounded-md border border-indigo-400 px-3 py-1.5 text-sm font-medium text-indigo-200 transition hover:bg-indigo-500/20 disabled:opacity-50"
            onClick={triggerRun}
            disabled={isPending}
          >
            Post Next Video Now
          </button>
        </div>
        <p className="text-slate-300 mt-2">
          Choose the Drive folder that contains your ready-to-upload videos and
          schedule the daily posting cadence.
        </p>

        <form className="mt-6 space-y-6" onSubmit={onSubmit}>
          <div>
            <label className="text-sm font-medium text-slate-200">
              Google Drive Folder ID
            </label>
            <input
              type="text"
              className="mt-2 w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/40"
              placeholder="e.g. 1aBcDEfgHIjkLmnOp"
              value={config.driveFolderId}
              onChange={(event) =>
                setConfig((prev) => ({ ...prev, driveFolderId: event.target.value }))
              }
              required
            />
            <p className="text-xs text-slate-500 mt-1">
              The folder containing MP4/MOV files the agent should upload.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div>
              <label className="text-sm font-medium text-slate-200">
                Publish Time (UTC)
              </label>
              <input
                type="time"
                className="mt-2 w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/40"
                value={config.dailyPublishTimeUTC}
                onChange={(event) =>
                  setConfig((prev) => ({
                    ...prev,
                    dailyPublishTimeUTC: event.target.value
                  }))
                }
                required
              />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-200">Privacy</label>
              <select
                className="mt-2 w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/40"
                value={config.privacyStatus}
                onChange={(event) =>
                  setConfig((prev) => ({
                    ...prev,
                    privacyStatus: event.target.value as AgentConfig["privacyStatus"]
                  }))
                }
              >
                <option value="private">Private</option>
                <option value="unlisted">Unlisted</option>
                <option value="public">Public</option>
              </select>
            </div>
            <div className="flex items-end space-x-2">
              <input
                type="checkbox"
                id="notifySubscribers"
                className="h-4 w-4 rounded border border-slate-600 bg-slate-950 accent-indigo-500"
                checked={config.notifySubscribers}
                onChange={(event) =>
                  setConfig((prev) => ({
                    ...prev,
                    notifySubscribers: event.target.checked
                  }))
                }
              />
              <label
                htmlFor="notifySubscribers"
                className="text-sm font-medium text-slate-200"
              >
                Notify subscribers
              </label>
            </div>
          </div>

          <div>
            <label className="text-sm font-medium text-slate-200">
              Metadata Prompt
            </label>
            <textarea
              className="mt-2 w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/40"
              rows={5}
              value={config.metadataContext}
              onChange={(event) =>
                setConfig((prev) => ({
                  ...prev,
                  metadataContext: event.target.value
                }))
              }
              required
            />
            <p className="text-xs text-slate-500 mt-1">
              Guide the AI assistant on how to position your videos, keywords to
              hit, and any call-to-action.
            </p>
          </div>

          <div className="flex items-center space-x-3">
            <input
              type="checkbox"
              id="autoChapters"
              className="h-4 w-4 rounded border border-slate-600 bg-slate-950 accent-indigo-500"
              checked={config.includeAutoChapters}
              onChange={(event) =>
                setConfig((prev) => ({
                  ...prev,
                  includeAutoChapters: event.target.checked
                }))
              }
            />
            <label htmlFor="autoChapters" className="text-sm text-slate-300">
              Generate chapter markers automatically
            </label>
          </div>

          <button
            type="submit"
            className="w-full rounded-md bg-indigo-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-400 disabled:opacity-50"
            disabled={isPending}
          >
            {isPending ? "Saving…" : "Save Configuration"}
          </button>
        </form>
      </section>

      <section className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6 shadow-lg shadow-black/30 backdrop-blur">
        <h2 className="text-xl font-semibold text-white">Automation Status</h2>
        <dl className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="rounded-xl border border-slate-800 bg-slate-950 px-4 py-3">
            <dt className="text-sm text-slate-400">Next scheduled upload</dt>
            <dd className="mt-1 text-sm font-medium text-white">
              {nextRun ?? "Not scheduled"}
            </dd>
          </div>
          <div className="rounded-xl border border-slate-800 bg-slate-950 px-4 py-3">
            <dt className="text-sm text-slate-400">Pending videos</dt>
            <dd className="mt-1 text-2xl font-semibold text-white">
              {status.pendingCount}
            </dd>
          </div>
          <div className="rounded-xl border border-slate-800 bg-slate-950 px-4 py-3">
            <dt className="text-sm text-slate-400">Last upload</dt>
            <dd className="mt-1 text-sm font-medium text-white">
              {status.lastUploadAt ? new Date(status.lastUploadAt).toUTCString() : "—"}
            </dd>
          </div>
        </dl>
      </section>

      {(message || error) && (
        <section className="rounded-2xl border border-slate-800 bg-slate-900/40 p-4 text-sm">
          {message && <p className="text-emerald-400">{message}</p>}
          {error && <p className="text-rose-400">{error}</p>}
        </section>
      )}
    </div>
  );
}
