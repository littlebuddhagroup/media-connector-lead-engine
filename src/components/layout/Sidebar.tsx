'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import Image from 'next/image'
import {
  LayoutDashboard, Megaphone, Users, Upload, Settings,
  ChevronLeft, ChevronRight, LogOut
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/campaigns', label: 'Campañas', icon: Megaphone },
  { href: '/leads', label: 'CRM / Leads', icon: Users },
  { href: '/imports', label: 'Importar CSV', icon: Upload },
  { href: '/settings', label: 'Configuración', icon: Settings },
]

export default function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const [collapsed, setCollapsed] = useState(false)

  const handleSignOut = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <aside
      className={cn(
        'relative flex flex-col bg-white border-r border-gray-200 h-screen transition-all duration-300',
        collapsed ? 'w-16' : 'w-60'
      )}
    >
      {/* Logo */}
      <div className="flex items-center h-16 border-b border-gray-200 shrink-0 overflow-hidden">
        {collapsed ? (
          <div className="w-16 flex items-center justify-center">
            <div className="w-9 h-9 bg-brand-700 rounded-xl flex items-center justify-center">
              <Image src="/logo.png" alt="MMC" width={28} height={28} className="object-contain" />
            </div>
          </div>
        ) : (
          <div className="w-full bg-brand-700 flex items-center justify-center h-full px-4">
            <Image
              src="/logo.png"
              alt="Media Connector"
              width={160}
              height={40}
              className="object-contain"
              priority
            />
          </div>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 px-2 py-4 space-y-0.5 overflow-y-auto">
        {navItems.map(({ href, label, icon: Icon }) => {
          const isActive = pathname === href || pathname.startsWith(href + '/')
          return (
            <Link
              key={href}
              href={href}
              className={cn(isActive ? 'sidebar-link-active' : 'sidebar-link')}
              title={collapsed ? label : undefined}
            >
              <Icon className="w-4 h-4 shrink-0" />
              {!collapsed && <span>{label}</span>}
            </Link>
          )
        })}
      </nav>

      {/* Logout */}
      <div className="px-2 pb-4 border-t border-gray-200 pt-4">
        <button
          onClick={handleSignOut}
          className="sidebar-link w-full text-left text-red-500 hover:text-red-600 hover:bg-red-50"
          title={collapsed ? 'Cerrar sesión' : undefined}
        >
          <LogOut className="w-4 h-4 shrink-0" />
          {!collapsed && <span>Cerrar sesión</span>}
        </button>
      </div>

      {/* Collapse toggle */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="absolute -right-3 top-20 w-6 h-6 bg-white border border-gray-200 rounded-full
                   flex items-center justify-center shadow-sm hover:bg-gray-50 transition-colors z-10"
      >
        {collapsed ? (
          <ChevronRight className="w-3 h-3 text-gray-600" />
        ) : (
          <ChevronLeft className="w-3 h-3 text-gray-600" />
        )}
      </button>
    </aside>
  )
}
