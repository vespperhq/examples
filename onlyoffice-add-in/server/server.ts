import fs from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import express, { type Request, type Response } from "express";
import multer from "multer";
import { Document, Packer, Paragraph, TextRun } from "docx";
import {
  APP_DOCKER_URL,
  APP_PUBLIC_URL,
  AVAILABLE_MODELS,
  DEFAULT_MODEL,
  DOCX_AUTHOR,
  getModelApiKeyNames,
  hasModelApiKey,
  ONLYOFFICE_PUBLIC_URL,
  PLUGIN_GUID,
  PORT,
  ROOT_DIR,
  VESPPER_API_KEY,
  VESPPER_MCP_URL,
} from "./config";
import { runAgentTurn } from "./agent";
import { DocumentVersionGuard } from "./document-version";
import { parseChatMessages } from "./types";

const DOCX_TYPE =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const DATA_DIR = path.join(ROOT_DIR, "data");
const DOCUMENT_PATH = path.join(DATA_DIR, "document.docx");
const documentVersionGuard = new DocumentVersionGuard();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024, fieldSize: 128 * 1024 * 1024 },
});

async function ensureDocument() {
  await fs.mkdir(DATA_DIR, { recursive: true });
  try {
    await fs.access(DOCUMENT_PATH);
  } catch {
    const document = new Document({
      sections: [
        {
          children: [
            new Paragraph({
              children: [
                new TextRun({
                  text: "Welcome to Vespper for ONLYOFFICE",
                  bold: true,
                  size: 32,
                }),
              ],
            }),
            new Paragraph(
              "Open the Vespper panel on the right and describe the edits you want."
            ),
          ],
        },
      ],
    });
    await fs.writeFile(DOCUMENT_PATH, await Packer.toBuffer(document));
  }
}

async function documentKey() {
  const file = await fs.readFile(DOCUMENT_PATH);
  return createHash("sha256").update(file).digest("hex").slice(0, 32);
}

function documentServerUrl(raw: string) {
  const incoming = new URL(raw, ONLYOFFICE_PUBLIC_URL);
  const configured = new URL(ONLYOFFICE_PUBLIC_URL);
  const allowed = new Set([
    configured.hostname,
    "localhost",
    "127.0.0.1",
    "onlyoffice",
    "host.docker.internal",
  ]);
  if (!allowed.has(incoming.hostname)) {
    throw new Error("Refusing to fetch a non-ONLYOFFICE URL");
  }
  incoming.protocol = configured.protocol;
  incoming.hostname = configured.hostname;
  incoming.port = configured.port;
  return incoming;
}

async function fetchOnlyOfficeFile(raw: string) {
  const response = await fetch(documentServerUrl(raw));
  if (!response.ok) {
    throw new Error(`ONLYOFFICE download failed (${response.status})`);
  }
  return Buffer.from(await response.arrayBuffer());
}

const app = express();
app.use((_req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (_req.method === "OPTIONS") return res.sendStatus(204);
  next();
});
app.use(express.json({ limit: "2mb" }));

app.get("/health", (_req, res) => {
  res.json({
    ok: true,
    vespperConfigured: Boolean(VESPPER_API_KEY),
    agentConfigured: hasModelApiKey(DEFAULT_MODEL),
    agentModel: DEFAULT_MODEL,
    defaultModel: DEFAULT_MODEL,
    availableModels: AVAILABLE_MODELS,
    mcpUrl: VESPPER_MCP_URL,
    editor: "onlyoffice",
  });
});

app.get("/api/editor-config", async (_req, res) => {
  const key = await documentKey();
  res.json({
    document: {
      fileType: "docx",
      key,
      title: "Vespper document.docx",
      url: `${APP_DOCKER_URL}/document.docx?v=${key}`,
      permissions: {
        edit: true,
        download: true,
        review: true,
      },
    },
    documentType: "word",
    editorConfig: {
      callbackUrl: `${APP_DOCKER_URL}/api/onlyoffice/callback`,
      mode: "edit",
      user: { id: "local-user", name: "Local user" },
      customization: {
        autosave: true,
        forcesave: true,
      },
      plugins: {
        autostart: [PLUGIN_GUID],
        pluginsData: [`${APP_PUBLIC_URL}/plugin/config.json`],
      },
    },
    height: "100%",
    width: "100%",
    type: "desktop",
  });
});

app.get("/document.docx", async (_req, res) => {
  res.type(DOCX_TYPE).sendFile(DOCUMENT_PATH);
});

app.put(
  "/api/document",
  express.raw({ type: "*/*", limit: "50mb" }),
  async (req: Request, res: Response) => {
    const body = Buffer.isBuffer(req.body) ? req.body : Buffer.from(req.body);
    if (body.length < 512) {
      return res.status(400).send("Refusing to save an invalid DOCX");
    }
    documentVersionGuard.markReplaced(await documentKey());
    await fs.writeFile(DOCUMENT_PATH, body);
    return res.sendStatus(204);
  }
);

app.post("/api/onlyoffice/fetch", async (req, res) => {
  try {
    const body = await fetchOnlyOfficeFile(String(req.body?.url ?? ""));
    res.type(DOCX_TYPE).send(body);
  } catch (error) {
    res.status(502).send(error instanceof Error ? error.message : String(error));
  }
});

app.post("/api/onlyoffice/callback", async (req, res) => {
  try {
    if (
      [2, 6].includes(Number(req.body?.status)) &&
      req.body?.url &&
      documentVersionGuard.shouldSaveCallback(req.body?.key)
    ) {
      await fs.writeFile(
        DOCUMENT_PATH,
        await fetchOnlyOfficeFile(String(req.body.url))
      );
    }
    res.json({ error: 0 });
  } catch (error) {
    console.error("ONLYOFFICE callback failed:", error);
    res.json({ error: 1 });
  }
});

app.post(
  "/api/word/process",
  upload.single("file"),
  async (req: Request, res: Response) => {
    if (!VESPPER_API_KEY?.startsWith("sk_live_")) {
      return res.status(500).json({
        error: "Set a valid VESPPER_API_KEY in onlyoffice-add-in/.env.",
      });
    }
    if (!req.file?.buffer.length) {
      return res.status(400).json({ error: "Missing DOCX upload" });
    }

    let messages;
    try {
      messages = parseChatMessages(req.body.messages);
    } catch (error) {
      return res.status(400).json({
        error: error instanceof Error ? error.message : "Invalid messages",
      });
    }
    const model = String(req.body.model || DEFAULT_MODEL);
    if (!hasModelApiKey(model)) {
      return res.status(500).json({
        error: `Set ${getModelApiKeyNames(model).join(" or ")} for ${model}.`,
      });
    }

    res.setHeader("Content-Type", "application/x-ndjson; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    const controller = new AbortController();
    req.once("aborted", () => controller.abort());

    try {
      for await (const event of runAgentTurn({
        docBytes: req.file.buffer,
        messages,
        author: String(req.body.author || DOCX_AUTHOR),
        model,
        trackChanges: String(req.body.trackChanges ?? "true") === "true",
        mcpUrl: VESPPER_MCP_URL,
        apiKey: VESPPER_API_KEY,
        signal: controller.signal,
      })) {
        if (res.destroyed) break;
        res.write(
          `${JSON.stringify(event, (key, value) => {
            if (key === "html") return undefined;
            if (value instanceof Error) return value.message;
            return value;
          })}\n`
        );
      }
    } catch (error) {
      if (!controller.signal.aborted && !res.destroyed) {
        res.write(
          `${JSON.stringify({
            type: "error",
            detail: error instanceof Error ? error.message : String(error),
          })}\n`
        );
      }
    } finally {
      if (!res.destroyed) res.end();
    }
    return;
  }
);

app.use(
  "/plugin",
  express.static(path.join(ROOT_DIR, "plugin"), {
    etag: false,
    lastModified: false,
    setHeaders: (res) => res.setHeader("Cache-Control", "no-store"),
  })
);
app.use(express.static(path.join(ROOT_DIR, "public")));

await ensureDocument();
app.listen(PORT, () => {
  console.log(`Vespper ONLYOFFICE: ${APP_PUBLIC_URL}`);
  console.log(`ONLYOFFICE Docs: ${ONLYOFFICE_PUBLIC_URL}`);
});
