import React, { useEffect, useRef, useState } from 'react';
import * as echarts from 'echarts';
import './Overview.css';

// --- Mock Data (Localized) ---
const MOCK_SETTLEMENT_RANKS = [
  { id: 1, name: 'A区-北侧基坑', city: '监测点01', value: 12.5 },
  { id: 2, name: 'B区-东侧边坡', city: '监测点02', value: 10.2 },
  { id: 3, name: 'A区-南侧入口', city: '监测点03', value: 9.8 },
  { id: 4, name: 'C区-西侧围墙', city: '监测点04', value: 8.4 },
  { id: 5, name: 'B区-中心立柱', city: '监测点05', value: 7.1 },
  { id: 6, name: 'D区-临时道路', city: '监测点06', value: 6.5 },
  { id: 7, name: 'A区-排水渠', city: '监测点07', value: 5.9 },
  { id: 8, name: 'C区-配电房', city: '监测点08', value: 4.2 },
];

const MOCK_LOGS = [
  { time: '10:32:45', msg: '传感器 #1024 数据同步完成' },
  { time: '10:31:20', msg: '监测点 A-03 触发黄色预警' },
  { time: '10:30:15', msg: '系统自检完成，状态正常' },
  { time: '10:28:00', msg: '新增监测数据 156 条' },
  { time: '10:25:33', msg: '用户 Admin 登录系统' },
];

const Overview: React.FC = () => {
  const [currentTime, setCurrentTime] = useState(new Date());

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

  // Initialize Charts
  useEffect(() => {
    const initCharts = () => {
      // 1. Safety Score Gauge (Right Panel - Top)
      if (gaugeChartRef.current) {
        const chart = echarts.init(gaugeChartRef.current);
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
              data: [{ value: 92.4, name: '安全评分' }]
            }
          ]
        });
        chartsRef.current.push(chart);
      }

      // 2. Settlement Trend (Bottom Center - Left)
      if (trendChartRef.current) {
        const chart = echarts.init(trendChartRef.current);
        const dates = Array.from({ length: 7 }, (_, i) => `7/${13 + i}`);
        chart.setOption({
          tooltip: { trigger: 'axis' },
          grid: { top: 30, right: 10, bottom: 20, left: 30, containLabel: true },
          xAxis: {
            type: 'category',
            data: dates,
            axisLine: { lineStyle: { color: 'rgba(0, 229, 255, 0.3)' } },
            axisLabel: { color: '#8ba0b6' }
          },
          yAxis: {
            type: 'value',
            splitLine: { lineStyle: { color: 'rgba(0, 229, 255, 0.1)' } },
            axisLabel: { color: '#8ba0b6' }
          },
          series: [{
            name: '沉降量(mm)',
            type: 'line',
            smooth: true,
            data: [12, 13.5, 12.8, 14.2, 13.9, 15.1, 14.8],
            areaStyle: {
              color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                { offset: 0, color: 'rgba(0, 229, 255, 0.4)' },
                { offset: 1, color: 'rgba(0, 229, 255, 0)' }
              ])
            },
            itemStyle: { color: '#00e5ff' }
          }]
        });
        chartsRef.current.push(chart);
      }

      // 3. Temp/Env Trend (Bottom Center - Right)
      if (tempChartRef.current) {
        const chart = echarts.init(tempChartRef.current);
        const hours = ['08', '12', '16', '20', '00', '04'];
        chart.setOption({
          tooltip: { trigger: 'axis' },
          grid: { top: 30, right: 10, bottom: 20, left: 30, containLabel: true },
          xAxis: {
            type: 'category',
            data: hours,
            axisLine: { lineStyle: { color: 'rgba(250, 173, 20, 0.3)' } },
            axisLabel: { color: '#8ba0b6' }
          },
          yAxis: {
            type: 'value',
            splitLine: { lineStyle: { color: 'rgba(250, 173, 20, 0.1)' } },
            axisLabel: { color: '#8ba0b6' }
          },
          series: [{
            name: '温度(°C)',
            type: 'line',
            smooth: true,
            data: [22, 28, 26, 20, 18, 17],
            itemStyle: { color: '#faad14' },
            lineStyle: { width: 2, type: 'dashed' }
          }]
        });
        chartsRef.current.push(chart);
      }

      // 4. Radar Chart (Bottom Left)
      if (radarChartRef.current) {
        const chart = echarts.init(radarChartRef.current);
        chart.setOption({
          radar: {
            indicator: [
              { name: '沉降', max: 100 },
              { name: '裂缝', max: 100 },
              { name: '温度', max: 100 },
              { name: '振动', max: 100 },
              { name: '应力', max: 100 }
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
                value: [80, 40, 60, 20, 50],
                name: '各项指标监测',
                areaStyle: { color: 'rgba(0, 229, 255, 0.4)' },
                itemStyle: { color: '#00e5ff' }
              }
            ]
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

      {/* Main Grid */}
      <div className="dashboard-grid">

        {/* === LEFT COLUMN === */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 15 }}>
          {/* Top 10 List */}
          <div className="tech-panel" style={{ flex: 1.5 }}>
            <div className="panel-title">各监测点沉降排行 TOP8</div>
            <div className="data-row header-row">
              <span style={{ width: 20 }}>#</span>
              <span style={{ flex: 1 }}>监测点名称</span>
              <span style={{ width: 80, textAlign: 'right' }}>沉降量</span>
            </div>
            <div className="data-list">
              {MOCK_SETTLEMENT_RANKS.map((item, idx) => (
                <div key={item.id} className="data-row">
                  <span className={`rank-idx ${idx < 3 ? 'rank-top' : ''}`}>NO.{idx + 1}</span>
                  <span style={{ flex: 1 }}>{item.name}</span>
                  <span style={{ width: 80, textAlign: 'right', color: '#00e5ff' }}>{item.value}mm</span>
                </div>
              ))}
            </div>
          </div>

          {/* Radar Chart */}
          <div className="tech-panel" style={{ flex: 1 }}>
            <div className="panel-title">综合风险评估</div>
            <div ref={radarChartRef} className="chart-container-flex" />
          </div>
        </div>

        {/* === CENTER COLUMN === */}
        <div style={{ display: 'grid', gridTemplateRows: '1fr 220px', gap: 15 }}>
          {/* Center Top: Map */}
          <div className="tech-panel" style={{ padding: 0, overflow: 'hidden' }}>
            <div className="central-map-bg">
              <div className="map-header-stats">
                <div className="map-stat-box">
                  <div className="map-stat-value">45</div>
                  <div className="map-stat-label">监测区域 (个)</div>
                </div>
                <div className="map-stat-box" style={{ borderColor: 'var(--tech-accent)' }}>
                  <div className="map-stat-value" style={{ color: 'var(--tech-accent)' }}>32</div>
                  <div className="map-stat-label">报警点位 (个)</div>
                </div>
              </div>
              {/* Placeholder for real 3D/Map */}
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0.5 }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 60, color: '#1890ff' }}>MAP VISUALIZATION</div>
                  <div>三维数字孪生底座 (待接入)</div>
                </div>
              </div>
            </div>
          </div>

          {/* Center Bottom: Trends */}
          <div style={{ display: 'flex', gap: 15 }}>
            <div className="tech-panel" style={{ flex: 1 }}>
              <div className="panel-title">近期沉降走势</div>
              <div ref={trendChartRef} className="chart-container-flex" />
            </div>
            <div className="tech-panel" style={{ flex: 1 }}>
              <div className="panel-title">环境温度监测</div>
              <div ref={tempChartRef} className="chart-container-flex" />
            </div>
          </div>
        </div>

        {/* === RIGHT COLUMN === */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 15 }}>
          {/* Gauge & Stats */}
          <div className="tech-panel" style={{ flex: 1 }}>
            <div className="panel-title">项目安全总览</div>
            <div className="score-gauge-wrapper">
              <div ref={gaugeChartRef} style={{ width: '100%', height: '100%' }} />
            </div>

            <div className="panel-title" style={{ marginTop: 10 }}>核心指标</div>
            <div className="stats-grid-circles">
              <div className="stat-circle">
                <span style={{ fontSize: 18, color: '#00e5ff', fontWeight: 'bold' }}>12</span>
                <span style={{ fontSize: 10, color: '#ccc' }}>在线</span>
              </div>
              <div className="stat-circle">
                <span style={{ fontSize: 18, color: '#faad14', fontWeight: 'bold' }}>3</span>
                <span style={{ fontSize: 10, color: '#ccc' }}>预警</span>
              </div>
              <div className="stat-circle">
                <span style={{ fontSize: 18, color: '#52c41a', fontWeight: 'bold' }}>100%</span>
                <span style={{ fontSize: 10, color: '#ccc' }}>完好</span>
              </div>
            </div>
          </div>

          {/* System Logs */}
          <div className="tech-panel" style={{ flex: 1.2 }}>
            <div className="panel-title">系统运行日志</div>
            <div className="data-list">
              {MOCK_LOGS.map((log, i) => (
                <div key={i} className="data-row" style={{ fontSize: 12 }}>
                  <span style={{ color: '#00e5ff', marginRight: 10 }}>[{log.time}]</span>
                  <span style={{ color: '#e6f7ff' }}>{log.msg}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};

export default Overview;
