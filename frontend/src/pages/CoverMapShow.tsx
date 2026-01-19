import React, { useEffect, useMemo, useRef, useState } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import './CoverMapShow.css'

type ProjectFeature = { name: string, icon: string }
type ProjectRisk = { name: string, loc: string, action: string }
type ProjectDevice = { name: string, count: string, icon: string }
type ProjectZone = {
  id: string
  type: string
  range: [number, number]
  title: string
  subTitle: string
  scope: string
  features: ProjectFeature[]
  displacement: string
  envDesc: string
  pcRate: string
  risks: ProjectRisk[]
  devices: ProjectDevice[]
}

const projectData: ProjectZone[] = [
  {
    id: '01',
    type: '罗山路立交段',
    range: [0, 40],
    title: '01标段',
    subTitle: '罗山路立交节点改建',
    scope: '本标段主要涉及罗山路立交区域的地面道路改建及地下通道衔接。重点保护罗山路高架桥墩，实施高难度低净空作业。',
    features: [
      { name: '桥梁保护系统', icon: 'fa-bridge-water' },
      { name: '全预制拼装', icon: 'fa-cubes' },
      { name: '低净空打桩', icon: 'fa-hammer' },
      { name: 'BIM管线综合', icon: 'fa-project-diagram' },
    ],
    displacement: '-1.5 ~ 0.8',
    envDesc: '立交桥下施工空间狭窄，已部署自动化监测机器人全天候监测桥墩沉降。',
    pcRate: '95%',
    risks: [
      { name: '高架桥墩沉降', loc: '罗山路立交下', action: '自动化监测+注浆加固' },
      { name: '管线碰撞', loc: '路口交叉处', action: '物探+BIM模拟开挖' },
    ],
    devices: [
      { name: '静力水准仪', count: '已部署', icon: 'fa-water' },
      { name: '测斜管', count: '重点区域', icon: 'fa-ruler-vertical' },
      { name: '扬尘监控', count: '2套', icon: 'fa-wind' },
      { name: 'AI视频终端', count: '全覆盖', icon: 'fa-video' },
    ],
  },
  {
    id: '02',
    type: '云山路下立交',
    range: [40, 70],
    title: '02标段',
    subTitle: '云山路下立交及隧道主体',
    scope: '实施云山路下立交结构，包含全封闭隔音棚安装，降低对周边居民区影响。主体结构采用明挖法施工。',
    features: [
      { name: '全封闭隔音棚', icon: 'fa-volume-xmark' },
      { name: '深基坑开挖', icon: 'fa-dungeon' },
      { name: '管线原位保护', icon: 'fa-shield-halved' },
      { name: '交通翻交', icon: 'fa-shuffle' },
    ],
    displacement: '-2.1 ~ 1.5',
    envDesc: '周边居民区密集（碧云社区等），严格控制夜间施工噪音与光污染。隔音棚已启用。',
    pcRate: '85%',
    risks: [
      { name: '深基坑变形', loc: '云山路口', action: '钢支撑伺服系统' },
      { name: '噪音扰民', loc: '沿线住宅', action: '全封闭隔音棚' },
    ],
    devices: [
      { name: '轴力计', count: '每道支撑', icon: 'fa-weight-hanging' },
      { name: '噪音监测屏', count: '4套', icon: 'fa-ear-listen' },
      { name: '地下水位计', count: '每日一测', icon: 'fa-droplet' },
      { name: '无人机巡检', count: '每日', icon: 'fa-plane' },
    ],
  },
  {
    id: '03',
    type: '金海路终点段',
    range: [70, 100],
    title: '03标段',
    subTitle: '金京路 - 金海路衔接段',
    scope: '工程终点段，涉及与外环高速的交通流衔接。包含路面铺装、景观绿化及智能交通设施安装。',
    features: [
      { name: '智能交通杆', icon: 'fa-traffic-light' },
      { name: '海绵城市路面', icon: 'fa-cloud-showers-heavy' },
      { name: '景观一体化', icon: 'fa-tree' },
      { name: '智慧路灯', icon: 'fa-lightbulb' },
    ],
    displacement: '-0.5 ~ 0.2',
    envDesc: '处于工程收尾与设备调试阶段，重点关注路面平整度与机电设备联调联试。',
    pcRate: '100%',
    risks: [
      { name: '交通拥堵', loc: '金海路口', action: '智能信号灯调优' },
      { name: '成品保护', loc: '全线', action: '封闭管理' },
    ],
    devices: [
      { name: '车流检测器', count: '主要路口', icon: 'fa-car' },
      { name: '路面平整仪', count: '移动监测', icon: 'fa-road' },
      { name: '气象站', count: '1套', icon: 'fa-cloud-sun' },
      { name: '可变情报板', count: '3处', icon: 'fa-tv' },
    ],
  },
]

const pathCoords: [number, number][] = [
  [31.233, 121.560],
  [31.238, 121.568],
  [31.245, 121.575],
  [31.250, 121.582],
  [31.255, 121.590],
  [31.265, 121.610],
]

export default function CoverMapShow() {
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<L.Map | null>(null)
  const routeLineRef = useRef<L.Polyline | null>(null)
  const markerRef = useRef<L.Marker | null>(null)

  const tiltContainerRef = useRef<HTMLDivElement>(null)

  const [currentTime, setCurrentTime] = useState(() => new Date())
  const [sliderValue, setSliderValue] = useState(0)
  const [flipped, setFlipped] = useState(false)
  const [displacementBarWidth, setDisplacementBarWidth] = useState(20)
  const [pmBarWidth, setPmBarWidth] = useState(45)

  const activeZone = useMemo<ProjectZone>(() => {
    if (sliderValue > 70) return projectData[2]
    if (sliderValue > 40) return projectData[1]
    return projectData[0]
  }, [sliderValue])

  useEffect(() => {
    const timer = window.setInterval(() => setCurrentTime(new Date()), 1000)
    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    setDisplacementBarWidth(Math.floor(Math.random() * 40 + 20))
    setPmBarWidth(Math.floor(Math.random() * 30 + 30))
    setFlipped(false)
  }, [activeZone.id])

  useEffect(() => {
    if (!mapContainerRef.current) return
    if (mapRef.current) return

    const map = L.map(mapContainerRef.current, {
      zoomControl: false,
      attributionControl: false,
      dragging: false,
      scrollWheelZoom: false,
      doubleClickZoom: false,
    }).setView([31.245, 121.575], 14)

    L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
      maxZoom: 18,
    }).addTo(map)

    L.polyline(pathCoords, { color: '#00f0ff', weight: 6, opacity: 0.6 }).addTo(map)
    const routeLine = L.polyline(pathCoords, { color: '#fff', weight: 2, dashArray: '5, 10', opacity: 0.8 }).addTo(map)

    const nodes = [pathCoords[0], pathCoords[2], pathCoords[5]]
    nodes.forEach((coord) => {
      L.circleMarker(coord, { radius: 4, color: '#fff', fillColor: '#000', fillOpacity: 1, weight: 2 }).addTo(map)
    })

    const iconHtml = `
      <div class="relative w-10 h-10 flex items-center justify-center">
        <div class="absolute inset-0 bg-cyan-500/30 rounded-full animate-ping"></div>
        <div class="absolute inset-2 border-2 border-cyan-400 rounded-full bg-black/80 flex items-center justify-center">
          <i class="fas fa-location-crosshairs text-cyan-400 text-xs"></i>
        </div>
      </div>
    `

    const marker = L.marker(pathCoords[0], {
      icon: L.divIcon({ html: iconHtml, className: 'bg-transparent', iconSize: [40, 40], iconAnchor: [20, 20] }),
    }).addTo(map)

    mapRef.current = map
    routeLineRef.current = routeLine
    markerRef.current = marker

    const handleResize = () => map.invalidateSize()
    window.addEventListener('resize', handleResize)

    return () => {
      window.removeEventListener('resize', handleResize)
      map.remove()
      mapRef.current = null
      routeLineRef.current = null
      markerRef.current = null
    }
  }, [])

  useEffect(() => {
    const map = mapRef.current
    const routeLine = routeLineRef.current
    const marker = markerRef.current
    if (!map || !routeLine || !marker) return

    const points = routeLine.getLatLngs() as L.LatLng[]
    const totalLength = points.length - 1
    const segmentSize = 100 / totalLength

    if (sliderValue >= 100) {
      marker.setLatLng(points[totalLength])
      map.panTo(points[totalLength], { animate: true, duration: 0.1 })
      return
    }

    const segmentIndex = Math.min(Math.floor(sliderValue / segmentSize), totalLength - 1)
    const segmentPercent = (sliderValue % segmentSize) / segmentSize

    const p1 = points[segmentIndex]
    const p2 = points[segmentIndex + 1]

    const lat = p1.lat + (p2.lat - p1.lat) * segmentPercent
    const lng = p1.lng + (p2.lng - p1.lng) * segmentPercent
    const newPos = L.latLng(lat, lng)

    marker.setLatLng(newPos)
    map.panTo(newPos, { animate: true, duration: 0.1 })
  }, [sliderValue])

  const handleTiltMouseMove = (e: React.MouseEvent) => {
    if (flipped) return
    const el = tiltContainerRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const x = (e.clientX - rect.left) / rect.width - 0.5
    const y = (e.clientY - rect.top) / rect.height - 0.5
    el.style.transform = `rotateY(${x * 10}deg) rotateX(${-y * 10}deg)`
  }

  const handleTiltMouseLeave = () => {
    const el = tiltContainerRef.current
    if (!el) return
    el.style.transform = 'rotateY(0deg) rotateX(0deg)'
  }

  const handleFlip = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement
    if (target.closest('button')) return
    setFlipped(true)
    handleTiltMouseLeave()
  }

  return (
    <div className="mapShowRoot selection:bg-cyan-500 selection:text-white">
      <div className="scanlines" />
      <div className="absolute inset-0 pointer-events-none z-10 bg-[radial-gradient(circle_at_center,transparent_20%,rgba(0,0,0,0.8)_100%)]" />

      <div ref={mapContainerRef} className="absolute inset-0 z-0" />

      <header className="absolute top-0 left-0 w-full z-20 p-6 flex justify-between items-start bg-gradient-to-b from-black/95 to-transparent pointer-events-none">
        <div className="flex items-center gap-5 pointer-events-auto group">
          <div className="h-12 w-1.5 bg-cyan-400 shadow-[0_0_20px_#22d3ee]" />
          <div>
            <h1 className="text-3xl font-black tracking-wider text-white font-tech text-glow">上海杨高中路改建工程</h1>
            <div className="flex items-center gap-3 mt-1">
              <span className="px-2 py-0.5 bg-blue-900/60 border border-blue-400/30 rounded text-[11px] text-blue-300">智慧隧道</span>
              <p className="text-sm text-gray-400 tracking-wider">罗山路立交 - 金海路段 · 数字化指挥中心</p>
            </div>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1 font-tech pointer-events-auto">
          <div className="flex items-center gap-4 bg-black/60 px-4 py-2 rounded-full border border-white/10 backdrop-blur-md">
            <div className="flex items-center gap-2">
              <span className="status-dot status-active" />
              <span className="text-xs text-gray-300">系统运行中</span>
            </div>
            <div className="h-4 w-[1px] bg-white/20" />
            <div className="text-lg font-bold text-white tabular-nums">
              {currentTime.toLocaleTimeString('zh-CN', { hour12: false })}
            </div>
          </div>
        </div>
      </header>

      <aside className="absolute top-28 left-8 w-80 z-20 flex flex-col gap-5 pointer-events-none">
        <div className="glass-panel p-6 rounded-lg pointer-events-auto border-l-4 border-l-cyan-400">
          <h3 className="text-cyan-400 text-xs font-bold mb-4 flex items-center justify-between uppercase tracking-widest">
            <span><i className="fas fa-network-wired mr-2" />数字孪生状态</span>
          </h3>

          <div className="flex items-end justify-between mb-4">
            <div>
              <div className="text-[10px] text-gray-400 mb-1">当前监控标段</div>
              <div className="text-4xl font-black text-white font-tech text-glow">{activeZone.id}</div>
            </div>
            <div className="text-right">
              <div className="text-[10px] text-gray-400 mb-1">工程类型</div>
              <div className="text-xs font-bold text-white bg-blue-600/30 px-2 py-1 rounded border border-blue-500/30">{activeZone.type}</div>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex justify-between text-xs">
              <span className="text-gray-400">BIM模型精度</span>
              <span className="text-cyan-300 font-tech">LOD 400</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-gray-400">传感器在线率</span>
              <span className="text-emerald-400 font-tech">99.8%</span>
            </div>
          </div>
        </div>

        <div className="glass-panel p-5 rounded-lg pointer-events-auto">
          <h3 className="text-orange-400 text-xs font-bold mb-4 flex items-center uppercase tracking-widest">
            <i className="fas fa-hard-hat mr-2" /> 实时监测参数
          </h3>
          <div className="space-y-4">
            <div>
              <div className="flex justify-between text-[10px] text-gray-400 mb-1">
                <span>深基坑水平位移 (mm)</span>
                <span className="text-white font-tech">{activeZone.displacement}</span>
              </div>
              <div className="flex h-1 w-full bg-gray-800 rounded-full overflow-hidden">
                <div className="bg-orange-500 h-full transition-all duration-500" style={{ width: `${displacementBarWidth}%` }} />
              </div>
            </div>

            <div>
              <div className="flex justify-between text-[10px] text-gray-400 mb-1">
                <span>PM2.5 / PM10 (μg/m³)</span>
                <span className="text-white font-tech">35 / 62</span>
              </div>
              <div className="flex h-1 w-full bg-gray-800 rounded-full overflow-hidden">
                <div className="bg-emerald-500 h-full transition-all duration-500" style={{ width: `${pmBarWidth}%` }} />
              </div>
            </div>

            <div className="mt-2 bg-white/5 p-2 rounded border border-white/5">
              <p className="text-[10px] text-gray-400 leading-relaxed">
                {activeZone.envDesc}
              </p>
            </div>
          </div>
        </div>
      </aside>

      <aside className="absolute top-28 right-8 w-[420px] z-20 pointer-events-none">
        <div
          ref={tiltContainerRef}
          className="tilt-wrapper w-full pointer-events-auto cursor-pointer group"
          onMouseMove={handleTiltMouseMove}
          onMouseLeave={handleTiltMouseLeave}
          onClick={handleFlip}
        >
          <div className={`flip-card-inner${flipped ? ' flipped' : ''}`}>
            <div className="flip-card-front glass-panel">
              <div className="h-32 w-full bg-[url('https://images.unsplash.com/photo-1496568816309-51d7c20e3b21?q=80&w=2031&auto=format&fit=crop')] bg-cover bg-center relative mask-image-gradient">
                <div className="absolute inset-0 bg-gradient-to-t from-[#020617] to-transparent" />
                <div className="absolute bottom-4 left-6">
                  <h2 className="text-2xl font-black text-white tracking-wide">{activeZone.title}</h2>
                  <p className="text-xs text-cyan-300 font-bold mt-1">{activeZone.subTitle}</p>
                </div>
              </div>

              <div className="flex-1 p-6 flex flex-col gap-4 relative z-10 custom-scroll">
                <div className="bg-blue-900/20 p-3 rounded border border-blue-500/20">
                  <p className="text-[10px] text-blue-300 font-bold mb-1 uppercase">工程概况 SCOPE</p>
                  <p className="text-xs text-gray-300 leading-relaxed text-justify">{activeZone.scope}</p>
                </div>

                <div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-[10px] text-gray-500 font-bold uppercase">智慧建造亮点 HIGHLIGHTS</span>
                    <i className="fas fa-cube text-cyan-500 text-xs" />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {activeZone.features.map((f) => (
                      <div key={f.name} className="feature-tag">
                        <span className="text-gray-300 text-[10px]">{f.name}</span>
                        <i className={`fas ${f.icon} text-cyan-400 text-xs`} />
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-xs text-gray-400 mb-1">
                    <span>PC构件预制拼装率</span>
                    <span className="text-white font-tech">{activeZone.pcRate}</span>
                  </div>
                  <div className="h-1.5 w-full bg-gray-800 rounded-full overflow-hidden">
                    <div className="bg-gradient-to-r from-cyan-500 to-blue-500 h-full" style={{ width: activeZone.pcRate }} />
                  </div>
                </div>
              </div>

              <div className="p-4 border-t border-white/5 flex justify-between items-center bg-black/20">
                <span className="text-[10px] text-gray-500">点击卡片查看设备与风险源清单</span>
                <div className="w-6 h-6 rounded-full border border-cyan-500/50 flex items-center justify-center animate-pulse">
                  <i className="fas fa-arrow-right text-cyan-500 text-[10px]" />
                </div>
              </div>
            </div>

            <div className="flip-card-back glass-panel">
              <div className="h-16 bg-blue-900/20 flex items-center justify-between px-6 border-b border-cyan-500/30">
                <div>
                  <h3 className="text-sm font-bold text-white">技术指标与设备矩阵</h3>
                  <p className="text-[10px] text-cyan-400">DATA MATRIX</p>
                </div>
                <i className="fas fa-database text-cyan-500 text-lg opacity-50" />
              </div>

              <div className="flex-1 overflow-hidden p-6 relative">
                <div className="custom-scroll h-full pr-2 space-y-6">
                  <div>
                    <div className="flex items-center gap-2 mb-3 text-xs text-orange-400 font-bold">
                      <i className="fas fa-exclamation-triangle" />
                      <span>一级风险源管控</span>
                    </div>
                    <table className="tech-table">
                      <thead>
                        <tr>
                          <th>风险名称</th>
                          <th>位置</th>
                          <th>管控措施</th>
                        </tr>
                      </thead>
                      <tbody>
                        {activeZone.risks.map((r) => (
                          <tr key={`${r.name}-${r.loc}`}>
                            <td>{r.name}</td>
                            <td>{r.loc}</td>
                            <td className="text-emerald-400">{r.action}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div>
                    <div className="flex items-center gap-2 mb-3 text-xs text-cyan-400 font-bold">
                      <i className="fas fa-microchip" />
                      <span>感知设备配置</span>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      {activeZone.devices.map((d) => (
                        <div key={d.name} className="bg-white/5 p-2 rounded flex items-center gap-3 border border-white/5">
                          <div className="w-8 h-8 rounded bg-cyan-500/20 flex items-center justify-center text-cyan-300">
                            <i className={`fas ${d.icon}`} />
                          </div>
                          <div>
                            <div className="text-[10px] text-gray-400">{d.name}</div>
                            <div className="text-xs font-bold text-white">{d.count}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-4 border-t border-white/10 flex justify-center bg-black/20">
                <button
                  type="button"
                  className="flex items-center gap-2 px-6 py-2 rounded-full border border-cyan-500/30 hover:bg-cyan-500/20 hover:border-cyan-400 transition-all text-xs text-cyan-300 group"
                  onClick={(e) => {
                    e.stopPropagation()
                    setFlipped(false)
                  }}
                >
                  <i className="fas fa-undo transform group-hover:-rotate-180 transition-transform duration-500" />
                  <span>返回可视化视图</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </aside>

      <div className="absolute bottom-12 left-1/2 transform -translate-x-1/2 w-[800px] z-20 pointer-events-auto">
        <div className="glass-panel px-10 py-6 rounded-full flex items-center gap-8 relative overflow-hidden group">
          <div className="flex flex-col items-end w-24 flex-shrink-0">
            <span className="text-sm font-bold text-white">罗山路</span>
            <span className="text-[10px] text-gray-500">起点 (西)</span>
          </div>

          <div className="relative flex-1 h-10 flex items-center">
            <div className="absolute left-0 right-0 h-1 bg-gray-800 rounded-full overflow-hidden">
              <div className="h-full bg-gradient-to-r from-blue-600 via-cyan-500 to-blue-400 transition-all duration-75" style={{ width: `${sliderValue}%` }} />
            </div>

            <div className="absolute left-[0%] top-1/2 -translate-y-1/2 w-2 h-2 bg-blue-500 rounded-full shadow-[0_0_10px_#3b82f6]" />
            <div className="absolute left-[50%] top-1/2 -translate-y-1/2 w-2 h-2 bg-gray-600 rounded-full hover:bg-cyan-500 transition-colors" />
            <div className="absolute left-[100%] top-1/2 -translate-y-1/2 w-2 h-2 bg-gray-600 rounded-full" />

            <input
              type="range"
              min={0}
              max={100}
              value={sliderValue}
              onChange={(e) => setSliderValue(Number(e.target.value))}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
            />

            <div
              className="absolute top-1/2 -translate-y-1/2 w-8 h-8 bg-[#020617] border-2 border-cyan-400 rounded-full shadow-[0_0_15px_#22d3ee] flex items-center justify-center pointer-events-none transition-transform duration-75 -ml-4"
              style={{ left: `${sliderValue}%` }}
            >
              <i className="fas fa-chevron-right text-cyan-400 text-[10px]" />
            </div>
          </div>

          <div className="flex flex-col items-start w-24 flex-shrink-0">
            <span className="text-sm font-bold text-white">金海路</span>
            <span className="text-[10px] text-gray-500">终点 (东)</span>
          </div>
        </div>
      </div>
    </div>
  )
}

