(function startEditor() {
  let editor;

  async function mountEditor() {
    const status = document.getElementById("status");
    if (editor) {
      editor.destroyEditor();
      editor = undefined;
    }
    try {
      const response = await fetch("/api/editor-config");
      if (!response.ok) throw new Error(await response.text());
      const config = await response.json();

      config.events = {
        onDocumentReady() {
          status?.remove();
        },
        onError(event) {
          if (status) {
            status.textContent = `ONLYOFFICE error: ${
              event.data?.errorCode ?? "unknown"
            }`;
          }
        },
      };

      editor = new DocsAPI.DocEditor("editor", config);
      window.docEditor = editor;
    } catch (error) {
      if (status) {
        status.textContent =
          error instanceof Error ? error.message : "Failed to start ONLYOFFICE";
      }
    }
  }

  window.addEventListener("message", (event) => {
    if (
      event.origin === location.origin &&
      event.data?.type === "vespper:document-updated"
    ) {
      window.setTimeout(() => void mountEditor(), 250);
    }
  });

  void mountEditor();
})();
