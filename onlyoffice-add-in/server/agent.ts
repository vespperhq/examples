import { randomUUID } from "node:crypto";
import { PassThrough, Readable } from "node:stream";
import { finished } from "node:stream/promises";
import { Agent } from "@mastra/core/agent";
import { createTool } from "@mastra/core/tools";
import { MCPClient } from "@mastra/mcp";
import {
  DEFAULT_MODEL,
  MAX_ROUNDS,
  META_AUTHOR,
  META_BATCH_ID,
  META_EDIT_INDEX,
  META_SESSION_ID,
  META_TRACK_CHANGES,
  REASONING_EFFORT,
  REASONING_SUMMARY,
} from "./config";
import { createEditInputParser } from "./edit-input";
import { closeDocumentSession, openDocumentSession } from "./vespper";
import {
  CommittedDocumentSchema,
  type EditInputParser,
  type EditPair,
  type RunAgentTurnOptions,
} from "./types";

const SYSTEM_PROMPT = `You are a DOCX editing assistant. You will receive an existing document and a natural-language instruction.
Edit the existing document through edit_document. Do not regenerate it. Preserve formatting, styles, tables, numbering, headers, footers, images, and unrelated content. Make the smallest edits that satisfy the instruction.`;

export async function* runAgentTurn(options: RunAgentTurnOptions) {
  const session = await openDocumentSession({
    mcpUrl: options.mcpUrl,
    apiKey: options.apiKey,
    document: options.docBytes,
    signal: options.signal,
  });
  const mcp = new MCPClient({
    id: randomUUID(),
    servers: {
      vespperDocx: {
        url: new URL(options.mcpUrl),
        requestInit: {
          headers: { Authorization: `Bearer ${options.apiKey}` },
        },
      },
    },
  });

  try {
    const tools: any = await mcp.listTools();
    const mcpRead = tools.vespperDocx_read_document;
    const mcpSearch = tools.vespperDocx_search_document;
    const mcpEdit = tools.vespperDocx_edit_document;
    if (!mcpRead || !mcpSearch || !mcpEdit) {
      throw new Error("Vespper did not advertise the required DOCX tools");
    }

    let latestBase64 = options.docBytes.toString("base64");
    let latestRevision = session.revision;
    let editCount = 0;
    const output = new PassThrough({ objectMode: true });
    const childCalls: Promise<void>[] = [];
    let activeInput:
      | { batchId: string; parser: EditInputParser }
      | undefined;

    function publishDocument(value: unknown) {
      const parsed = CommittedDocumentSchema.safeParse(value);
      if (!parsed.success) return undefined;
      const document = parsed.data;
      if (document.revision <= latestRevision) return document;
      latestRevision = document.revision;
      latestBase64 = document.base64;
      return document;
    }

    function sendEdit(
      toolCallId: string,
      abortSignal: AbortSignal | undefined,
      index: number,
      edit: EditPair
    ) {
      childCalls.push(
        mcpEdit
          .execute(
            { edits: [edit] },
            {
              _meta: {
                [META_SESSION_ID]: session.id,
                [META_BATCH_ID]: toolCallId,
                [META_EDIT_INDEX]: index,
                [META_AUTHOR]: options.author,
                [META_TRACK_CHANGES]: options.trackChanges,
              },
              abortSignal,
            }
          )
          .then((result: unknown) => void publishDocument(result))
          .catch(() => undefined)
      );
    }

    const sessionMeta = { [META_SESSION_ID]: session.id };
    const readDocument = createTool({
      id: "read_document",
      description: mcpRead.description,
      inputSchema: mcpRead.inputSchema,
      execute: async (input, context) =>
        mcpRead.execute(input, {
          _meta: sessionMeta,
          abortSignal: context.abortSignal,
        }),
    });
    const searchDocument = createTool({
      id: "search_document",
      description: mcpSearch.description,
      inputSchema: mcpSearch.inputSchema,
      execute: async (input, context) =>
        mcpSearch.execute(input, {
          _meta: sessionMeta,
          abortSignal: context.abortSignal,
        }),
    });
    const editDocument = createTool({
      id: "edit_document",
      description: mcpEdit.description,
      inputSchema: mcpEdit.inputSchema,
      onInputStart: ({ toolCallId, abortSignal }) => {
        if (activeInput && !activeInput.parser.ended) {
          throw new Error("Parallel edit_document calls are unsupported");
        }
        activeInput = {
          batchId: toolCallId,
          parser: createEditInputParser({
            onEdit: sendEdit.bind(null, toolCallId, abortSignal),
            onError: () => {
              if (activeInput?.batchId === toolCallId) activeInput = undefined;
            },
          }),
        };
      },
      onInputDelta: ({ toolCallId, inputTextDelta }) => {
        if (activeInput?.batchId !== toolCallId) return;
        activeInput.parser.write(inputTextDelta);
      },
      onInputAvailable: ({ toolCallId }) => {
        if (activeInput?.batchId !== toolCallId) return;
        activeInput.parser.finish();
        activeInput = undefined;
      },
      execute: async (input, context) => {
        const batchId = context.agent?.toolCallId;
        if (!batchId) throw new Error("edit_document has no tool call ID");
        await Promise.allSettled([...childCalls]);
        const raw = await mcpEdit.execute(input, {
          _meta: {
            [META_SESSION_ID]: session.id,
            [META_BATCH_ID]: batchId,
            [META_AUTHOR]: options.author,
            [META_TRACK_CHANGES]: options.trackChanges,
          },
          abortSignal: context.abortSignal,
        });
        const committed = publishDocument(raw);
        if (committed) editCount += committed.count;
        if (!raw || typeof raw !== "object") return raw;
        const { base64: _base64, ...modelResult } = raw as Record<
          string,
          unknown
        >;
        return modelResult;
      },
    });

    const agent = new Agent({
      id: "onlyoffice-editor",
      name: "ONLYOFFICE Editor",
      instructions: SYSTEM_PROMPT,
      model: options.model || DEFAULT_MODEL,
      tools: {
        read_document: readDocument,
        search_document: searchDocument,
        edit_document: editDocument,
      },
    });
    const stream = await agent.stream(options.messages, {
      maxSteps: MAX_ROUNDS,
      abortSignal: options.signal,
      providerOptions: {
        openai: {
          reasoningSummary: REASONING_SUMMARY,
          reasoningEffort: REASONING_EFFORT,
        },
      },
    });
    const modelOutput = Readable.from(stream.fullStream, {
      objectMode: true,
    });
    modelOutput.pipe(output, { end: false });

    const completion = (async () => {
      try {
        await finished(modelOutput);
        await Promise.allSettled(childCalls);
        output.end({
          type: "done",
          docx_b64: latestBase64,
          edit_count: editCount,
        });
      } catch (error) {
        output.destroy(
          error instanceof Error ? error : new Error(String(error))
        );
      }
    })();

    for await (const event of output) yield event;
    await completion;
  } finally {
    await closeDocumentSession({
      mcpUrl: options.mcpUrl,
      apiKey: options.apiKey,
      sessionId: session.id,
    }).catch(console.error);
    await mcp.disconnect();
  }
}
