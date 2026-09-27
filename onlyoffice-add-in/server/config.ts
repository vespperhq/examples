import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

export const ROOT_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  ".."
);
dotenv.config({ path: path.join(ROOT_DIR, ".env") });

export const PORT = Number(process.env.PORT ?? 3101);
export const ONLYOFFICE_PUBLIC_URL =
  process.env.ONLYOFFICE_PUBLIC_URL ?? "http://localhost:8080";
export const APP_PUBLIC_URL =
  process.env.APP_PUBLIC_URL ?? `http://localhost:${PORT}`;
export const APP_DOCKER_URL =
  process.env.APP_DOCKER_URL ?? `http://host.docker.internal:${PORT}`;
export const VESPPER_API_KEY = process.env.VESPPER_API_KEY ?? "";
export const VESPPER_MCP_URL = (
  process.env.VESPPER_MCP_URL ?? "https://mcp.vespper.com/mcp"
).replace(/\/+$/, "");
export const DOCX_AUTHOR = process.env.DOCX_AUTHOR ?? "Vespper Agent";
export const DEFAULT_MODEL =
  process.env.ONLYOFFICE_AGENT_MODEL ??
  process.env.WORD_AGENT_MODEL ??
  "openai/gpt-5.6-sol";
export const REASONING_EFFORT =
  process.env.AGENT_REASONING_EFFORT ?? "medium";
export const REASONING_SUMMARY =
  process.env.AGENT_REASONING_SUMMARY ?? "detailed";
export const MAX_ROUNDS = 24;
export const PLUGIN_GUID = "asc.{A79D9B7A-2BFA-4EB1-A4C5-7EAD5B6F80D1}";
export const AVAILABLE_MODELS = [
  "openai/gpt-5.6-sol",
  "openai/gpt-5.5",
  "anthropic/claude-sonnet-4.5",
  "google/gemini-2.5-flash",
  "google/gemini-2.5-pro",
];

export const META_AUTHOR = "com.vespper/author";
export const META_TRACK_CHANGES = "com.vespper/track-changes";
export const META_SESSION_ID = "com.vespper/session-id";
export const META_BATCH_ID = "com.vespper/batch-id";
export const META_EDIT_INDEX = "com.vespper/edit-index";

export function getModelApiKeyNames(model: string): string[] {
  const provider = model.includes("/") ? model.split("/", 1)[0] : "";
  if (provider === "openai") return ["OPENAI_API_KEY"];
  if (provider === "anthropic") return ["ANTHROPIC_API_KEY"];
  if (provider === "google") {
    return ["GOOGLE_API_KEY", "GOOGLE_GENERATIVE_AI_API_KEY"];
  }
  return [];
}

export function hasModelApiKey(model: string): boolean {
  return getModelApiKeyNames(model).some((name) => Boolean(process.env[name]));
}
