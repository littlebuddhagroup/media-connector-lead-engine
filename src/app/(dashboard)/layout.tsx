import Sidebar from '@/components/layout/Sidebar'
import { ToastContainer } from '@/components/ui/Toast'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      <Sidebar />
      {/* En móvil: padding-top para el topbar (h-14) + padding-bottom para la bottom nav (h-16) */}
      <main className="flex-1 overflow-y-auto overflow-x-hidden pt-14 pb-16 md:pt-0 md:pb-0 min-w-0">
        {children}
      </main>
      <ToastContainer />
    </div>
  )
}
