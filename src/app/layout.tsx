import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Media Connector Lead Engine',
  description: 'Generación, análisis y seguimiento de leads para Media Connector',
  icons: {
    icon: '/logo.png',
    shortcut: '/logo.png',
    apple: '/logo.png',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  )
}
