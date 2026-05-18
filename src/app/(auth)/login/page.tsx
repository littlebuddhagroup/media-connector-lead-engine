'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Image from 'next/image'
import { Mail, Lock, Eye, EyeOff, ArrowRight } from 'lucide-react'
import { MadeBy } from '@/components/ui/MadeBy'

const STATS = [
  { value: '2.4M+', label: 'Contactos B2B indexados' },
  { value: '94%',   label: 'Precisión de email verificado' },
  { value: '3×',    label: 'Más respuestas que cold email manual' },
]

type Node = { x: number; y: number; vx: number; vy: number; r: number; opacity: number }

function useAnimatedCanvas(canvasRef: React.RefObject<HTMLCanvasElement | null>) {
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let animId: number
    const nodes: Node[] = []
    const N = 50

    const resize = () => {
      canvas.width  = canvas.offsetWidth
      canvas.height = canvas.offsetHeight
    }
    resize()
    window.addEventListener('resize', resize)

    for (let i = 0; i < N; i++) {
      nodes.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        vx: (Math.random() - 0.5) * 0.3,
        vy: (Math.random() - 0.5) * 0.3,
        r: Math.random() * 2 + 1,
        opacity: Math.random() * 0.35 + 0.1,
      })
    }

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      for (let i = 0; i < N; i++) {
        for (let j = i + 1; j < N; j++) {
          const dx = nodes[i].x - nodes[j].x
          const dy = nodes[i].y - nodes[j].y
          const dist = Math.sqrt(dx * dx + dy * dy)
          if (dist < 120) {
            ctx.beginPath()
            ctx.strokeStyle = `rgba(99,102,241,${0.12 * (1 - dist / 120)})`
            ctx.lineWidth = 0.7
            ctx.moveTo(nodes[i].x, nodes[i].y)
            ctx.lineTo(nodes[j].x, nodes[j].y)
            ctx.stroke()
          }
        }
      }
      for (const n of nodes) {
        ctx.beginPath()
        ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(99,102,241,${n.opacity})`
        ctx.fill()
        n.x += n.vx; n.y += n.vy
        if (n.x < 0 || n.x > canvas.width)  n.vx *= -1
        if (n.y < 0 || n.y > canvas.height) n.vy *= -1
      }
      animId = requestAnimationFrame(draw)
    }
    draw()
    return () => { cancelAnimationFrame(animId); window.removeEventListener('resize', resize) }
  }, [canvasRef])
}

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail]               = useState('')
  const [password, setPassword]         = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading]           = useState(false)
  const [error, setError]               = useState('')
  const [statIdx, setStatIdx]           = useState(0)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  useAnimatedCanvas(canvasRef)

  useEffect(() => {
    const id = setInterval(() => setStatIdx(i => (i + 1) % STATS.length), 3000)
    return () => clearInterval(id)
  }, [])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    const supabase = createClient()
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      setError('Credenciales incorrectas. Verifica tu email y contraseña.')
      setLoading(false)
      return
    }
    router.push('/dashboard')
    router.refresh()
  }

  return (
    <div className="min-h-screen flex" style={{ background: '#f8f9fc' }}>

      <style>{`
        @keyframes fadeSlideUp {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes dotPulse {
          0%, 100% { opacity: 0.5; }
          50%       { opacity: 1; }
        }
        @keyframes pulseRing {
          0%   { box-shadow: 0 0 0 0 rgba(99,102,241,0.3); }
          70%  { box-shadow: 0 0 0 10px rgba(99,102,241,0); }
          100% { box-shadow: 0 0 0 0 rgba(99,102,241,0); }
        }
        .stat-animate { animation: fadeSlideUp 0.4s ease both; }
      `}</style>

      {/* ── Panel izquierdo ─────────────────────────────────────────────── */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden flex-col"
        style={{ background: 'linear-gradient(145deg, #eef2ff 0%, #f0f4ff 40%, #ede9fe 100%)' }}>

        {/* Gradient orbs */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-[-80px] left-[-60px] w-96 h-96 rounded-full"
            style={{ background: 'radial-gradient(circle, rgba(99,102,241,0.12) 0%, transparent 70%)' }} />
          <div className="absolute bottom-[-60px] right-[-40px] w-80 h-80 rounded-full"
            style={{ background: 'radial-gradient(circle, rgba(139,92,246,0.10) 0%, transparent 70%)' }} />
        </div>

        {/* Node canvas */}
        <canvas
          ref={canvasRef}
          className="absolute inset-0 w-full h-full"
        />

        {/* Subtle grid */}
        <div className="absolute inset-0 opacity-[0.04] pointer-events-none"
          style={{
            backgroundImage: 'linear-gradient(rgba(99,102,241,1) 1px, transparent 1px), linear-gradient(90deg, rgba(99,102,241,1) 1px, transparent 1px)',
            backgroundSize: '44px 44px',
          }}
        />

        {/* Content */}
        <div className="relative z-10 flex flex-col justify-between h-full p-14">

          {/* Logo */}
          <div>
            <Image src="/logo.png" alt="Media Connector" width={180} height={44} className="object-contain" priority />
          </div>

          {/* Copy */}
          <div className="space-y-8">
            {/* Badge */}
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-indigo-200 bg-white/70 backdrop-blur-sm shadow-sm">
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-500"
                style={{ animation: 'dotPulse 2s ease-in-out infinite' }} />
              <span className="text-indigo-600 text-xs font-semibold tracking-widest uppercase">
                Motor de prospección activo
              </span>
            </div>

            {/* Headline */}
            <h1 className="text-[2.4rem] font-bold leading-[1.18] tracking-tight text-gray-900">
              Conecta con las<br />
              personas correctas,<br />
              <span className="text-transparent bg-clip-text"
                style={{ backgroundImage: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)' }}>
                en el momento exacto.
              </span>
            </h1>

            <p className="text-gray-500 text-base leading-relaxed max-w-xs">
              Prospección de packaging y FMCG con IA. Emails verificados, secuencias automáticas y señales de compra.
            </p>

            {/* Rotating stat */}
            <div className="flex items-center gap-4">
              <div className="w-px h-10 bg-indigo-300 shrink-0" />
              <div key={statIdx} className="stat-animate">
                <p className="text-2xl font-bold text-gray-900">{STATS[statIdx].value}</p>
                <p className="text-xs text-gray-400 mt-0.5">{STATS[statIdx].label}</p>
              </div>
              <div className="flex items-center gap-1.5 ml-1">
                {STATS.map((_, i) => (
                  <button key={i} onClick={() => setStatIdx(i)}
                    className="transition-all duration-300"
                    style={{
                      width: i === statIdx ? '16px' : '5px',
                      height: '5px',
                      borderRadius: '3px',
                      background: i === statIdx ? '#6366f1' : 'rgba(99,102,241,0.25)',
                    }} />
                ))}
              </div>
            </div>
          </div>

          <div />
        </div>
      </div>

      {/* ── Panel derecho — formulario ──────────────────────────────────── */}
      <div className="w-full lg:w-1/2 flex flex-col items-center justify-center px-8 py-12 bg-white relative">

        {/* Top border accent */}
        <div className="absolute top-0 left-0 right-0 h-1 lg:hidden"
          style={{ background: 'linear-gradient(90deg, #6366f1, #8b5cf6)' }} />

        {/* Logo móvil */}
        <div className="lg:hidden mb-10">
          <Image src="/logo.png" alt="Media Connector" width={180} height={44} className="object-contain" priority />
        </div>

        <div className="w-full max-w-sm">
          {/* Icon */}
          <div className="mb-7 w-11 h-11 rounded-2xl flex items-center justify-center"
            style={{
              background: 'linear-gradient(135deg, rgba(99,102,241,0.12) 0%, rgba(139,92,246,0.08) 100%)',
              border: '1px solid rgba(99,102,241,0.2)',
              animation: 'pulseRing 2.5s ease-in-out infinite',
            }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#6366f1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
            </svg>
          </div>

          <h2 className="text-2xl font-semibold text-gray-900 mb-1">Bienvenido</h2>
          <p className="text-gray-400 text-sm mb-8">Accede a tu cuenta para continuar</p>

          {error && (
            <div className="mb-5 px-4 py-3 rounded-xl border border-red-200 bg-red-50 text-red-600 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Email</label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 text-gray-900 placeholder-gray-300 rounded-xl pl-10 pr-4 py-3 text-sm outline-none transition-all focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/15 focus:bg-white"
                  placeholder="tu@empresa.com"
                  required
                  autoComplete="email"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Contraseña</label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 text-gray-900 placeholder-gray-300 rounded-xl pl-10 pr-10 py-3 text-sm outline-none transition-all focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/15 focus:bg-white"
                  placeholder="••••••••"
                  required
                  autoComplete="current-password"
                />
                <button type="button" onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors">
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="flex justify-end">
              <Link href="/forgot-password" className="text-xs text-gray-400 hover:text-indigo-600 transition-colors">
                ¿Olvidaste tu contraseña?
              </Link>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-3 px-6 rounded-xl font-semibold text-sm text-white transition-all disabled:opacity-60 relative overflow-hidden group"
              style={{
                background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
                boxShadow: '0 4px 14px rgba(99,102,241,0.35)',
              }}
            >
              <span className="absolute inset-0 bg-white/0 group-hover:bg-white/10 transition-colors duration-200 rounded-xl" />
              {loading ? (
                <>
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Iniciando sesión...
                </>
              ) : (
                <>Iniciar sesión <ArrowRight className="w-4 h-4" /></>
              )}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-gray-400">
            ¿No tienes cuenta?{' '}
            <Link href="/register" className="text-indigo-600 hover:text-indigo-700 font-semibold transition-colors">
              Regístrate
            </Link>
          </p>

          <div className="mt-8 flex justify-center">
            <MadeBy />
          </div>
        </div>
      </div>

    </div>
  )
}
