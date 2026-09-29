// Keep all active AI workloads on the same reviewed model configuration.
export const AI_MODELS = {
  text: "gpt-6-luna",
  transcription: "gpt-transcribe",
} as const;

// Responses workloads previously used minimal reasoning; GPT-6 supports low.
export const TEXT_REASONING_EFFORT = "low" as const;
// Preserve the chat latency baseline of the previous non-reasoning model.
export const CHAT_REASONING_EFFORT = "none" as const;
