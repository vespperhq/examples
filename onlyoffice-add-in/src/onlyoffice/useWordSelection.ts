import { useCallback, useEffect, useRef, useState } from "react";

const TEXT_OPTIONS = {
  Numbering: false,
  Math: false,
  TableCellSeparator: "\n",
  TableRowSeparator: "\n",
  ParaSeparator: "\n",
  TabSymbol: "\t",
};

function getSelectedContent(): Promise<string> {
  return new Promise((resolve) => {
    Asc.plugin.executeMethod(
      "GetSelectedText",
      [TEXT_OPTIONS],
      (text: unknown) => resolve(typeof text === "string" ? text.trim() : "")
    );
  });
}

export function useWordSelection() {
  const [selectedContent, setSelectedContent] = useState("");
  const requestIdRef = useRef(0);

  useEffect(() => {
    let disposed = false;
    let timer: number | undefined;

    const refresh = async () => {
      const requestId = ++requestIdRef.current;
      const content = await getSelectedContent().catch(() => "");
      if (!disposed && requestId === requestIdRef.current) {
        setSelectedContent(content);
      }
    };

    const onSelectionChanged = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => void refresh(), 150);
    };

    void refresh();
    Asc.plugin.attachEditorEvent(
      "onTargetPositionChanged",
      onSelectionChanged
    );

    return () => {
      disposed = true;
      requestIdRef.current += 1;
      window.clearTimeout(timer);
      Asc.plugin.detachEditorEvent("onTargetPositionChanged");
    };
  }, []);

  const clearSelectedContent = useCallback(() => {
    requestIdRef.current += 1;
    setSelectedContent("");
  }, []);

  return { selectedContent, clearSelectedContent };
}
