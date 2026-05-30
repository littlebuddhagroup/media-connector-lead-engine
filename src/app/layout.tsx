import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Media Connector Lead Engine',
  description: 'Generación, análisis y seguimiento de leads para Media Connector',
  icons: {
    icon: '/logo2.png',
    shortcut: '/logo2.png',
    apple: '/logo2.png',
  },
  viewport: {
    width: 'device-width',
    initialScale: 1,
    maximumScale: 1,
    userScalable: false,
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  )
}
