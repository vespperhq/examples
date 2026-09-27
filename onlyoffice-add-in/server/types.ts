import { z } from "zod";
import {
  MAX_IMAGE_BYTES,
  MAX_IMAGES_PER_MESSAGE,
  SUPPORTED_IMAGE_MIME_TYPES,
  type ChatMessage,
} from "./messages";

export type { ChatMessage } from "./messages";

const ImageSchema = z.string().superRefine((value, context) => {
  const payload = Buffer.from(value, "base64");
  if (!payload.length || payload.toString("base64") !== value) {
    context.addIssue({ code: "custom", message: "invalid image base64" });
  } else if (payload.length > MAX_IMAGE_BYTES) {
    context.addIssue({ code: "custom", message: "image is too large" });
  }
});

const PartSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("text"), text: z.string().trim().min(1) }),
  z.object({
    type: z.literal("image"),
    image: ImageSchema,
    mimeType: z.enum(SUPPORTED_IMAGE_MIME_TYPES),
  }),
]);

const MessageSchema = z.discriminatedUnion("role", [
  z.object({
    role: z.literal("user"),
    content: z.union([
      z.string().trim().min(1),
      z.array(PartSchema).min(1).refine(
        (parts) =>
          parts.filter((part) => part.type === "image").length <=
          MAX_IMAGES_PER_MESSAGE,
        "too many images"
      ),
    ]),
  }),
  z.object({
    role: z.literal("assistant"),
    content: z.string().trim().min(1),
  }),
]);

export function parseChatMessages(raw: unknown): ChatMessage[] {
  if (typeof raw !== "string" || !raw.trim()) return [];
  const parsed = z.array(MessageSchema).safeParse(JSON.parse(raw));
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "invalid messages");
  }
  return parsed.data;
}

export const EditPairSchema = z.object({
  old: z.string(),
  new: z.string().default(""),
});
export type EditPair = z.infer<typeof EditPairSchema>;

export const DocumentSessionSchema = z
  .object({
    session_id: z.string().min(1),
    current_revision: z.number().int().nonnegative(),
  })
  .transform(({ session_id, current_revision }) => ({
    id: session_id,
    revision: current_revision,
  }));

export const CommittedDocumentSchema = z
  .object({
    ok: z.literal(true),
    base64: z.string().min(1),
    current_revision: z.number().int().nonnegative(),
    count: z.number().nonnegative().default(0),
  })
  .transform(({ base64, current_revision, count }) => ({
    base64,
    revision: current_revision,
    count,
  }));

export interface EditInputParser {
  readonly ended: boolean;
  write(delta: string): void;
  finish(): void;
}

export interface RunAgentTurnOptions {
  docBytes: Buffer;
  messages: ChatMessage[];
  author: string;
  mcpUrl: string;
  apiKey: string;
  trackChanges: boolean;
  model?: string;
  signal?: AbortSignal;
}
