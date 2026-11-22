import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import Landing from './pages/Landing'
import { COLORS, Emblem } from './ui'

const Tablet = lazy(() => import('./pages/Tablet'))
const FolioOverlay = lazy(() => import('./tablet/frontdesk').then((m) => ({ default: m.FolioOverlay })))
const StaffApp = lazy(() => import('./staff/StaffApp'))
const StaffPreview = import.meta.env.DEV ? lazy(() => import('./dev/StaffPreview')) : null
const TabletPreview = import.meta.env.DEV ? lazy(() => import('./dev/TabletPreview')) : null

function Splash() {
  return (
    <div className="flex h-dvh items-center justify-center bg-cream">
      <Emblem color={COLORS.gold} className="breathe h-16 w-16" />
    </div>
  )
}

export default function App() {
  return (
    <Suspense fallback={<Splash />}>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route
          path="/tablet"
          element={
            <>
              <Tablet />
              {/* Invoices pushed from the front desk computer (menu.therumihotel.com folio station). */}
              <FolioOverlay />
            </>
          }
        />
        <Route path="/staff" element={<StaffApp />} />
        {StaffPreview && <Route path="/dev/staff" element={<StaffPreview />} />}
        {TabletPreview && <Route path="/dev/tablet" element={<TabletPreview />} />}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  )
}
