const METHOD_TIMEOUT_MS = 60_000;

function executeMethod<T>(name: string, params: unknown[]): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(
      () => reject(new Error(`${name} timed out after ${METHOD_TIMEOUT_MS}ms`)),
      METHOD_TIMEOUT_MS
    );

    const started = Asc.plugin.executeMethod(name, params, (result: T) => {
      window.clearTimeout(timer);
      resolve(result);
    });
    if (!started) {
      window.clearTimeout(timer);
      reject(new Error(`ONLYOFFICE rejected ${name}`));
    }
  });
}

export function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes.buffer;
}

export async function getDocumentBytes(): Promise<Uint8Array<ArrayBuffer>> {
  const downloadUrl = await executeMethod<string>("GetFileToDownload", [
    "docx",
  ]);
  if (!downloadUrl) {
    throw new Error("ONLYOFFICE did not return a DOCX download URL");
  }

  const response = await fetch("/api/onlyoffice/fetch", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url: downloadUrl }),
  });
  if (!response.ok) throw new Error(await response.text());
  return new Uint8Array(await response.arrayBuffer());
}

export async function getTrackChanges(): Promise<boolean> {
  return new Promise((resolve) => {
    Asc.plugin.callCommand(
      () => Api.GetDocument().IsTrackRevisions(),
      false,
      false,
      (result) => resolve(Boolean(result))
    );
  });
}

export async function applyDocxToWord(
  data: ArrayBuffer | Uint8Array
): Promise<void> {
  const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
  const upload = Uint8Array.from(bytes).buffer;

  const saved = await fetch("/api/document", {
    method: "PUT",
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    },
    body: upload,
  });
  if (!saved.ok) throw new Error(await saved.text());

  window.top?.postMessage({ type: "vespper:document-updated" }, location.origin);
}
