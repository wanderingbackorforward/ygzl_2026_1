import React, { Suspense } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import './styles/tailwind.css'
import Nav from './shared/Nav'
import { OverdueTicketAlert } from './components/tickets/OverdueTicketAlert'
import { ModulesProvider } from './contexts/ModulesContext'
import { AuthProvider } from './contexts/AuthContext'
import { AuthGuard } from './components/auth/AuthGuard'
import ModuleGate from './components/modules/ModuleGate'

const IS_MOBILE = import.meta.env.VITE_MOBILE === 'true'

// chunk 加载失败时自动刷新页面（部署更新后旧 chunk 不存在）
function lazyWithRetry(factory: () => Promise<{ default: React.ComponentType<any> }>) {
  return React.lazy(() =>
    factory().catch(() => {
      const reloaded = sessionStorage.getItem('chunk_reload')
      if (!reloaded) {
        sessionStorage.setItem('chunk_reload', '1')
        window.location.reload()
      }
      sessionStorage.removeItem('chunk_reload')
      return factory()
    })
  )
}

const FloatingAssistant = lazyWithRetry(() => import('./components/assistant/FloatingAssistant'))
const Settlement = lazyWithRetry(() => import('./pages/Settlement'))
const Temperature = lazyWithRetry(() => import('./pages/Temperature'))
const Cracks = lazyWithRetry(() => import('./pages/Cracks'))
const Vibration = lazyWithRetry(() => import('./pages/Vibration'))
const Insar = lazyWithRetry(() => import('./pages/Insar'))
const Overview = lazyWithRetry(() => import('./pages/Overview'))
const ThreeModel = lazyWithRetry(() => import('./pages/ThreeModel'))
const Tickets = lazyWithRetry(() => import('./pages/Tickets'))
const Cover = lazyWithRetry(() => import('./pages/Cover'))
const ModuleAdmin = lazyWithRetry(() => import('./pages/ModuleAdmin'))
const Tunnel = lazyWithRetry(() => import('./pages/Tunnel'))
const AdvancedAnalysis = lazyWithRetry(() => import('./pages/AdvancedAnalysis'))
const ShieldTrajectory = lazyWithRetry(() => import('./pages/ShieldTrajectory'))


function App() {
  return (
    <AuthProvider>
      <AuthGuard>
        <ModulesProvider>
          <BrowserRouter
            future={{
              v7_startTransition: true,
              v7_relativeSplatPath: true,
            }}
          >
            <Nav />
            {!IS_MOBILE && <OverdueTicketAlert />}
            {!IS_MOBILE && (
              <Suspense fallback={null}>
                <FloatingAssistant />
              </Suspense>
            )}
            <Suspense
              fallback={
                <div className="px-6 py-6 text-sm text-white">
                  加载中...
                </div>
              }
            >
              <div style={IS_MOBILE ? { paddingBottom: 64, background: '#03060a', minHeight: '100vh' } : { background: '#03060a', minHeight: '100vh' }}>
                <Routes>
                  <Route path="/" element={<Navigate to="/cover" replace />} />
                  <Route path="/cover" element={<Cover />} />
                  <Route path="/settlement" element={<ModuleGate moduleKey="settlement"><Settlement /></ModuleGate>} />
                  <Route path="/temperature" element={<ModuleGate moduleKey="temperature"><Temperature /></ModuleGate>} />
                  <Route path="/cracks" element={<ModuleGate moduleKey="cracks"><Cracks /></ModuleGate>} />
                  <Route path="/vibration" element={<ModuleGate moduleKey="vibration"><Vibration /></ModuleGate>} />
                  <Route path="/insar" element={<ModuleGate moduleKey="insar"><Insar /></ModuleGate>} />
                  <Route path="/overview" element={<ModuleGate moduleKey="overview"><Overview /></ModuleGate>} />
                  <Route path="/three" element={<ModuleGate moduleKey="three"><ThreeModel /></ModuleGate>} />
                  <Route path="/tickets" element={<ModuleGate moduleKey="tickets"><Tickets /></ModuleGate>} />
                  <Route path="/tunnel" element={<ModuleGate moduleKey="tunnel"><Tunnel /></ModuleGate>} />
                  <Route path="/advanced" element={<ModuleGate moduleKey="advanced"><AdvancedAnalysis /></ModuleGate>} />
                  <Route path="/shield-trajectory" element={<ShieldTrajectory />} />

                  <Route path="/modules" element={<ModuleAdmin />} />
                </Routes>
              </div>
            </Suspense>
          </BrowserRouter>
        </ModulesProvider>
      </AuthGuard>
    </AuthProvider>
  )
}

createRoot(document.getElementById('root')!).render(<App />)
