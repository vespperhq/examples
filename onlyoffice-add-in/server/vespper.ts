import { DocumentSessionSchema } from "./types";

const DOCX_TYPE =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

async function responseError(response: Response, action: string) {
  const detail = await response.text();
  return new Error(
    `${action} failed (${response.status})${detail ? `: ${detail}` : ""}`
  );
}

export async function openDocumentSession(options: {
  mcpUrl: string;
  apiKey: string;
  document: Buffer;
  signal?: AbortSignal;
}) {
  const body = Uint8Array.from(options.document).buffer;
  const response = await fetch(new URL("/v1/docx/sessions", options.mcpUrl), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${options.apiKey}`,
      "Content-Type": DOCX_TYPE,
    },
    body,
    signal: options.signal,
  });
  if (!response.ok) throw await responseError(response, "Opening session");
  return DocumentSessionSchema.parse(await response.json());
}

export async function closeDocumentSession(options: {
  mcpUrl: string;
  apiKey: string;
  sessionId: string;
}) {
  const response = await fetch(
    new URL(
      `/v1/docx/sessions/${encodeURIComponent(options.sessionId)}`,
      options.mcpUrl
    ),
    {
      method: "DELETE",
      headers: { Authorization: `Bearer ${options.apiKey}` },
    }
  );
  if (!response.ok && response.status !== 404) {
    throw await responseError(response, "Closing session");
  }
}
