import OpenAI from "openai";
import { getEnv } from "./env";

let cached: OpenAI | null = null;

export function getOpenAIClient() {
  if (cached) return cached;
  const env = getEnv();
  cached = new OpenAI({
    apiKey: env.OPENAI_API_KEY
  });
  return cached;
}

export type GeneratedMetadata = {
  title: string;
  description: string;
  tags: string[];
};

export async function generateVideoMetadata(input: {
  context: string;
  transcript?: string;
  historicalTitles: string[];
}) {
  const client = getOpenAIClient();
  const messageText = `
You are an AI YouTube strategist. Generate a JSON object with engaging metadata.
Context: ${input.context}
Recent titles: ${input.historicalTitles.join(" | ") || "None"}
Transcript snippet: ${input.transcript || "Not available"}

Requirements:
- JSON with keys: "title", "description", "tags"
- "tags" must be an array of lowercase strings (<= 15)
- Title <= 95 characters
`.trim();

  const completion = await client.chat.completions.create({
    model: "gpt-4o-mini",
    temperature: 0.4,
    messages: [
      { role: "system", content: "You are a YouTube growth strategist." },
      { role: "user", content: messageText }
    ]
  });

  const message =
    completion.choices[0]?.message?.content?.toString().trim() ?? "{}";
  try {
    const parsed = JSON.parse(message) as GeneratedMetadata;
    return {
      title: parsed.title.slice(0, 95),
      description: parsed.description,
      tags: parsed.tags.slice(0, 15)
    };
  } catch (error) {
    throw new Error(`Failed to parse OpenAI metadata response: ${message}`);
  }
}
