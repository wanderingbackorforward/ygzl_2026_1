import React from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import './styles/tailwind.css'
import Nav from './shared/Nav'
import { OverdueTicketAlert } from './components/tickets/OverdueTicketAlert'
import { ModulesProvider } from './contexts/ModulesContext'
import ModuleGate from './components/modules/ModuleGate'
import Settlement from './pages/Settlement'
import Temperature from './pages/Temperature'
import Cracks from './pages/Cracks'
import Vibration from './pages/Vibration'
import Insar from './pages/Insar'
import Overview from './pages/Overview'
import ThreeModel from './pages/ThreeModel'
import Tickets from './pages/Tickets'
import Cover from './pages/Cover'
import ModuleAdmin from './pages/ModuleAdmin'
import Tunnel from './pages/Tunnel'
import AdvancedAnalysis from './pages/AdvancedAnalysis'

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
          <Route path="/modules" element={<ModuleAdmin />} />
        </Routes>
      </BrowserRouter>
    </ModulesProvider>
  )
}

createRoot(document.getElementById('root')!).render(<App />)
