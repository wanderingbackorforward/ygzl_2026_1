import React, { Suspense } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import './styles/tailwind.css'
import Nav from './shared/Nav'
import { OverdueTicketAlert } from './components/tickets/OverdueTicketAlert'
import { ModulesProvider } from './contexts/ModulesContext'
import ModuleGate from './components/modules/ModuleGate'

const FloatingAssistant = React.lazy(() => import('./components/assistant/FloatingAssistant'))
const Settlement = React.lazy(() => import('./pages/Settlement'))
const Temperature = React.lazy(() => import('./pages/Temperature'))
const Cracks = React.lazy(() => import('./pages/Cracks'))
const Vibration = React.lazy(() => import('./pages/Vibration'))
const Insar = React.lazy(() => import('./pages/Insar'))
const Overview = React.lazy(() => import('./pages/Overview'))
const ThreeModel = React.lazy(() => import('./pages/ThreeModel'))
const Tickets = React.lazy(() => import('./pages/Tickets'))
const Cover = React.lazy(() => import('./pages/Cover'))
const ModuleAdmin = React.lazy(() => import('./pages/ModuleAdmin'))
const Tunnel = React.lazy(() => import('./pages/Tunnel'))
const AdvancedAnalysis = React.lazy(() => import('./pages/AdvancedAnalysis'))
const MLAnalysisCenter = React.lazy(() => import('./pages/MLAnalysisCenter'))

function App() {
  return (
    <ModulesProvider>
      <BrowserRouter
        future={{
          v7_startTransition: true,
          v7_relativeSplatPath: true,
        }}
      >
        <Nav />
        <OverdueTicketAlert />
        <Suspense fallback={null}>
          <FloatingAssistant />
        </Suspense>
        <Suspense
          fallback={
            <div className="px-6 py-6 text-sm text-slate-400">
              加载中…
            </div>
          }
        >
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
            <Route path="/ml-analysis" element={<ModuleGate moduleKey="ml-analysis"><MLAnalysisCenter /></ModuleGate>} />
            <Route path="/modules" element={<ModuleAdmin />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </ModulesProvider>
  )
}

createRoot(document.getElementById('root')!).render(<App />)
