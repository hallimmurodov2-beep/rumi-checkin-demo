import { Navigate, Route, Routes } from 'react-router-dom'
import Landing from './pages/Landing'
import Tablet from './pages/Tablet'
import Staff from './pages/Staff'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/tablet" element={<Tablet />} />
      <Route path="/staff" element={<Staff />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
