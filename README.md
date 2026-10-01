<p align="center">
  <img src="https://raw.githubusercontent.com/vespperhq/word-add-in/main/assets/vespper-cat.svg" alt="Vespper" width="160">
</p>

# Vespper Examples

Complete examples for building document-editing agents with Vespper.

This repository contains runnable examples that show how to connect AI agents to Word (DOCX) documents through the [Vespper MCP](https://docs.vespper.com). Use them to read documents, search
their contents, and apply precise tracked changes without rebuilding the file from scratch.

## Usage

First, [sign up for Vespper](https://app.vespper.com), then create a key on the [API keys page](https://app.vespper.com/keys).

Clone the repository and follow the README inside the example you want to run:

```bash
git clone --recurse-submodules https://github.com/vespperhq/examples.git
cd examples
```

Each example lives in its own repository, is included here as a Git submodule,
and keeps credentials in a local `.env` file.
Never commit that file or expose its values in frontend code.

## Examples

- [word-add-in](https://github.com/vespperhq/word-add-in) — a Microsoft Word add-in with a React task pane, a Mastra agent, streamed tracked changes, selected-text context, and pasted-image support.
- [onlyoffice-add-in](https://github.com/vespperhq/onlyoffice-add-in) — a local Dockerized ONLYOFFICE Docs editor with the same Vespper chat workflow, live DOCX updates, and preserved tracked changes.

More examples will be added over time.

## Learn more

- [Vespper documentation](https://docs.vespper.com)
- [Vespper dashboard](https://app.vespper.com)
- [API keys](https://app.vespper.com/keys)
