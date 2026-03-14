/**
 * CrackDiagnosticsDrawer — Side Drawer with 7 diagnostic views
 * Opens when user clicks a monitoring point
 * Contains: Wavelet/Thermal/CUSUM/Creep/Settlement/Hurst/Entropy
 */
import React, { useMemo } from 'react';
import { useCracks } from '../../../contexts/CracksContext';
import {
  waveletDecompose,
  cusumDetect,
  detectCreepPhases,
  hurstExponent,
  entropyToHealth,
  amplitudeAwarePE,
  thermalSeparation,
  settlementCausality,
  type WaveletResult,
  type CUSUMResult,
  type PhaseResult,
  type HurstResult,
  type EntropyResult,
  type ThermalSeparationResult,
  type CausalResult,
} from '../../../utils/crack';

interface DiagnosticsDrawerProps {
  isOpen: boolean;
  pointId: string | null;
  onClose: () => void;
}

export const CrackDiagnosticsDrawer: React.FC<DiagnosticsDrawerProps> = ({
  isOpen,
  pointId,
  onClose,
}) => {
  const { trendData } = useCracks();

  const diagnostics = useMemo(() => {
    if (!trendData || trendData.length < 10) return null;

    const values = trendData.map(d => d.value);
    const dates = trendData.map(d => d.measurement_date);

    // Run all 7 algorithms
    const wavelet = waveletDecompose(values, 4);
    const cusum = cusumDetect(values, 30, 0.5, 5.0);
    const creep = detectCreepPhases(values, 14);
    const hurst = hurstExponent(values, 10);
    const entropy = entropyToHealth(amplitudeAwarePE(values, 3, 1, 0.5));

    // Mock temperature and settlement data (in real implementation, fetch from API)
    const mockTemp = values.map((_, i) => 20 + 10 * Math.sin(i / 30));
    const mockSettlement = values.map((_, i) => i * 0.01);

    const thermal = thermalSeparation(values, mockTemp, 11e-6, 100, 7);
    const causal = settlementCausality(values, mockSettlement, 30);

    return {
      wavelet,
      cusum,
      creep,
      hurst,
      entropy,
      thermal,
      causal,
      dates,
      values,
    };
  }, [trendData]);

  if (!isOpen || !pointId) return null;

  return (
    <div className="fixed inset-y-0 right-0 w-[600px] bg-slate-900 border-l border-slate-700 shadow-2xl z-50 overflow-y-auto">
      {/* Header */}
      <div className="sticky top-0 bg-slate-800 border-b border-slate-700 p-4 flex items-center justify-between z-10">
        <h2 className="text-lg font-bold text-white">深度诊断 — {pointId}</h2>
        <button
          onClick={onClose}
          className="text-slate-400 hover:text-white transition-colors"
        >
          <i className="fas fa-times text-xl" />
        </button>
      </div>

      {/* Content */}
      {!diagnostics ? (
        <div className="p-8 text-center text-slate-400">
          数据不足，无法进行诊断分析
        </div>
      ) : (
        <div className="p-4 space-y-6">
          {/* 1. Wavelet Decomposition */}
          <DiagnosticSection title="1. Wavelet 多尺度分解" icon="fa-wave-square">
            <div className="space-y-2 text-sm text-slate-300">
              <div className="flex justify-between">
                <span>分解层数:</span>
                <span className="text-white font-semibold">{diagnostics.wavelet.levels}</span>
              </div>
              <div className="p-3 bg-slate-800/50 rounded">
                <div className="text-xs text-slate-400 mb-1">趋势分量 (低频近似):</div>
                <div className="text-white">
                  长期结构趋势，已分离季节性波动和噪声
                </div>
              </div>
              <div className="p-3 bg-slate-800/50 rounded">
                <div className="text-xs text-slate-400 mb-1">季节分量 (中频细节):</div>
                <div className="text-white">
                  日/周温度循环引起的可逆变化
                </div>
              </div>
              <div className="p-3 bg-slate-800/50 rounded">
                <div className="text-xs text-slate-400 mb-1">噪声分量 (高频细节):</div>
                <div className="text-white">
                  测量误差和高频干扰
                </div>
              </div>
            </div>
          </DiagnosticSection>

          {/* 2. Thermal-Structural Separation */}
          <DiagnosticSection title="2. 热-结构分离" icon="fa-temperature-high">
            <div className="space-y-2 text-sm">
              <div className="flex items-center justify-between p-3 bg-slate-800/50 rounded">
                <span className="text-slate-300">温度相关性:</span>
                <span className="text-white font-bold text-lg">
                  r = {diagnostics.thermal.correlation.toFixed(2)}
                </span>
              </div>
              <div className="flex items-center justify-between p-3 bg-slate-800/50 rounded">
                <span className="text-slate-300">最佳滞后:</span>
                <span className="text-white font-semibold">
                  {diagnostics.thermal.bestLag} 天
                </span>
              </div>
              <div
                className={`p-3 rounded border ${
                  diagnostics.thermal.riskLevel === 'low'
                    ? 'bg-green-900/20 border-green-700/50'
                    : diagnostics.thermal.riskLevel === 'medium'
                    ? 'bg-yellow-900/20 border-yellow-700/50'
                    : 'bg-red-900/20 border-red-700/50'
                }`}
              >
                <div className="text-xs text-slate-400 mb-1">诊断:</div>
                <div className="text-white font-semibold">{diagnostics.thermal.regime}</div>
                <div className="text-xs text-slate-300 mt-1">{diagnostics.thermal.label}</div>
              </div>
            </div>
          </DiagnosticSection>

          {/* 3. CUSUM Change Points */}
          <DiagnosticSection title="3. CUSUM 变点检测" icon="fa-chart-line">
            <div className="space-y-2 text-sm">
              <div className="flex justify-between p-3 bg-slate-800/50 rounded">
                <span className="text-slate-300">检测到变点:</span>
                <span className="text-white font-bold">
                  {diagnostics.cusum.changePoints.length} 个
                </span>
              </div>
              {diagnostics.cusum.changePoints.length > 0 ? (
                <div className="space-y-1">
                  {diagnostics.cusum.changePoints.slice(0, 3).map((cp, i) => (
                    <div key={i} className="p-2 bg-slate-800/50 rounded text-xs">
                      <span className="text-slate-400">Index {cp.index}:</span>
                      <span
                        className={`ml-2 font-semibold ${
                          cp.direction === 'acceleration' ? 'text-red-400' : 'text-blue-400'
                        }`}
                      >
                        {cp.direction === 'acceleration' ? '↑ 加速' : '↓ 减速'}
                      </span>
                      <span className="ml-2 text-slate-300">
                        (magnitude: {cp.magnitude.toFixed(2)})
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-3 bg-green-900/20 border border-green-700/50 rounded text-white">
                  ✓ 无异常变点检测，行为稳定
                </div>
              )}
            </div>
          </DiagnosticSection>

          {/* 4. Creep Phase */}
          <DiagnosticSection title="4. 蠕变阶段识别" icon="fa-layer-group">
            <div className="space-y-2 text-sm">
              <div
                className={`p-3 rounded border ${
                  diagnostics.creep.currentStage === 'TERTIARY'
                    ? 'bg-red-900/20 border-red-700/50'
                    : diagnostics.creep.currentStage === 'SECONDARY'
                    ? 'bg-yellow-900/20 border-yellow-700/50'
                    : 'bg-green-900/20 border-green-700/50'
                }`}
              >
                <div className="text-xs text-slate-400 mb-1">当前阶段:</div>
                <div className="text-white font-bold text-lg">
                  {diagnostics.creep.currentStage}
                </div>
                <div className="text-xs text-slate-300 mt-1">
                  风险等级: {diagnostics.creep.currentRisk}
                </div>
              </div>
              <div className="text-xs text-slate-400">
                阶段历史: {diagnostics.creep.segments.length} 个阶段
              </div>
            </div>
          </DiagnosticSection>

          {/* 5. Settlement Causality */}
          <DiagnosticSection title="5. 沉降-裂缝因果" icon="fa-arrows-alt-v">
            <div className="space-y-2 text-sm">
              <div className="flex justify-between p-3 bg-slate-800/50 rounded">
                <span className="text-slate-300">峰值相关:</span>
                <span className="text-white font-bold">
                  r = {diagnostics.causal.peakCorrelation.toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between p-3 bg-slate-800/50 rounded">
                <span className="text-slate-300">峰值滞后:</span>
                <span className="text-white font-semibold">
                  {diagnostics.causal.peakLag} 天
                </span>
              </div>
              <div className="p-3 bg-slate-800/50 rounded">
                <div className="text-xs text-slate-400 mb-1">因果解释:</div>
                <div className="text-white">{diagnostics.causal.interpretation}</div>
              </div>
            </div>
          </DiagnosticSection>

          {/* 6. Hurst Exponent */}
          <DiagnosticSection title="6. Hurst 指数" icon="fa-chart-area">
            <div className="space-y-2 text-sm">
              <div className="flex justify-between p-3 bg-slate-800/50 rounded">
                <span className="text-slate-300">H 值:</span>
                <span className="text-white font-bold text-lg">
                  {diagnostics.hurst.H.toFixed(3)}
                </span>
              </div>
              <div
                className={`p-3 rounded border ${
                  diagnostics.hurst.risk === 'high'
                    ? 'bg-red-900/20 border-red-700/50'
                    : diagnostics.hurst.risk === 'medium'
                    ? 'bg-yellow-900/20 border-yellow-700/50'
                    : 'bg-green-900/20 border-green-700/50'
                }`}
              >
                <div className="text-xs text-slate-400 mb-1">解释:</div>
                <div className="text-white font-semibold">
                  {diagnostics.hurst.interpretation.toUpperCase()}
                </div>
                <div className="text-xs text-slate-300 mt-1">{diagnostics.hurst.label}</div>
              </div>
            </div>
          </DiagnosticSection>

          {/* 7. Permutation Entropy */}
          <DiagnosticSection title="7. Permutation Entropy" icon="fa-random">
            <div className="space-y-2 text-sm">
              <div className="flex justify-between p-3 bg-slate-800/50 rounded">
                <span className="text-slate-300">熵值 (0-1):</span>
                <span className="text-white font-bold text-lg">
                  {diagnostics.entropy.entropy.toFixed(3)}
                </span>
              </div>
              <div className="flex justify-between p-3 bg-slate-800/50 rounded">
                <span className="text-slate-300">健康评分:</span>
                <span className="text-white font-bold text-lg">
                  {diagnostics.entropy.healthScore} / 100
                </span>
              </div>
              <div
                className={`p-3 rounded border ${
                  diagnostics.entropy.status === 'healthy'
                    ? 'bg-green-900/20 border-green-700/50'
                    : diagnostics.entropy.status === 'attention'
                    ? 'bg-yellow-900/20 border-yellow-700/50'
                    : diagnostics.entropy.status === 'warning'
                    ? 'bg-orange-900/20 border-orange-700/50'
                    : 'bg-red-900/20 border-red-700/50'
                }`}
              >
                <div className="text-white font-semibold uppercase">
                  {diagnostics.entropy.status}
                </div>
                <div className="text-xs text-slate-300 mt-1">
                  {diagnostics.entropy.status === 'healthy'
                    ? '信号规律，结构健康'
                    : diagnostics.entropy.status === 'attention'
                    ? '轻微复杂度增加，持续监测'
                    : diagnostics.entropy.status === 'warning'
                    ? '信号复杂度升高，建议检查'
                    : '高度混乱，可能存在损伤'}
                </div>
              </div>
            </div>
          </DiagnosticSection>
        </div>
      )}
    </div>
  );
};

// Helper component for section headers
const DiagnosticSection: React.FC<{
  title: string;
  icon: string;
  children: React.ReactNode;
}> = ({ title, icon, children }) => (
  <div className="border border-slate-700 rounded-lg overflow-hidden">
    <div className="bg-slate-800 px-4 py-2 flex items-center gap-2">
      <i className={`fas ${icon} text-cyan-400`} />
      <h3 className="text-sm font-semibold text-white">{title}</h3>
    </div>
    <div className="p-4">{children}</div>
  </div>
);

export default CrackDiagnosticsDrawer;
