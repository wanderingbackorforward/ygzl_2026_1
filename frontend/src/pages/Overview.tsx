import React, { useEffect, useRef, useState } from 'react';
import * as echarts from 'echarts';
import { useOverviewData } from '../hooks/useOverviewData';
import './Overview.css';

const Overview: React.FC = () => {
  const [currentTime, setCurrentTime] = useState(new Date());
  const { data: summaryData, loading, error } = useOverviewData();

  // Refs
  const trendChartRef = useRef<HTMLDivElement>(null);
  const tempChartRef = useRef<HTMLDivElement>(null);
  const gaugeChartRef = useRef<HTMLDivElement>(null);
  const radarChartRef = useRef<HTMLDivElement>(null);
  const chartsRef = useRef<echarts.ECharts[]>([]);

  // Clock
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Initialize/Update Charts when data changes
  useEffect(() => {
    // Dispose old charts
    chartsRef.current.forEach(chart => chart.dispose());
    chartsRef.current = [];

    const initCharts = () => {
      // 1. Safety Score Gauge
      if (gaugeChartRef.current) {
        const chart = echarts.init(gaugeChartRef.current);
        const safetyScore = summaryData?.safety_score ?? 0;
        chart.setOption({
          series: [
            {
              type: 'gauge',
              startAngle: 180,
              endAngle: 0,
              min: 0,
              max: 100,
              splitNumber: 5,
              center: ['50%', '70%'],
              radius: '100%',
              axisLine: {
                lineStyle: {
                  width: 10,
                  color: [
                    [0.6, '#ff4d4f'],
                    [0.8, '#faad14'],
                    [1, '#00e5ff']
                  ]
                }
              },
              pointer: { length: '50%', width: 4, itemStyle: { color: 'auto' } },
              axisTick: { show: false },
              splitLine: { length: 12, lineStyle: { color: 'auto', width: 2 } },
              axisLabel: { color: '#8ba0b6', fontSize: 10, distance: -40 },
              title: { offsetCenter: [0, '-20%'], fontSize: 20, color: '#fff' },
              detail: {
                fontSize: 36,
                offsetCenter: [0, '0%'],
                valueAnimation: true,
                formatter: '{value}',
                color: '#fff',
                fontFamily: 'Impact'
              },
              data: [{ value: safetyScore, name: '安全评分' }]
            }
          ]
        });
        chartsRef.current.push(chart);
      }

      // 2. Multi-domain Radar Chart
      if (radarChartRef.current) {
        const chart = echarts.init(radarChartRef.current);
        // Normalize values to 0-100 scale for radar
        const settlementScore = Math.max(0, 100 - (summaryData?.settlement?.alert_count ?? 0) * 10);
        const crackScore = Math.max(0, 100 - (summaryData?.cracks?.expanding_count ?? 0) * 15);
        const tempScore = 80; // Temperature is usually stable
        const vibrationScore = summaryData?.vibration?.total_datasets ? 70 : 50;

        chart.setOption({
          radar: {
            indicator: [
              { name: '沉降', max: 100 },
              { name: '裂缝', max: 100 },
              { name: '温度', max: 100 },
              { name: '振动', max: 100 }
            ],
            center: ['50%', '50%'],
            radius: '65%',
            axisName: { color: '#00e5ff' },
            splitArea: { areaStyle: { color: ['rgba(0,229,255,0.1)', 'rgba(0,0,0,0)'] } },
            axisLine: { lineStyle: { color: 'rgba(0,229,255,0.3)' } },
            splitLine: { lineStyle: { color: 'rgba(0,229,255,0.3)' } }
          },
          series: [{
            type: 'radar',
            data: [
              {
                value: [settlementScore, crackScore, tempScore, vibrationScore],
                name: '各项指标健康度',
                areaStyle: { color: 'rgba(0, 229, 255, 0.4)' },
                itemStyle: { color: '#00e5ff' }
              }
            ]
          }]
        });
        chartsRef.current.push(chart);
      }

      // 3. Trend Distribution Bar Chart (Settlement)
      if (trendChartRef.current) {
        const chart = echarts.init(trendChartRef.current);
        const trendDist = summaryData?.settlement?.trend_distribution ?? {};
        const labels = Object.keys(trendDist);
        const values = Object.values(trendDist) as number[];

        chart.setOption({
          tooltip: { trigger: 'axis' },
          grid: { top: 30, right: 10, bottom: 20, left: 40, containLabel: true },
          xAxis: {
            type: 'category',
            data: labels.length ? labels : ['上升', '下降', '稳定'],
            axisLine: { lineStyle: { color: 'rgba(0, 229, 255, 0.3)' } },
            axisLabel: { color: '#8ba0b6' }
          },
          yAxis: {
            type: 'value',
            splitLine: { lineStyle: { color: 'rgba(0, 229, 255, 0.1)' } },
            axisLabel: { color: '#8ba0b6' }
          },
          series: [{
            name: '监测点数',
            type: 'bar',
            data: values.length ? values : [3, 5, 12],
            itemStyle: {
              color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                { offset: 0, color: '#00e5ff' },
                { offset: 1, color: '#0066cc' }
              ])
            }
          }]
        });
        chartsRef.current.push(chart);
      }

      // 4. Temperature Gauge/Bar
      if (tempChartRef.current) {
        const chart = echarts.init(tempChartRef.current);
        const avgTemp = summaryData?.temperature?.avg_temp ?? 0;
        const minTemp = summaryData?.temperature?.min_temp ?? 0;
        const maxTemp = summaryData?.temperature?.max_temp ?? 0;

        chart.setOption({
          tooltip: { trigger: 'axis' },
          grid: { top: 30, right: 10, bottom: 20, left: 40, containLabel: true },
          xAxis: {
            type: 'category',
            data: ['最低', '平均', '最高'],
            axisLine: { lineStyle: { color: 'rgba(250, 173, 20, 0.3)' } },
            axisLabel: { color: '#8ba0b6' }
          },
          yAxis: {
            type: 'value',
            splitLine: { lineStyle: { color: 'rgba(250, 173, 20, 0.1)' } },
            axisLabel: { color: '#8ba0b6', formatter: '{value}°' }
          },
          series: [{
            name: '温度(°C)',
            type: 'bar',
            data: [minTemp, avgTemp, maxTemp],
            itemStyle: {
              color: (params: { dataIndex: number }) => {
                const colors = ['#52c41a', '#faad14', '#ff4d4f'];
                return colors[params.dataIndex];
              }
            }
          }]
        });
        chartsRef.current.push(chart);
      }
    };

    initCharts();

    const handleResize = () => {
      chartsRef.current.forEach(chart => chart.resize());
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, [summaryData]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      chartsRef.current.forEach(chart => chart.dispose());
      chartsRef.current = [];
    };
  }, []);

  return (
    <div className="dashboard-container">
      {/* Header */}
      <header className="dashboard-header">
        <div className="header-center-decoration">
          <div className="header-title">项目监测数据汇总中心</div>
          <div className="header-subtitle">PROJECT DATA AGGREGATION & MONITORING</div>
        </div>
        <div className="header-time">
          {currentTime.toLocaleTimeString('zh-CN', { hour12: false })}
        </div>
      </header>

      {/* Loading/Error State */}
      {loading && (
        <div style={{ textAlign: 'center', padding: 50, color: '#00e5ff' }}>
          加载中...
        </div>
      )}
      {error && (
        <div style={{ textAlign: 'center', padding: 50, color: '#ff4d4f' }}>
          加载失败: {error}
        </div>
      )}

      {/* Main Grid */}
      {!loading && !error && (
        <div className="dashboard-grid">
          {/* === LEFT COLUMN === */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 15 }}>
            {/* Settlement Stats */}
            <div className="tech-panel" style={{ flex: 1 }}>
              <div className="panel-title">沉降监测概况</div>
              <div className="stats-grid-circles">
                <div className="stat-circle">
                  <span style={{ fontSize: 18, color: '#00e5ff', fontWeight: 'bold' }}>
                    {summaryData?.settlement?.total_points ?? 0}
                  </span>
                  <span style={{ fontSize: 10, color: '#ccc' }}>监测点</span>
                </div>
                <div className="stat-circle">
                  <span style={{ fontSize: 18, color: '#faad14', fontWeight: 'bold' }}>
                    {summaryData?.settlement?.alert_count ?? 0}
                  </span>
                  <span style={{ fontSize: 10, color: '#ccc' }}>预警</span>
                </div>
                <div className="stat-circle">
                  <span style={{ fontSize: 16, color: '#ff4d4f', fontWeight: 'bold' }}>
                    {summaryData?.settlement?.max_value ?? 0}mm
                  </span>
                  <span style={{ fontSize: 10, color: '#ccc' }}>最大值</span>
                </div>
              </div>
              <div className="panel-title" style={{ marginTop: 15 }}>趋势分布</div>
              <div ref={trendChartRef} className="chart-container-flex" style={{ minHeight: 150 }} />
            </div>

            {/* Cracks Stats */}
            <div className="tech-panel" style={{ flex: 1 }}>
              <div className="panel-title">裂缝监测概况</div>
              <div className="stats-grid-circles">
                <div className="stat-circle">
                  <span style={{ fontSize: 18, color: '#00e5ff', fontWeight: 'bold' }}>
                    {summaryData?.cracks?.total_points ?? 0}
                  </span>
                  <span style={{ fontSize: 10, color: '#ccc' }}>监测点</span>
                </div>
                <div className="stat-circle">
                  <span style={{ fontSize: 18, color: '#ff4d4f', fontWeight: 'bold' }}>
                    {summaryData?.cracks?.expanding_count ?? 0}
                  </span>
                  <span style={{ fontSize: 10, color: '#ccc' }}>扩展</span>
                </div>
                <div className="stat-circle">
                  <span style={{ fontSize: 18, color: '#52c41a', fontWeight: 'bold' }}>
                    {summaryData?.cracks?.stable_count ?? 0}
                  </span>
                  <span style={{ fontSize: 10, color: '#ccc' }}>稳定</span>
                </div>
              </div>
            </div>
          </div>

          {/* === CENTER COLUMN === */}
          <div style={{ display: 'grid', gridTemplateRows: '1fr 220px', gap: 15 }}>
            {/* Center Top: Radar Chart */}
            <div className="tech-panel">
              <div className="panel-title">综合风险评估</div>
              <div ref={radarChartRef} className="chart-container-flex" />
            </div>

            {/* Center Bottom: Temperature */}
            <div className="tech-panel">
              <div className="panel-title">
                温度监测 ({summaryData?.temperature?.total_sensors ?? 0} 传感器)
              </div>
              <div ref={tempChartRef} className="chart-container-flex" />
            </div>
          </div>

          {/* === RIGHT COLUMN === */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 15 }}>
            {/* Gauge */}
            <div className="tech-panel" style={{ flex: 1 }}>
              <div className="panel-title">项目安全总览</div>
              <div className="score-gauge-wrapper">
                <div ref={gaugeChartRef} style={{ width: '100%', height: '100%' }} />
              </div>
            </div>

            {/* Vibration Stats */}
            <div className="tech-panel" style={{ flex: 1 }}>
              <div className="panel-title">振动监测</div>
              <div className="stats-grid-circles" style={{ justifyContent: 'center' }}>
                <div className="stat-circle" style={{ width: 90, height: 90 }}>
                  <span style={{ fontSize: 24, color: '#00e5ff', fontWeight: 'bold' }}>
                    {summaryData?.vibration?.total_datasets ?? 0}
                  </span>
                  <span style={{ fontSize: 10, color: '#ccc' }}>数据集</span>
                </div>
              </div>
              <div style={{ textAlign: 'center', marginTop: 10, color: '#52c41a' }}>
                状态: {summaryData?.vibration?.status === 'normal' ? '正常' : '异常'}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Overview;
