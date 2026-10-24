// Token Factory client — OpenAI-compatible SDK pointed at Nebius Token Factory.
// Reads TF_BASE_URL and TF_API_KEY from the environment; fails fast if missing.

import OpenAI from "openai";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Missing required environment variable: ${name}. Copy .env.example to .env and fill in the values.`
    );
  }
  return value;
}

let _client: OpenAI | null = null;

export function getTokenFactoryClient(): OpenAI {
  if (_client) return _client;

  const apiKey = requireEnv("TF_API_KEY");
  const baseURL = requireEnv("TF_BASE_URL");

  _client = new OpenAI({
    apiKey,
    baseURL,
    timeout: 30_000, // 30s per-call timeout
    maxRetries: 2,
  });

  return _client;
}

export const Models = {
  get NANO(): string {
    return requireEnv("MODEL_NANO");
  },
  get SUPER(): string {
    return requireEnv("MODEL_SUPER");
  },
  get ULTRA(): string {
    return requireEnv("MODEL_ULTRA");
  },
} as const;
