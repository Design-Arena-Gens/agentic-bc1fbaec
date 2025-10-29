"use client";

import "./globals.css";
import { ReactNode } from "react";

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-slate-950 text-slate-100 min-h-screen">
        <div className="max-w-5xl mx-auto px-6 py-10">
          <header className="mb-10">
            <h1 className="text-4xl font-semibold tracking-tight text-white">
              DriveTube Agent
            </h1>
            <p className="text-slate-300 mt-2 max-w-2xl">
              Automate daily YouTube uploads from your curated Google Drive
              folder. Authorize your Google account, tune the AI narrator, and
              let the agent handle publishing, metadata, and scheduling.
            </p>
          </header>
          <main>{children}</main>
        </div>
      </body>
    </html>
  );
}
