import assert from "node:assert/strict";
import test from "node:test";
import { DocumentVersionGuard } from "./document-version";

test("ignores callbacks from the document version replaced by Vespper", () => {
  const guard = new DocumentVersionGuard();
  guard.markReplaced("old-key");

  assert.equal(guard.shouldSaveCallback("old-key"), false);
  assert.equal(guard.shouldSaveCallback("new-key"), true);
  assert.equal(guard.shouldSaveCallback(undefined), true);
});
