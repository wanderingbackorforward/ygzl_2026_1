import { DataPanel, StateView } from '../common/ui';

export type InsarIndicator = 'velocity' | 'keyDate' | 'threshold';

export interface LegendItem {
  label: string;
  color: string;
}

export interface LayerControlPanelProps {
  indicator: InsarIndicator;
  baseLayerName: string;
  baseLayers: { name: string }[];
  onBaseLayerChange: (name: string) => void;
  opticalCount: number;
  baseLayerError: string | null;
  featureCount: number;
  totalFeatureCount?: number;
  cached?: boolean;
  valueField: string;
  unit: string;
  maxAbs: number;
  legendLeft: string | null;
  legendRight: string | null;
  thresholdLegendItems: LegendItem[];
  canFitBounds: boolean;
  onFitBounds: () => void;
  loading: boolean;
  error: string | null;
  onRetry?: () => void;
}

/**
 * 图层控制：底图选择 + 点数/字段 + 图例 + 定位。
 * 失败时用 StateView 的 error 态，不再自绘一段红字。
 */
export function LayerControlPanel({
  indicator,
  baseLayerName,
  baseLayers,
  onBaseLayerChange,
  opticalCount,
  baseLayerError,
  featureCount,
  totalFeatureCount,
  cached,
  valueField,
  unit,
  maxAbs,
  legendLeft,
  legendRight,
  thresholdLegendItems,
  canFitBounds,
  onFitBounds,
  loading,
  error,
  onRetry,
}: LayerControlPanelProps) {
  return (
    <DataPanel
      className="insar-layer-panel"
      title="图层与图例"
      icon="fa-layer-group"
      pad
    >
      <div className="insar-layer-section">
        <span className="insar-layer-section__title">底图 / 影像</span>
        <select
          className="insar-select"
          value={baseLayerName}
          onChange={(e) => onBaseLayerChange(e.target.value)}
        >
          {baseLayers.map((x) => (
            <option key={x.name} value={x.name}>
              {x.name}
            </option>
          ))}
        </select>
        <span className="insar-hint">光学配置：{opticalCount} 层（来自 /static/data/optical/layers.json）</span>
        {baseLayerError ? <div className="insar-error-text">{baseLayerError}</div> : null}
      </div>

      <div className="insar-chips">
        <span className="ds-chip">
          点数 {featureCount}
          {totalFeatureCount ? ` / ${totalFeatureCount}` : ''}
        </span>
        {cached ? <span className="ds-chip ds-chip--info">缓存</span> : null}
        <span className="ds-chip">
          字段 {valueField}
          {unit ? `（${unit}）` : ''}
        </span>
      </div>

      {error ? (
        <StateView kind="error" compact title="点位接口不可用" hint={error} onRetry={onRetry} />
      ) : (
        <>
          <div className="insar-layer-section">
            <span className="insar-layer-section__title">图例（颜色点含义）</span>
            {indicator !== 'threshold' ? (
              <>
                <span className="insar-hint">色标范围：±{maxAbs}</span>
                <span className="insar-hint">左红=沉降（负），中白=0，右蓝=抬升（正）</span>
                <div
                  className="insar-legend-bar"
                  style={{
                    background: `linear-gradient(90deg, ${legendLeft || '#7c8a9a'} 0%, #ffffff 50%, ${legendRight || '#7c8a9a'} 100%)`,
                  }}
                />
                <div className="insar-legend-scale">
                  <span>-{maxAbs}</span>
                  <span>0</span>
                  <span>{maxAbs}</span>
                </div>
              </>
            ) : (
              <>
                <span className="insar-hint">阈值分级（单位：mm/年，负=沉降）</span>
                <div className="insar-legend-list">
                  {thresholdLegendItems.map((x) => (
                    <div key={`${x.label}-${x.color}`} className="insar-legend-item">
                      <span className="insar-swatch" style={{ background: x.color }} />
                      <span>{x.label}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>

          <button
            type="button"
            className="ds-btn ds-btn--primary insar-fit-btn"
            disabled={!canFitBounds}
            onClick={onFitBounds}
          >
            定位到数据范围
          </button>
          {loading ? <div className="insar-hint" style={{ marginTop: 8 }}>正在刷新点位…</div> : null}
        </>
      )}
    </DataPanel>
  );
}

export default LayerControlPanel;
