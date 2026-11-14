import { useCallback, useEffect, useState } from "react";
import { lineKey } from "./learn-tree";
import { loadProgress, recordRun, saveProgress, type ProgressMap } from "./line-progress";

/** Reads and writes opening-line progress for the signed-in user (stored on this device). */
export function useLineProgress(userId?: string | null) {
  const [progress, setProgress] = useState<ProgressMap>(() => loadProgress(userId, window.localStorage));

  useEffect(() => {
    setProgress(loadProgress(userId, window.localStorage));
  }, [userId]);

  const record = useCallback(
    (line: { eco: string; name: string }, clean: boolean) => {
      const key = lineKey(line);
      setProgress(prev => {
        const next = { ...prev, [key]: recordRun(prev[key], key, clean, new Date().toISOString()) };
        saveProgress(userId, next, window.localStorage);
        return next;
      });
    },
    [userId]
  );

  return { progress, record };
}
