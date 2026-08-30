import OpenAI from "openai";

/**
 * AI client for the EcoBot tutor + summarizer.
 *
 * We talk to Google Gemini through its OpenAI-compatible endpoint, so the rest
 * of the codebase can keep using the familiar `openai.chat.completions.create(...)`
 * shape with no changes. Only three things differ from real OpenAI:
 *   1. baseURL points at Gemini's compat endpoint
 *   2. the API key is a Gemini key (from Google AI Studio)
 *   3. the model strings are Gemini model IDs (see TUTOR_MODEL below)
 *
 * Env vars (either name works, so nothing else in the monorepo breaks):
 *   GEMINI_API_KEY                     — preferred
 *   AI_INTEGRATIONS_OPENAI_API_KEY     — legacy fallback
 *   GEMINI_BASE_URL                    — optional override
 *   AI_INTEGRATIONS_OPENAI_BASE_URL    — legacy fallback
 */

const DEFAULT_GEMINI_BASE_URL =
  "https://generativelanguage.googleapis.com/v1beta/openai/";

const apiKey =
  process.env.GEMINI_API_KEY ?? process.env.AI_INTEGRATIONS_OPENAI_API_KEY;

const baseURL =
  process.env.GEMINI_BASE_URL ??
  process.env.AI_INTEGRATIONS_OPENAI_BASE_URL ??
  DEFAULT_GEMINI_BASE_URL;

if (!apiKey) {
  throw new Error(
    "GEMINI_API_KEY must be set. Create a Gemini API key at https://aistudio.google.com/apikey and add it to your environment (e.g. .env or your host's secrets).",
  );
}

export const openai = new OpenAI({
  apiKey,
  baseURL,
});

/**
 * Central place to change the model. If gemini-3.6-flash ever misbehaves for
 * this use case, set GEMINI_MODEL in the environment to try another (e.g.
 * "gemini-3.5-flash") without touching any route code.
 *
 * gemini-3.6-flash: current stable GA Flash model — fast, cheap, and tuned to
 * be less verbose, which suits short kid-friendly tutor replies.
 */
export const TUTOR_MODEL = process.env.GEMINI_MODEL ?? "gemini-3.6-flash";
