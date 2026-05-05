import Link from 'next/link'

interface MadeByProps {
  className?: string
}

export function MadeBy({ className = '' }: MadeByProps) {
  return (
    <p className={`text-[11px] text-gray-400 flex items-center gap-1 ${className}`}>
      Made with{' '}
      <svg className="w-3 h-3 text-red-400 shrink-0" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 21.593c-5.63-5.539-11-10.297-11-14.402 0-3.791 3.068-5.191 5.281-5.191 1.312 0 4.151.501 5.719 4.457 1.59-3.968 4.464-4.447 5.726-4.447 2.54 0 5.274 1.621 5.274 5.181 0 4.069-5.136 8.625-11 14.402z"/>
      </svg>{' '}
      by{' '}
      <Link
        href="https://www.abantsistemas.com"
        target="_blank"
        rel="noopener noreferrer"
        className="text-gray-400 hover:text-brand-600 transition-colors font-medium"
      >
        Abantsistemas.com
      </Link>
    </p>
  )
}
