// Layout item type (custom, compatible with react-grid-layout)
export interface LayoutItem {
  i: string;
  x: number;
  y: number;
  w: number;
  h: number;
  minW?: number;
  maxW?: number;
  minH?: number;
  maxH?: number;
  static?: boolean;
}

export interface CardConfig {
  id: string;
  title: string;
  icon?: string;
  component: React.ComponentType<CardComponentProps>;
  props?: Record<string, unknown>;
  defaultLayout: CardLayout;
  defaultLayouts?: Partial<Record<Breakpoint, CardLayout>>;
}

export interface CardLayout {
  x: number;
  y: number;
  w: number;
  h: number;
  minW?: number;
  maxW?: number;
  minH?: number;
  maxH?: number;
  static?: boolean;
}

export interface CardComponentProps {
  cardId: string;
  onFullscreen?: () => void;
}

export interface LayoutState {
  layouts: {
    [pageId: string]: {
      [breakpoint: string]: LayoutItem[];
    };
  };
  collapsedCards: {
    [cardId: string]: boolean;
  };
}

export type Breakpoint = 'lg' | 'md' | 'sm' | 'xs';

export interface BreakpointConfig {
  breakpoint: Breakpoint;
  cols: number;
  width: number;
}

export const BREAKPOINTS: Record<Breakpoint, number> = {
  lg: 1200,
  md: 996,
  sm: 768,
  xs: 480,
};

export const COLS: Record<Breakpoint, number> = {
  lg: 12,
  md: 10,
  sm: 6,
  xs: 4,
};

export const ROW_HEIGHT = 80;
export const MARGIN: [number, number] = [12, 12];
