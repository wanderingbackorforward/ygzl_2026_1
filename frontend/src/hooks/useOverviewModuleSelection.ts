import { useCallback, useMemo, useState } from 'react';

export type OverviewModuleId = 'settlement' | 'cracks' | 'temperature' | 'vibration';

const STORAGE_KEY = 'overview:selected-modules';

const ALL_MODULES: OverviewModuleId[] = ['settlement', 'cracks', 'temperature', 'vibration'];
const DEFAULT_SELECTED: OverviewModuleId[] = ['settlement', 'cracks', 'temperature', 'vibration'];

function normalize(value: unknown): OverviewModuleId[] | null {
  if (!Array.isArray(value)) return null;
  const filtered = value.filter((v): v is OverviewModuleId => typeof v === 'string' && (ALL_MODULES as string[]).includes(v));
  return Array.from(new Set(filtered));
}

function loadFromStorage(): OverviewModuleId[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_SELECTED;
    const parsed = JSON.parse(raw) as unknown;
    return normalize(parsed) ?? DEFAULT_SELECTED;
  } catch {
    return DEFAULT_SELECTED;
  }
}

function saveToStorage(selected: OverviewModuleId[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(selected));
  } catch {
    // ignore
  }
}

export function useOverviewModuleSelection() {
  const [selected, setSelected] = useState<OverviewModuleId[]>(() => loadFromStorage());

  const selectedSet = useMemo(() => new Set(selected), [selected]);

  const setAndPersist = useCallback((next: OverviewModuleId[]) => {
    const normalized = normalize(next) ?? [];
    setSelected(normalized);
    saveToStorage(normalized);
  }, []);

  const toggle = useCallback((moduleId: OverviewModuleId) => {
    const next = selectedSet.has(moduleId) ? selected.filter(id => id !== moduleId) : [...selected, moduleId];
    setAndPersist(next);
  }, [selected, selectedSet, setAndPersist]);

  const selectAll = useCallback(() => {
    setAndPersist(ALL_MODULES);
  }, [setAndPersist]);

  const clearAll = useCallback(() => {
    setAndPersist([]);
  }, [setAndPersist]);

  const reset = useCallback(() => {
    setAndPersist(DEFAULT_SELECTED);
  }, [setAndPersist]);

  return {
    allModules: ALL_MODULES,
    selected,
    selectedSet,
    toggle,
    selectAll,
    clearAll,
    reset,
  };
}
