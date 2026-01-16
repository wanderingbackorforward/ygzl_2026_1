import React, { useEffect, useRef, useState } from 'react';
import * as echarts from 'echarts';
import './Overview.css';

// Mock Data Generators
const generateTrendData = (days = 7) => {
  const data = [];
  const dates = [];
  const today = new Date();
  for (let i = 0; i < days; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - (days - i - 1));
    dates.push(`${d.getMonth() + 1}/${d.getDate()}`);
    data.push(Math.floor(Math.random() * 50) + 20);
  }
  return { dates, data };
};

const mockSettlementPoints = [
  { id: 'PT-001', location: 'Zone A - North', value: 12.5 },
  { id: 'PT-024', location: 'Zone B - East', value: 10.2 },
  { id: 'PT-015', location: 'Zone A - South', value: 9.8 },
  { id: 'PT-033', location: 'Zone C - West', value: 8.4 },
  { id: 'PT-008', location: 'Zone B - Center', value: 7.1 },
];

const Overview: React.FC = () => {
  const [currentTime, setCurrentTime] = useState(new Date());
  
  // Refs for Chart Containers
  const trendChartRef = useRef<HTMLDivElement>(null);
  const tempChartRef = useRef<HTMLDivElement>(null);
  const crackChartRef = useRef<HTMLDivElement>(null);
  
  // Refs for Chart Instances
  const chartsRef = useRef<echarts.ECharts[]>([]);

  // Clock
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Initialize Charts
  useEffect(() => {
    const initCharts = () => {
      // 1. Settlement Trend Chart (Bar/Line)
      if (trendChartRef.current) {
        const chart = echarts.init(trendChartRef.current);
        const { dates, data } = generateTrendData();
        
        chart.setOption({
          backgroundColor: 'transparent',
          tooltip: { trigger: 'axis' },
          grid: { top: 30, right: 10, bottom: 20, left: 30, containLabel: true },
          xAxis: {
            type: 'category',
            data: dates,
            axisLine: { lineStyle: { color: 'rgba(0, 240, 255, 0.3)' } },
            axisLabel: { color: '#7da5b5' }
          },
          yAxis: {
            type: 'value',
            splitLine: { lineStyle: { color: 'rgba(0, 240, 255, 0.1)' } },
            axisLabel: { color: '#7da5b5' }
          },
          series: [{
            name: 'Settlement',
            type: 'line',
            smooth: true,
            showSymbol: false,
            data: data,
            areaStyle: {
              color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                { offset: 0, color: 'rgba(0, 240, 255, 0.5)' },
                { offset: 1, color: 'rgba(0, 240, 255, 0)' }
              ])
            },
            itemStyle: { color: '#00f0ff' },
            lineStyle: { width: 3 }
          }]
        });
        chartsRef.current.push(chart);
      }

      // 2. Temperature Distribution (Line)
      if (tempChartRef.current) {
        const chart = echarts.init(tempChartRef.current);
        const { dates, data } = generateTrendData(24); // 24 hours
        const tempData = data.map(v => 20 + Math.random() * 10); // 20-30 degrees
        
        chart.setOption({
          backgroundColor: 'transparent',
          tooltip: { trigger: 'axis' },
          grid: { top: 30, right: 10, bottom: 20, left: 30, containLabel: true },
          xAxis: {
            type: 'category',
            data: dates.map((_, i) => `${i}:00`),
            axisLine: { lineStyle: { color: 'rgba(255, 149, 0, 0.3)' } },
            axisLabel: { color: '#7da5b5', interval: 4 }
          },
          yAxis: {
            type: 'value',
            splitLine: { lineStyle: { color: 'rgba(255, 149, 0, 0.1)' } },
            axisLabel: { color: '#7da5b5' }
          },
          series: [{
            name: 'Temp',
            type: 'line',
            smooth: true,
            data: tempData,
            itemStyle: { color: '#ff9500' },
            lineStyle: { color: '#ff9500' }
          }]
        });
        chartsRef.current.push(chart);
      }

      // 3. Crack/Alert Status (Pie)
      if (crackChartRef.current) {
        const chart = echarts.init(crackChartRef.current);
        chart.setOption({
          backgroundColor: 'transparent',
          tooltip: { trigger: 'item' },
          legend: { 
            bottom: 0, 
            textStyle: { color: '#7da5b5' },
            itemWidth: 10,
            itemHeight: 10
          },
          series: [
            {
              name: 'Alert Level',
              type: 'pie',
              radius: ['40%', '70%'],
              center: ['50%', '45%'],
              avoidLabelOverlap: false,
              itemStyle: {
                borderRadius: 5,
                borderColor: '#050a14',
                borderWidth: 2
              },
              label: { show: false },
              data: [
                { value: 1048, name: 'Normal', itemStyle: { color: '#00f0ff' } },
                { value: 735, name: 'Warning', itemStyle: { color: '#ff9500' } },
                { value: 180, name: 'Critical', itemStyle: { color: '#ff4d4f' } }
              ]
            }
          ]
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
        <div className="header-decoration" />
        <div className="header-title">DIGITAL TWIN COCKPIT</div>
        <div className="header-time">
          {currentTime.toLocaleTimeString('en-US', { hour12: false })}
        </div>
      </header>

      {/* Main Grid */}
      <div className="dashboard-grid">
        
        {/* Left Column */}
        <div className="tech-panel" style={{ gridRow: '1 / 3' }}>
          <div className="panel-title">TOP SETTLEMENT POINTS</div>
          <div className="data-list">
            {mockSettlementPoints.map((pt, idx) => (
              <div key={pt.id} className="list-item">
                <span className={`rank-badge rank-${idx + 1}`}>{idx + 1}</span>
                <span style={{ flex: 1, marginLeft: 10, color: '#e0f7ff' }}>{pt.location}</span>
                <span style={{ color: '#00f0ff', fontFamily: 'monospace' }}>{pt.value}mm</span>
              </div>
            ))}
          </div>
          
          <div className="panel-title" style={{ marginTop: 20 }}>ALERT DISTRIBUTION</div>
          <div ref={crackChartRef} className="chart-container" style={{ minHeight: 200 }} />
        </div>

        {/* Center Top - Map/3D Placeholder */}
        <div className="central-map-container" style={{ gridRow: '1 / 2' }}>
          {/* Map Overlay Stats */}
          <div className="map-overlay-stat map-stat-top-left">
            <div style={{ fontSize: 12, color: '#aaa' }}>TOTAL SENSORS</div>
            <div style={{ fontSize: 24, fontWeight: 'bold', color: '#00f0ff' }}>1,248</div>
          </div>
          <div className="map-overlay-stat map-stat-top-right">
            <div style={{ fontSize: 12, color: '#aaa' }}>ACTIVE ALERTS</div>
            <div style={{ fontSize: 24, fontWeight: 'bold', color: '#ff4d4f' }}>12</div>
          </div>

          {/* Placeholder for 3D Model */}
          <div className="map-placeholder">
            <div style={{ textAlign: 'center' }}>
              <div style={{ 
                width: 100, height: 100, 
                border: '2px dashed #007aff', 
                borderRadius: '50%', 
                margin: '0 auto 20px',
                display: 'flex', alignItems: 'center', justifyContent: 'center'
              }}>
                3D
              </div>
              <div>TERRAIN DIGITAL TWIN MODEL</div>
              <div style={{ fontSize: 12, opacity: 0.6, marginTop: 5 }}>Interactive WebGL View Loading...</div>
            </div>
          </div>
        </div>

        {/* Center Bottom - Stats Row */}
        <div style={{ gridRow: '2 / 3', display: 'flex', gap: 16 }}>
          <div className="tech-panel" style={{ flex: 1 }}>
            <div className="panel-title">SETTLEMENT TREND (7D)</div>
            <div ref={trendChartRef} className="chart-container" />
          </div>
          <div className="tech-panel" style={{ flex: 1 }}>
            <div className="panel-title">ENV TEMPERATURE (24H)</div>
            <div ref={tempChartRef} className="chart-container" />
          </div>
        </div>

        {/* Right Column */}
        <div className="tech-panel" style={{ gridRow: '1 / 3' }}>
          <div className="panel-title">KEY METRICS</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div className="stat-card">
              <div className="stat-value">62.4</div>
              <div className="stat-label">Safety Score</div>
            </div>
            <div className="stat-card">
              <div className="stat-value" style={{ color: '#ff9500' }}>24.5°C</div>
              <div className="stat-label">Avg Temp</div>
            </div>
            <div className="stat-card">
              <div className="stat-value" style={{ color: '#ff4d4f' }}>3</div>
              <div className="stat-label">Critical Cracks</div>
            </div>
            <div className="stat-card">
              <div className="stat-value" style={{ color: '#00f0ff' }}>0.4g</div>
              <div className="stat-label">Max Vibration</div>
            </div>
          </div>

          <div className="panel-title" style={{ marginTop: 20 }}>SYSTEM LOGS</div>
          <div className="data-list">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="list-item" style={{ fontSize: 11 }}>
                <span style={{ color: '#7da5b5' }}>{`10:${30-i}:00`}</span>
                <span style={{ marginLeft: 10 }}>Sensor #{100+i} data sync...</span>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
};

export default Overview;
