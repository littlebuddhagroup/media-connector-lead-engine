'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { Users, CheckCircle, XCircle, Loader2 } from 'lucide-react'

function JoinPageContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const token = searchParams.get('token')

  const [inviteInfo, setInviteInfo] = useState<{ invited_email: string; team_name: string; expired: boolean } | null>(null)
  const [loading, setLoading] = useState(true)
  const [joining, setJoining] = useState(false)
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null)

  useEffect(() => {
    if (!token) { setLoading(false); return }
    fetch(`/api/teams/join?token=${token}`)
      .then(r => r.json())
      .then(json => {
        setInviteInfo(json.data ?? null)
        setLoading(false)
      })
  }, [token])

  const handleJoin = async () => {
    if (!token) return
    setJoining(true)
    const res = await fetch('/api/teams/join', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    })
    const json = await res.json()
    setJoining(false)
    if (res.ok) {
      setResult({ ok: true, message: `Te has unido a "${json.data.team_name}" correctamente.` })
      setTimeout(() => router.push('/teams'), 2500)
    } else {
      setResult({ ok: false, message: json.error ?? 'Error al unirse al equipo.' })
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="w-8 h-8 animate-spin text-brand-500" />
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="bg-white rounded-2xl shadow-lg p-8 max-w-md w-full text-center">
        <div className="w-14 h-14 bg-brand-100 rounded-2xl flex items-center justify-center mx-auto mb-5">
          <Users className="w-7 h-7 text-brand-600" />
        </div>

        {result ? (
          <>
            {result.ok
              ? <CheckCircle className="w-10 h-10 text-green-500 mx-auto mb-3" />
              : <XCircle className="w-10 h-10 text-red-400 mx-auto mb-3" />
            }
            <p className="text-gray-700 text-sm">{result.message}</p>
            {result.ok && <p className="text-xs text-gray-400 mt-2">Redirigiendo...</p>}
            {!result.ok && (
              <button onClick={() => router.push('/')} className="mt-4 text-xs text-brand-600 underline">
                Ir al inicio
              </button>
            )}
          </>
        ) : !token || !inviteInfo ? (
          <>
            <XCircle className="w-10 h-10 text-red-400 mx-auto mb-3" />
            <h2 className="text-lg font-semibold text-gray-900 mb-2">Enlace inválido</h2>
            <p className="text-sm text-gray-500">Este enlace de invitación no existe o ya no es válido.</p>
            <button onClick={() => router.push('/')} className="mt-4 text-xs text-brand-600 underline">
              Ir al inicio
            </button>
          </>
        ) : inviteInfo.expired ? (
          <>
            <XCircle className="w-10 h-10 text-amber-400 mx-auto mb-3" />
            <h2 className="text-lg font-semibold text-gray-900 mb-2">Invitación caducada</h2>
            <p className="text-sm text-gray-500">Este enlace de invitación ya no está activo. Pide al administrador del equipo que te envíe uno nuevo.</p>
          </>
        ) : (
          <>
            <h2 className="text-xl font-bold text-gray-900 mb-2">Invitación al equipo</h2>
            <p className="text-sm text-gray-500 mb-1">Has sido invitado a unirte a</p>
            <p className="text-lg font-semibold text-brand-700 mb-1">"{inviteInfo.team_name}"</p>
            <p className="text-xs text-gray-400 mb-6">
              La invitación es para <span className="font-medium text-gray-600">{inviteInfo.invited_email}</span>.
              Asegúrate de estar logueado con esa cuenta.
            </p>
            <button
              onClick={handleJoin}
              disabled={joining}
              className="w-full py-3 bg-brand-600 hover:bg-brand-700 text-white rounded-xl font-semibold text-sm transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {joining
                ? <><Loader2 className="w-4 h-4 animate-spin" /> Uniéndome...</>
                : <><Users className="w-4 h-4" /> Unirme al equipo</>
              }
            </button>
            <button onClick={() => router.push('/')} className="mt-3 text-xs text-gray-400 underline block w-full">
              Rechazar invitación
            </button>
          </>
        )}
      </div>
    </div>
  )
}

export default function JoinPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="w-8 h-8 animate-spin text-brand-500" />
      </div>
    }>
      <JoinPageContent />
    </Suspense>
  )
}
