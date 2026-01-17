  import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';

export type ViewMode = 'legacy' | 'new';

function normalizeMode(value: unknown): ViewMode | null {
  if (value === 'legacy' || value === 'new') return value;
  return null;
}

function storageKey(pageKey: string) {
  return `viewMode:${pageKey}`;
}

export function useViewMode(pageKey: string, defaultMode: ViewMode = 'legacy') {
  const location = useLocation();
  const queryMode = useMemo(() => {
    const sp = new URLSearchParams(location.search);
    return normalizeMode(sp.get('view'));
  }, [location.search]);

  const [mode, setModeState] = useState<ViewMode>(() => {
    if (queryMode) return queryMode;
    try {
      const stored = localStorage.getItem(storageKey(pageKey));
      return normalizeMode(stored) ?? defaultMode;
    } catch {
      return defaultMode;
    }
  });

  useEffect(() => {
    if (queryMode) {
      setModeState(queryMode);
    }
  }, [queryMode]);

  const setMode = useCallback(
    (next: ViewMode) => {
      setModeState(next);
      try {
        localStorage.setItem(storageKey(pageKey), next);
      } catch {
        // ignore
      }
    },
    [pageKey]
  );

  return { mode, setMode, queryMode };
}

