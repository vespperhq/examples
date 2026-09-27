declare const Asc: {
  scope: Record<string, unknown>;
  plugin: {
    init: () => void;
    onDestroy?: () => void;
    executeMethod(
      name: string,
      params: unknown[] | null,
      callback?: (result: any) => void
    ): boolean;
    callCommand(
      command: () => unknown,
      close?: boolean,
      recalculate?: boolean,
      callback?: (result: any) => void
    ): void;
    attachEditorEvent(name: string, callback: () => void): void;
    detachEditorEvent(name: string): void;
  };
};

declare const Api: {
  GetDocument(): {
    IsTrackRevisions(): boolean;
  };
};
