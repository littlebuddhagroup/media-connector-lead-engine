'use client'

import { useState } from 'react'

interface CompanyLogoProps {
  website?: string | null
  companyName: string
  size?: number   // px, default 32
  className?: string
}

function extractDomain(website: string): string {
  try {
    const url = website.startsWith('http') ? website : `https://${website}`
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return website.replace(/^(https?:\/\/)?(www\.)?/, '').split('/')[0]
  }
}

function getInitials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(w => w[0].toUpperCase())
    .join('')
}

// Deterministic color from company name
const COLORS: [string, string][] = [
  ['#E8F4FF', '#1A6FBF'],
  ['#E8FFF4', '#1A8A5A'],
  ['#FFF4E8', '#BF7A1A'],
  ['#F4E8FF', '#7A1ABF'],
  ['#FFE8F4', '#BF1A7A'],
  ['#E8F0FF', '#3B5FBF'],
  ['#F4FFE8', '#6ABF1A'],
  ['#FFE8E8', '#BF1A1A'],
]

function colorForName(name: string): [string, string] {
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash)
  return COLORS[Math.abs(hash) % COLORS.length]
}

function getSources(domain: string): string[] {
  return [
    `https://logo.clearbit.com/${domain}`,
    `https://cdn.brandfetch.io/${domain}/w/128/h/128`,
    `https://www.google.com/s2/favicons?domain=${domain}&sz=128`,
  ]
}

export default function CompanyLogo({ website, companyName, size = 32, className = '' }: CompanyLogoProps) {
  const [sourceIdx, setSourceIdx] = useState(0)

  const domain = website ? extractDomain(website) : null
  const initials = getInitials(companyName)
  const [bg, fg] = colorForName(companyName)
  const sources = domain ? getSources(domain) : []
  const allFailed = sourceIdx >= sources.length

  const style: React.CSSProperties = {
    width: size,
    height: size,
    minWidth: size,
    borderRadius: Math.round(size * 0.22),
    overflow: 'hidden',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: Math.round(size * 0.38),
    fontWeight: 600,
    letterSpacing: '-0.02em',
    border: '1px solid rgba(0,0,0,0.06)',
  }

  if (domain && !allFailed) {
    return (
      <div style={style} className={className}>
        <img
          src={sources[sourceIdx]}
          alt={companyName}
          width={size}
          height={size}
          style={{ objectFit: 'contain', width: '100%', height: '100%' }}
          onError={() => setSourceIdx(i => i + 1)}
        />
      </div>
    )
  }

  return (
    <div style={{ ...style, background: bg, color: fg }} className={className}>
      {initials}
    </div>
  )
}
