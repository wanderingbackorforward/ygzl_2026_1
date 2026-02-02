import React, { useState, useEffect } from 'react';
import { LayoutProvider } from '../contexts/LayoutContext';
import { DashboardGrid } from '../components/layout/DashboardGrid';
import { PointSelector } from '../components/shared/PointSelector';
import { SmartPredictionChart } from '../components/charts/ml/SmartPredictionChart';
import { AnomalyDetectionChart } from '../components/charts/ml/AnomalyDetectionChart';
import { ModelComparisonChart } from '../components/charts/ml/ModelComparisonChart';
import { SpatialCorrelationChart } from '../components/charts/ml/SpatialCorrelationChart';
import type { CardConfig } from '../types/layout';

import '../styles/variables.css';
import '../styles/cards.css';
import '../styles/grid.css';

// 检查 ML API 是否可用
const checkMLAvailability = async (): Promise<boolean> => {
  try {
    const response = await fetch('/api/ml/health', { method: 'GET' });
    return response.ok;
  } catch {
    return false;
  }
};

// 监测点选择器卡片
const PointSelectorCard: React.FC<{ onSelectPoint: (id: string) => void; selectedPoint: string | null }> = ({ onSelectPoint, selectedPoint }) => {
  // 简化版：使用固定的监测点列表
  const points = Array.from({ length: 25 }, (_, i) => ({
    point_id: `S${i + 1}`,
    description: `监测点 S${i + 1}`
  }));

  return (
    <PointSelector
      cardId="ml-point-selector"
      points={points}
      selectedPoint={selectedPoint}
      onSelectPoint={onSelectPoint}
      loading={false}
      problemPointIds={[]}
    />
  );
};

// 主页面组件
function MLAnalysisCenterContent() {
  const [selectedPointId, setSelectedPointId] = useState<string | null>('S1');
  const [mlAvailable, setMlAvailable] = useState<boolean | null>(null);

  useEffect(() => {
    checkMLAvailability().then(setMlAvailable);
  }, []);

  // 如果 ML API 不可用，显示提示信息
  if (mlAvailable === false) {
    return (
      <div style={{
        height: '100vh',
        background: 'linear-gradient(135deg, #0a1628 0%, #1a2332 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'column',
        gap: '24px',
        padding: '40px'
      }}>
        <div style={{ fontSize: '72px' }}>🚧</div>
        <div style={{
          fontSize: '32px',
          color: '#00ffff',
          fontWeight: 'bold',
          textAlign: 'center'
        }}>
          智能分析中心正在部署中
        </div>
        <div style={{
          fontSize: '16px',
          color: '#888',
          textAlign: 'center',
          maxWidth: '600px',
          lineHeight: '1.8'
        }}>
          该功能需要大型机器学习库支持（scikit-learn、statsmodels），
          由于 Vercel Serverless 环境的包大小限制（50MB），
          我们正在准备独立的 ML API 服务部署方案。
          <br /><br />
          本地开发环境中该功能完全可用。
        </div>
        <div style={{
          padding: '12px 24px',
          background: 'rgba(0, 255, 255, 0.1)',
          border: '1px solid rgba(0, 255, 255, 0.3)',
          borderRadius: '8px',
          color: '#00ffff',
          fontSize: '14px'
        }}>
          预计完成时间：本周内
        </div>
      </div>
    );
  }

  // 加载中
  if (mlAvailable === null) {
    return (
      <div style={{
        height: '100vh',
        background: 'linear-gradient(135deg, #0a1628 0%, #1a2332 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#00ffff',
        fontSize: '18px'
      }}>
        正在检查 ML 服务状态...
      </div>
    );
  }

  // 卡片配置
  const cards: CardConfig[] = [
    {
      id: 'ml-point-selector',
      component: () => <PointSelectorCard onSelectPoint={setSelectedPointId} selectedPoint={selectedPointId} />,
      defaultPosition: { x: 0, y: 0, w: 3, h: 8 }
    },
    {
      id: 'ml-smart-prediction',
      component: () => <SmartPredictionChart cardId="ml-smart-prediction" pointId={selectedPointId} />,
      defaultPosition: { x: 3, y: 0, w: 9, h: 8 }
    },
    {
      id: 'ml-anomaly-detection',
      component: () => <AnomalyDetectionChart cardId="ml-anomaly-detection" pointId={selectedPointId} />,
      defaultPosition: { x: 0, y: 8, w: 6, h: 8 }
    },
    {
      id: 'ml-model-comparison',
      component: () => <ModelComparisonChart cardId="ml-model-comparison" pointId={selectedPointId} />,
      defaultPosition: { x: 6, y: 8, w: 6, h: 8 }
    },
    {
      id: 'ml-spatial-correlation',
      component: () => <SpatialCorrelationChart cardId="ml-spatial-correlation" />,
      defaultPosition: { x: 0, y: 16, w: 12, h: 10 }
    }
  ];

  return (
    <div style={{
      height: '100%',
      background: 'linear-gradient(135deg, #0a1628 0%, #1a2332 100%)',
      overflow: 'hidden'
    }}>
      {/* 页面标题 */}
      <div style={{
        padding: '20px',
        background: 'rgba(0, 0, 0, 0.3)',
        borderBottom: '2px solid rgba(0, 255, 255, 0.3)',
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{
            fontSize: '32px',
            background: 'linear-gradient(135deg, #00ffff 0%, #00aaff 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            fontWeight: 'bold'
          }}>
            🤖 智能分析中心
          </div>
          <div style={{
            padding: '6px 12px',
            background: 'rgba(0, 255, 0, 0.2)',
            border: '1px solid rgba(0, 255, 0, 0.5)',
            borderRadius: '20px',
            fontSize: '12px',
            color: '#00ff00',
            fontWeight: 'bold'
          }}>
            AI驱动
          </div>
        </div>
        <div style={{
          marginTop: '8px',
          color: '#888',
          fontSize: '14px'
        }}>
          基于机器学习的智能预测、异常检测、空间关联分析与模型对比
        </div>
      </div>

      {/* 仪表盘网格 */}
      <div style={{ height: 'calc(100% - 100px)', overflow: 'auto' }}>
        <DashboardGrid cards={cards} />
      </div>
    </div>
  );
}

// 导出页面
export default function MLAnalysisCenter() {
  return (
    <LayoutProvider storageKey="ml-analysis-layout">
      <MLAnalysisCenterContent />
    </LayoutProvider>
  );
}
