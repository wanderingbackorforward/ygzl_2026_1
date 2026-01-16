import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import React from 'react';
import EChartsWrapper from '../components/charts/EChartsWrapper';

describe('EChartsWrapper', () => {
  it('renders container', () => {
    const { container } = render(<EChartsWrapper option={{}} />);
    const div = container.querySelector('.echarts-wrapper');
    expect(div).toBeTruthy();
  });
});
