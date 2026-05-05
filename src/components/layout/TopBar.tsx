'use client'

interface TopBarProps {
  title: string
  subtitle?: React.ReactNode
  actions?: React.ReactNode
}

export default function TopBar({ title, subtitle, actions }: TopBarProps) {
  return (
    <header className="bg-white border-b border-gray-200 shrink-0">
      {/* Desktop: una sola fila */}
      <div className="hidden md:flex items-center h-16 px-6 gap-4">
        <div className="flex-1 min-w-0">
          <h1 className="text-lg font-semibold text-gray-900 truncate">{title}</h1>
          {subtitle && <p className="text-xs text-gray-500 truncate">{subtitle}</p>}
        </div>
        {actions && (
          <div className="flex items-center gap-2 shrink-0">
            {actions}
          </div>
        )}
      </div>

      {/* Móvil: título arriba, acciones abajo si las hay */}
      <div className="md:hidden px-4 py-3">
        <h1 className="text-base font-semibold text-gray-900 truncate">{title}</h1>
        {subtitle && <p className="text-xs text-gray-400 truncate mt-0.5">{subtitle}</p>}
        {actions && (
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            {actions}
          </div>
        )}
      </div>
    </header>
  )
}
