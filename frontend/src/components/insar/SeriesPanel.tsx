import type { EChartsOption } from 'echarts';
import { DataPanel } from '../common/ui';
import EChartsWrapper from '../charts/EChartsWrapper';

export interface SeriesPanelProps {
  option: EChartsOption;
  loading: boolean;
  error: string | null;
  hasData: boolean;
  onRetry?: () => void;
  title?: string;
}

/**
 * 点位时序面板：加载 / 失败（可重试）/ 无数据 统一走 DataPanel 四态。
 */
export function SeriesPanel({
  option,
  loading,
  error,
  hasData,
  onRetry,
  title = '时序变化',
}: SeriesPanelProps) {
  const state = loading ? 'loading' : error ? 'error' : hasData ? 'ready' : 'nodata';
  return (
    <DataPanel
      className="insar-series-panel"
      title={title}
      icon="fa-chart-line"
      pad
      state={state}
      errorText={error || undefined}
      onRetry={onRetry}
    >
      <EChartsWrapper option={option} style={{ height: '100%' }} />
    </DataPanel>
  );
}

export default SeriesPanel;
