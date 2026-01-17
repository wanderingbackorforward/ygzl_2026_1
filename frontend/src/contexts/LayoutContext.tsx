import React, { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react';
import type { LayoutState, Breakpoint, LayoutItem } from '../types/layout';

const STORAGE_KEY = 'dashboard-layouts';

interface LayoutContextValue {
  layouts: LayoutState['layouts'];
  collapsedCards: LayoutState['collapsedCards'];
  getPageLayout: (pageId: string, breakpoint: Breakpoint) => LayoutItem[];
  updateLayout: (pageId: string, breakpoint: Breakpoint, layout: LayoutItem[]) => void;
  isCardCollapsed: (cardId: string) => boolean;
  toggleCollapse: (cardId: string) => void;
  resetLayout: (pageId: string) => void;
  setDefaultLayout: (pageId: string, breakpoint: Breakpoint, layout: LayoutItem[]) => void;
}

const LayoutContext = createContext<LayoutContextValue | null>(null);

function loadFromStorage(): LayoutState {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (e) {
    console.warn('Failed to load layout from storage:', e);
  }
  return { layouts: {}, collapsedCards: {} };
}

function saveToStorage(state: LayoutState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    console.warn('Failed to save layout to storage:', e);
  }
}

interface LayoutProviderProps {
  children: ReactNode;
}

export const LayoutProvider: React.FC<LayoutProviderProps> = ({ children }) => {
  const [state, setState] = useState<LayoutState>(() => loadFromStorage());
  const [defaultLayouts, setDefaultLayouts] = useState<LayoutState['layouts']>({});

  // Save to storage whenever state changes
  useEffect(() => {
    saveToStorage(state);
  }, [state]);

  const getPageLayout = useCallback((pageId: string, breakpoint: Breakpoint): LayoutItem[] => {
    return state.layouts[pageId]?.[breakpoint] || defaultLayouts[pageId]?.[breakpoint] || [];
  }, [state.layouts, defaultLayouts]);

  const updateLayout = useCallback((pageId: string, breakpoint: Breakpoint, layout: LayoutItem[]) => {
    setState(prev => ({
      ...prev,
      layouts: {
        ...prev.layouts,
        [pageId]: {
          ...prev.layouts[pageId],
          [breakpoint]: layout,
        },
      },
    }));
  }, []);

  const isCardCollapsed = useCallback((cardId: string): boolean => {
    return state.collapsedCards[cardId] ?? false;
  }, [state.collapsedCards]);

  const toggleCollapse = useCallback((cardId: string) => {
    setState(prev => ({
      ...prev,
      collapsedCards: {
        ...prev.collapsedCards,
        [cardId]: !prev.collapsedCards[cardId],
      },
    }));
  }, []);

  const resetLayout = useCallback((pageId: string) => {
    setState(prev => {
      const newLayouts = { ...prev.layouts };
      delete newLayouts[pageId];

      // Also reset collapsed state for cards on this page
      const newCollapsedCards = { ...prev.collapsedCards };
      Object.keys(newCollapsedCards).forEach(key => {
        if (key.startsWith(`${pageId}-`)) {
          delete newCollapsedCards[key];
        }
      });

      return {
        layouts: newLayouts,
        collapsedCards: newCollapsedCards,
      };
    });
  }, []);

  const setDefaultLayout = useCallback((pageId: string, breakpoint: Breakpoint, layout: LayoutItem[]) => {
    setDefaultLayouts(prev => ({
      ...prev,
      [pageId]: {
        ...prev[pageId],
        [breakpoint]: layout,
      },
    }));
  }, []);

  const value: LayoutContextValue = {
    layouts: state.layouts,
    collapsedCards: state.collapsedCards,
    getPageLayout,
    updateLayout,
    isCardCollapsed,
    toggleCollapse,
    resetLayout,
    setDefaultLayout,
  };

  return (
    <LayoutContext.Provider value={value}>
      {children}
    </LayoutContext.Provider>
  );
};

export function useLayout(): LayoutContextValue {
  const context = useContext(LayoutContext);
  if (!context) {
    throw new Error('useLayout must be used within a LayoutProvider');
  }
  return context;
}

export default LayoutContext;
