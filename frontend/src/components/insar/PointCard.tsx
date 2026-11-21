import { DataPanel } from '../common/ui';

export type InsarRiskLevel = 'normal' | 'warning' | 'danger';

export interface InsarMeasure {
  key: string;
  title: string;
  detail: string;
}

export interface PointCardProps {
  pointId: string;
  lat: number;
  lng: number;
  velocity: number | null;
  risk: InsarRiskLevel;
  riskText: string;
  measures: InsarMeasure[];
}

/**
 * 点位卡：读数 + 风险 + 施工建议。
 * 颜色只表达风险语义（ds-ok / ds-warn / ds-danger），由类名承载。
 */
export function PointCard({
  pointId,
  lat,
  lng,
  velocity,
  risk,
  riskText,
  measures,
}: PointCardProps) {
  return (
    <>
      <DataPanel
        className={`insar-point-card insar-point-card--${risk}`}
        title="点位读数"
        icon="fa-map-marker-alt"
        pad
      >
        <div className="insar-point-id">{pointId || '未命名'}</div>
        <div className="insar-point-meta">
          <div>
            <div className="insar-point-meta__label">经度</div>
            <div className="insar-point-meta__value">{lng.toFixed(6)}</div>
          </div>
          <div>
            <div className="insar-point-meta__label">纬度</div>
            <div className="insar-point-meta__value">{lat.toFixed(6)}</div>
          </div>
          {velocity !== null && (
            <>
              <div>
                <div className="insar-point-meta__label">速度</div>
                <div className="insar-point-meta__value">{velocity.toFixed(2)} mm/年</div>
              </div>
              <div>
                <div className="insar-point-meta__label">风险</div>
                <div className={`insar-point-meta__value insar-point-meta__value--${risk}`}>{riskText}</div>
              </div>
            </>
          )}
        </div>
      </DataPanel>

      {measures.length > 0 && (
        <DataPanel
          className="insar-measure-panel"
          title={
            <>
              施工建议 <span className={`insar-risk-text--${risk}`}>({riskText})</span>
            </>
          }
          icon="fa-clipboard-list"
          pad
        >
          <div className="insar-measure-list">
            {measures.map((m, idx) => (
              <div key={m.key} className="insar-measure">
                <div className="insar-measure__head">
                  <span className="insar-measure__index">{idx + 1}</span>
                  <div className="insar-measure__title">{m.title}</div>
                </div>
                <div className="insar-measure__detail">{m.detail}</div>
              </div>
            ))}
          </div>
        </DataPanel>
      )}
    </>
  );
}

export default PointCard;
