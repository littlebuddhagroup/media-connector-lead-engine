'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import Image from 'next/image'
import {
  LayoutDashboard, Megaphone, Users, Upload, Settings,
  ChevronLeft, ChevronRight, LogOut, Telescope, Kanban, AtSign, Wrench, UsersRound, BarChart2, Mail,
  Menu, X, MoreHorizontal, Brain, GitFork,
} from 'lucide-react'
import { MadeBy } from '@/components/ui/MadeBy'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { useState, useEffect } from 'react'

// ─── Nav sections ──────────────────────────────────────────────────────────────
const navSections = [
  {
    label: 'Workspace',
    items: [
      { href: '/dashboard',  label: 'Dashboard',     icon: LayoutDashboard },
      { href: '/pipeline',   label: 'Pipeline',      icon: Kanban          },
      { href: '/campaigns',  label: 'Campañas',      icon: Megaphone       },
      { href: '/leads',      label: 'CRM / Leads',   icon: Users           },
      { href: '/teams',      label: 'Equipo',        icon: UsersRound      },
    ],
  },
  {
    label: 'Prospección',
    items: [
      { href: '/discover',   label: 'Buscar email',       icon: Telescope },
      { href: '/hunter',     label: 'Lead Scout',         icon: AtSign    },
      { href: '/lookalike',  label: 'Lookalike',          icon: GitFork   },
      { href: '/imports',    label: 'Importar contactos', icon: Upload    },
    ],
  },
  {
    label: 'Outreach',
    items: [
      { href: '/newsletters', label: 'Newsletters',  icon: Mail     },
      { href: '/tools',       label: 'Herramientas', icon: Wrench   },
      { href: '/analytics',   label: 'Analíticas',   icon: BarChart2 },
    ],
  },
  {
    label: 'Sistema',
    items: [
      { href: '/sistema',  label: 'Inteligencia',  icon: Brain    },
      { href: '/settings', label: 'Configuración', icon: Settings },
    ],
  },
]

// Items que aparecen en la bottom nav móvil (los 5 más usados)
const mobileBottomItems = [
  { href: '/dashboard',  label: 'Inicio',   icon: LayoutDashboard },
  { href: '/leads',      label: 'Leads',    icon: Users           },
  { href: '/campaigns',  label: 'Campañas', icon: Megaphone       },
  { href: '/pipeline',   label: 'Pipeline', icon: Kanban          },
  { href: '/analytics',  label: 'Stats',    icon: BarChart2       },
]

// ─── NavItem component ─────────────────────────────────────────────────────────
function NavItem({
  href, label, icon: Icon, collapsed, pathname,
}: { href: string; label: string; icon: React.ElementType; collapsed: boolean; pathname: string }) {
  const isActive = pathname === href || pathname.startsWith(href + '/')
  return (
    <div className="relative">
      {isActive && !collapsed && (
        <span className="absolute left-0 top-[6px] bottom-[6px] w-[2px] rounded-full bg-brand-500" />
      )}
      <Link
        href={href}
        className={cn(isActive ? 'sidebar-link-active' : 'sidebar-link')}
        style={isActive && !collapsed ? { paddingLeft: '14px' } : {}}
        title={collapsed ? label : undefined}
      >
        <Icon className="w-4 h-4 shrink-0" />
        {!collapsed && <span className="text-[12.5px]">{label}</span>}
      </Link>
    </div>
  )
}

// ─── SectionLabel component ────────────────────────────────────────────────────
function SectionLabel({ label, collapsed }: { label: string; collapsed: boolean }) {
  if (collapsed) {
    return <div className="h-px mx-2 my-2 bg-gray-100" />
  }
  return (
    <div className="px-3 pt-4 pb-1.5 flex items-center gap-2">
      <span className="text-[9px] font-semibold tracking-[0.14em] uppercase text-gray-400">
        {label}
      </span>
      <div className="flex-1 h-px bg-gray-100" />
    </div>
  )
}

export default function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [userEmail, setUserEmail] = useState<string | null>(null)
  const [userName, setUserName] = useState<string | null>(null)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        setUserEmail(user.email ?? null)
        const meta = user.user_metadata
        const name = meta?.full_name || meta?.name || null
        setUserName(name)
      }
    })
  }, [])

  // Cerrar el drawer móvil al navegar
  useEffect(() => { setMobileOpen(false) }, [pathname])

  const handleSignOut = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  const initials = userName
    ? userName.split(' ').map((n: string) => n[0]).slice(0, 2).join('').toUpperCase()
    : userEmail
      ? userEmail.slice(0, 2).toUpperCase()
      : '?'

  // ─── Sidebar desktop ──────────────────────────────────────────────────────────
  const desktopSidebar = (
    <aside
      className={cn(
        'hidden md:flex relative flex-col bg-white border-r border-gray-200 h-screen transition-all duration-300 shrink-0',
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
            <Image src="/logo.png" alt="Media Connector" width={160} height={40} className="object-contain" priority />
          </div>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 px-2 py-2 overflow-y-auto">
        {navSections.map((section, si) => (
          <div key={si}>
            <SectionLabel label={section.label} collapsed={collapsed} />
            {section.items.map(({ href, label, icon }) => (
              <NavItem key={href} href={href} label={label} icon={icon} collapsed={collapsed} pathname={pathname} />
            ))}
          </div>
        ))}
      </nav>

      {/* User + logout */}
      <div className="px-2 pb-4 border-t border-gray-200 pt-3 space-y-1">
        {!collapsed ? (
          <div className="flex items-center gap-2.5 px-2 py-2 rounded-xl bg-gray-50 mb-1">
            <div className="w-8 h-8 rounded-full bg-brand-600 flex items-center justify-center shrink-0">
              <span className="text-xs font-bold text-white">{initials}</span>
            </div>
            <div className="flex-1 min-w-0">
              {userName && <p className="text-xs font-semibold text-gray-800 truncate">{userName}</p>}
              <p className="text-xs text-gray-400 truncate">{userEmail ?? '—'}</p>
            </div>
          </div>
        ) : (
          <div className="flex justify-center mb-1" title={userEmail ?? undefined}>
            <div className="w-8 h-8 rounded-full bg-brand-600 flex items-center justify-center">
              <span className="text-xs font-bold text-white">{initials}</span>
            </div>
          </div>
        )}
        <button onClick={handleSignOut} className="sidebar-link w-full text-left text-red-500 hover:text-red-600 hover:bg-red-50" title={collapsed ? 'Cerrar sesión' : undefined}>
          <LogOut className="w-4 h-4 shrink-0" />
          {!collapsed && <span>Cerrar sesión</span>}
        </button>
        {!collapsed && <div className="pt-2 px-2"><MadeBy /></div>}
      </div>

      {/* Collapse toggle */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="absolute -right-3 top-20 w-6 h-6 bg-white border border-gray-200 rounded-full flex items-center justify-center shadow-sm hover:bg-gray-50 transition-colors z-10"
      >
        {collapsed ? <ChevronRight className="w-3 h-3 text-gray-600" /> : <ChevronLeft className="w-3 h-3 text-gray-600" />}
      </button>
    </aside>
  )

  // ─── Mobile: top bar + drawer ─────────────────────────────────────────────────
  const mobileTopBar = (
    <div className="md:hidden fixed top-0 left-0 right-0 z-40 bg-white border-b border-gray-200 flex items-center h-14 px-4 gap-3">
      <button
        onClick={() => setMobileOpen(true)}
        className="p-2 rounded-lg hover:bg-gray-100 text-gray-600 transition-colors"
      >
        <Menu className="w-5 h-5" />
      </button>
      <div className="w-8 h-8 bg-brand-700 rounded-lg flex items-center justify-center shrink-0">
        <Image src="/logo.png" alt="MMC" width={24} height={24} className="object-contain" />
      </div>
      <span className="text-sm font-semibold text-gray-800 flex-1 truncate">MyMediaConnect</span>
    </div>
  )

  // Drawer overlay
  const mobileDrawer = (
    <>
      {/* Overlay */}
      {mobileOpen && (
        <div
          className="md:hidden fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Drawer panel */}
      <div className={cn(
        'md:hidden fixed top-0 left-0 bottom-0 z-50 w-72 bg-white shadow-2xl flex flex-col transition-transform duration-300',
        mobileOpen ? 'translate-x-0' : '-translate-x-full'
      )}>
        {/* Header */}
        <div className="flex items-center justify-between h-14 px-4 border-b border-gray-200 bg-brand-700">
          <Image src="/logo.png" alt="Media Connector" width={140} height={36} className="object-contain" priority />
          <button onClick={() => setMobileOpen(false)} className="p-1.5 rounded-lg bg-brand-600 text-white hover:bg-brand-500 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-2 py-2 overflow-y-auto">
          {navSections.map((section, si) => (
            <div key={si}>
              <SectionLabel label={section.label} collapsed={false} />
              {section.items.map(({ href, label, icon: Icon }) => {
                const isActive = pathname === href || pathname.startsWith(href + '/')
                return (
                  <div key={href} className="relative">
                    {isActive && (
                      <span className="absolute left-0 top-[6px] bottom-[6px] w-[2px] rounded-full bg-brand-500" />
                    )}
                    <Link
                      href={href}
                      className={cn(isActive ? 'sidebar-link-active' : 'sidebar-link')}
                      style={isActive ? { paddingLeft: '14px' } : {}}
                    >
                      <Icon className="w-4 h-4 shrink-0" />
                      <span className="text-[13px]">{label}</span>
                    </Link>
                  </div>
                )
              })}
            </div>
          ))}
        </nav>

        {/* User + logout */}
        <div className="px-3 pb-6 border-t border-gray-200 pt-3 space-y-2">
          <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-gray-50">
            <div className="w-9 h-9 rounded-full bg-brand-600 flex items-center justify-center shrink-0">
              <span className="text-sm font-bold text-white">{initials}</span>
            </div>
            <div className="flex-1 min-w-0">
              {userName && <p className="text-sm font-semibold text-gray-800 truncate">{userName}</p>}
              <p className="text-xs text-gray-400 truncate">{userEmail ?? '—'}</p>
            </div>
          </div>
          <button onClick={handleSignOut} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-red-500 hover:bg-red-50 transition-colors">
            <LogOut className="w-5 h-5 shrink-0" />
            <span>Cerrar sesión</span>
          </button>
        </div>
      </div>
    </>
  )

  // ─── Mobile: bottom navigation ────────────────────────────────────────────────
  const mobileBottomNav = (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-gray-200 flex items-stretch h-16 safe-area-pb">
      {mobileBottomItems.map(({ href, label, icon: Icon }) => {
        const isActive = pathname === href || pathname.startsWith(href + '/')
        return (
          <Link key={href} href={href} className={cn(
            'flex-1 flex flex-col items-center justify-center gap-0.5 text-[10px] font-medium transition-colors pt-1',
            isActive ? 'text-brand-600' : 'text-gray-400 hover:text-gray-700'
          )}>
            <Icon className={cn('w-5 h-5', isActive ? 'text-brand-600' : 'text-gray-400')} />
            <span>{label}</span>
            {isActive && <span className="w-1 h-1 rounded-full bg-brand-500 mb-0.5" />}
          </Link>
        )
      })}
      {/* More button — opens drawer */}
      <button
        onClick={() => setMobileOpen(true)}
        className="flex-1 flex flex-col items-center justify-center gap-0.5 text-[10px] font-medium text-gray-400 hover:text-gray-700 transition-colors pt-1"
      >
        <MoreHorizontal className="w-5 h-5" />
        <span>Más</span>
      </button>
    </nav>
  )

  return (
    <>
      {desktopSidebar}
      {mobileTopBar}
      {mobileDrawer}
      {mobileBottomNav}
    </>
  )
}
