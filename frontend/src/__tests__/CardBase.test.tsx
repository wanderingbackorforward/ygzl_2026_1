import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import React from 'react';
import { CardBase } from '../components/cards/CardBase';

describe('CardBase', () => {
  it('renders title', () => {
    const { getByText } = render(<CardBase id="c" title="T" children={<div />} />);
    expect(getByText('T')).toBeTruthy();
  });
  it('toggles collapse', () => {
    const onToggle = vi.fn();
    const { getByTitle } = render(<CardBase id="c" title="T" onToggleCollapse={onToggle} children={<div />} />);
    fireEvent.click(getByTitle('Collapse'));
    expect(onToggle).toHaveBeenCalledTimes(1);
  });
});
