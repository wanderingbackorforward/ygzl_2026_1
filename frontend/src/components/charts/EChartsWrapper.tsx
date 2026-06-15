import React, { useRef, useEffect } from 'react';
import type { EChartsOption, ECharts } from 'echarts';
import { registerCyberpunkTheme } from './cyberpunkTheme';
import { useDeviceTier } from '../../contexts/DeviceTierContext';
import { applyWallPreset } from '../../lib/echartsWallPreset';

export interface EChartsWrapperProps {
  option: EChartsOption;
  theme?: string;
  loading?: boolean;
  style?: React.CSSProperties;
  className?: string;
  onChartReady?: (chart: ECharts) => void;
  notMerge?: boolean;
  lazyUpdate?: boolean;
  /** 是否启用大屏/触控预设（tooltip 点按触发等）。缺省=随设备档：tablet 自动启用。 */
  wall?: boolean;
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
  wall,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<ECharts | null>(null);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);
  const echartsPromiseRef = useRef<Promise<typeof import('echarts')> | null>(null);
  const optionRef = useRef<EChartsOption>(option);
  const loadingRef = useRef<boolean>(loading);
  const { isTablet } = useDeviceTier();
  const wallMode = wall === undefined ? isTablet : wall;
  const applyPreset = (o: EChartsOption) => (wallMode ? applyWallPreset(o) : o);

  optionRef.current = option;
  loadingRef.current = loading;

  function getEcharts(): Promise<typeof import('echarts')> {
    if (!echartsPromiseRef.current) {
      echartsPromiseRef.current = import('echarts').then(mod => {
        registerCyberpunkTheme(mod);
        return mod;
      });
    }
    return echartsPromiseRef.current;
  }

  // Initialize chart
  useEffect(() => {
    if (!containerRef.current) return;

    let cancelled = false;
    const container = containerRef.current;

    (async () => {
      const echarts = await getEcharts();
      if (cancelled) return;

      if (chartRef.current) {
        chartRef.current.dispose();
        chartRef.current = null;
      }

      const chart = echarts.init(container, theme, {
        renderer: 'canvas',
      });
      chartRef.current = chart;
      onChartReady?.(chart);

      chart.setOption(applyPreset(optionRef.current), {
        notMerge,
        lazyUpdate,
      });

      if (loadingRef.current) {
        chart.showLoading('default', {
          text: '',
          color: '#00e5ff',
          maskColor: 'rgba(10, 18, 30, 0.8)',
          spinnerRadius: 15,
          lineWidth: 2,
        });
      }

      resizeObserverRef.current = new ResizeObserver(() => {
        if (chartRef.current && !chartRef.current.isDisposed()) {
          chartRef.current.resize();
        }
      });
      resizeObserverRef.current.observe(container);
    })();

    // Cleanup
    return () => {
      cancelled = true;
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

    chartRef.current.setOption(applyPreset(option), {
      notMerge,
      lazyUpdate,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [option, notMerge, lazyUpdate, wallMode]);

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
