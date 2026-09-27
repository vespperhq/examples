# Vespper ONLYOFFICE add-in

A local ONLYOFFICE Docs editor with the same Vespper chat experience as the
Microsoft Word example. It exports the active DOCX, sends it to the Vespper
agent, streams agent activity and edited DOCX revisions back into the editor,
supports selected-text context and pasted images, and preserves Vespper tracked
changes.

## Requirements

- Node.js 22.13 or newer
- Docker Desktop
- A Vespper API key
- An API key for the selected model

## Run locally

```bash
cd onlyoffice-add-in
cp .env.example .env
# Add VESPPER_API_KEY and OPENAI_API_KEY to .env
npm install
npm start
```

Open <http://localhost:3101>. The first Docker startup can take a few minutes.
The Vespper plugin starts automatically; click the **V** icon on the right if
its panel is collapsed.

Stop the editor with:

```bash
npm run stop
```

The current document is stored at `data/document.docx`. Delete that file while
the app is stopped to recreate the welcome document.

## How document updates work

The plugin calls ONLYOFFICE `GetFileToDownload("docx")` to export the active
file. The local server proxies that signed download URL and submits the DOCX to
Vespper. Each committed revision is persisted with a new document key and
loaded through ONLYOFFICE `refreshFile`. This updates the document without
recreating the editor or the Vespper plugin, so chat history remains visible
while document edits stream in.

This example is intentionally local and disables ONLYOFFICE JWT validation. Do
not expose it directly to a network. A production deployment should enable JWT,
authenticate the app routes, restrict the download proxy, and define a
multi-user document versioning strategy.
