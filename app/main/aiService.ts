/**
 * AI Service for Axis Pro
 * @mem ref: pr17-ai-shorts
 * Provides secure access to OpenAI API (Whisper & GPT)
 * This module runs ONLY in the main process (Node.js context)
 * NEVER expose the API key or this client to the renderer process
 */

import OpenAI from "openai";

/**
 * OpenAI client instance
 * Initialized with API key from environment variable
 */
let openai: OpenAI | null = null;

/**
 * Initialize the OpenAI client
 * Must be called after dotenv.config() loads environment variables
 * @throws Error if OPENAI_API_KEY is not set
 */
export function initializeOpenAI(): void {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    console.error("[AI Service] OPENAI_API_KEY not found in environment");
    throw new Error(
      "OPENAI_API_KEY not found. Please add it to your .env file."
    );
  }

  openai = new OpenAI({
    apiKey: apiKey,
  });

  console.log("[AI Service] OpenAI client initialized successfully");
}

/**
 * Get the OpenAI client instance
 * @throws Error if client is not initialized
 */
export function getOpenAI(): OpenAI {
  if (!openai) {
    throw new Error(
      "OpenAI client not initialized. Call initializeOpenAI() first."
    );
  }
  return openai;
}

/**
 * Check if OpenAI client is ready
 */
export function isOpenAIReady(): boolean {
  return openai !== null;
}
