export const SUPPORTED_IMAGE_MIME_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
] as const;
export const MAX_IMAGES_PER_MESSAGE = 6;
export const MAX_IMAGE_BYTES = 4 * 1024 * 1024;

export type UserMessagePart =
  | { type: "text"; text: string }
  | {
      type: "image";
      image: string;
      mimeType: (typeof SUPPORTED_IMAGE_MIME_TYPES)[number];
    };

export type ChatMessage =
  | { role: "user"; content: string | UserMessagePart[] }
  | { role: "assistant"; content: string };
