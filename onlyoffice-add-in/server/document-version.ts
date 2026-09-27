export class DocumentVersionGuard {
  private readonly replacedKeys = new Set<string>();

  markReplaced(key: string): void {
    if (!key) return;
    this.replacedKeys.add(key);
    if (this.replacedKeys.size > 100) {
      const oldest = this.replacedKeys.values().next().value;
      if (oldest) this.replacedKeys.delete(oldest);
    }
  }

  shouldSaveCallback(key: unknown): boolean {
    return typeof key !== "string" || !this.replacedKeys.has(key);
  }
}
