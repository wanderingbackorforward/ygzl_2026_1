import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import React from 'react';
import { DashboardGrid } from '../components/layout/DashboardGrid';
import { LayoutProvider } from '../contexts/LayoutContext';
import type { CardConfig } from '../types/layout';

const Dummy: React.FC<{ cardId: string }> = () => <div data-testid="dummy">X</div>;
const cards: CardConfig[] = [
  { id: 'a', title: 'A', component: Dummy, defaultLayout: { x: 0, y: 0, w: 6, h: 4 } },
  { id: 'b', title: 'B', component: Dummy, defaultLayout: { x: 6, y: 0, w: 6, h: 4 } },
];

describe('DashboardGrid', () => {
  it('renders cards', () => {
    const { getAllByTestId } = render(
      <LayoutProvider>
        <DashboardGrid pageId="p" cards={cards} />
      </LayoutProvider>
    );
    expect(getAllByTestId('dummy').length).toBe(2);
  });
});
