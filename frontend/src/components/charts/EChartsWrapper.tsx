import React, { useRef, useEffect, useCallback } from 'react';
import * as echarts from 'echarts';
import type { EChartsOption, ECharts } from 'echarts';
import { registerCyberpunkTheme } from './cyberpunkTheme';

// Register theme on module load
registerCyberpunkTheme();

export interface EChartsWrapperProps {
  option: EChartsOption;
  theme?: string;
  loading?: boolean;
  style?: React.CSSProperties;
  className?: string;
  onChartReady?: (chart: ECharts) => void;
  notMerge?: boolean;
  lazyUpdate?: boolean;
}

export const EChartsWrapper: React.FC<EChartsWrapperProps> = ({
  option,
  theme = 'cyberpunk',
  loading = false,
  style,
  className = '',
  onChartReady,
  notMerge = false,
  lazyUpdate = false,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<ECharts | null>(null);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);

  // Initialize chart
  useEffect(() => {
    if (!containerRef.current) return;

    // Dispose existing chart
    if (chartRef.current) {
      chartRef.current.dispose();
    }

    // Create new chart instance
    const chart = echarts.init(containerRef.current, theme, {
      renderer: 'canvas',
    });
    chartRef.current = chart;

    // Notify parent
    onChartReady?.(chart);

    // Set up resize observer
    resizeObserverRef.current = new ResizeObserver(() => {
      if (chartRef.current && !chartRef.current.isDisposed()) {
        chartRef.current.resize();
      }
    });
    resizeObserverRef.current.observe(containerRef.current);

    // Cleanup
    return () => {
      resizeObserverRef.current?.disconnect();
      if (chartRef.current && !chartRef.current.isDisposed()) {
        chartRef.current.dispose();
      }
      chartRef.current = null;
    };
  }, [theme, onChartReady]);

  // Update options
  useEffect(() => {
    if (!chartRef.current || chartRef.current.isDisposed()) return;

    chartRef.current.setOption(option, {
      notMerge,
      lazyUpdate,
    });
  }, [option, notMerge, lazyUpdate]);

  // Handle loading state
  useEffect(() => {
    if (!chartRef.current || chartRef.current.isDisposed()) return;

    if (loading) {
      chartRef.current.showLoading('default', {
        text: '',
        color: '#00e5ff',
        maskColor: 'rgba(10, 18, 30, 0.8)',
        spinnerRadius: 15,
        lineWidth: 2,
      });
    } else {
      chartRef.current.hideLoading();
    }
  }, [loading]);

  return (
    <div
      ref={containerRef}
      className={`echarts-wrapper ${className}`}
      style={{
        width: '100%',
        height: '100%',
        minHeight: 150,
        ...style,
      }}
    />
  );
};

export default EChartsWrapper;
