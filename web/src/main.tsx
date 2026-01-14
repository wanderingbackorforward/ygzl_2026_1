import React from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Nav from './shared/Nav'
import Settlement from './pages/Settlement'
import Temperature from './pages/Temperature'
import Cracks from './pages/Cracks'
import Vibration from './pages/Vibration'
import Insar from './pages/Insar'
import Overview from './pages/Overview'
import ThreeModel from './pages/ThreeModel'
import SettlementVideo from './pages/SettlementVideo'
import Tickets from './pages/Tickets'

function App() {
  return (
    <BrowserRouter>
      <Nav />
      <Routes>
        <Route path="/" element={<Navigate to="/settlement" replace />} />
        <Route path="/settlement" element={<Settlement />} />
        <Route path="/temperature" element={<Temperature />} />
        <Route path="/cracks" element={<Cracks />} />
        <Route path="/vibration" element={<Vibration />} />
        <Route path="/insar" element={<Insar />} />
        <Route path="/overview" element={<Overview />} />
        <Route path="/three" element={<ThreeModel />} />
        <Route path="/settlement-video" element={<SettlementVideo />} />
        <Route path="/tickets" element={<Tickets />} />
      </Routes>
    </BrowserRouter>
  )
}

createRoot(document.getElementById('root')!).render(<App />)
