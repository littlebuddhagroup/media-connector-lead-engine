'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Image from 'next/image'
import { Mail, Lock, User, KeyRound } from 'lucide-react'
import { MadeBy } from '@/components/ui/MadeBy'

const REGISTRATION_CODE = 'Bombay66'

export default function RegisterPage() {
  const router = useRouter()
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [registrationCode, setRegistrationCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    // Validar código de registro
    if (registrationCode !== REGISTRATION_CODE) {
      setError('Código de registro incorrecto. Contacta con el administrador para obtenerlo.')
      return
    }

    if (password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres')
      return
    }

    setLoading(true)

    const supabase = createClient()
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName } },
    })

    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }

    setSuccess(true)
    setLoading(false)
  }

  if (success) {
    return (
      <div className="relative min-h-screen bg-gradient-to-br from-brand-950 via-brand-900 to-brand-800 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="bg-white rounded-2xl p-8 shadow-2xl text-center">
            <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-2xl">✅</span>
            </div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">¡Registro exitoso!</h2>
            <p className="text-gray-500 text-sm mb-6">
              Revisa tu email <strong>{email}</strong> para confirmar tu cuenta.
            </p>
            <Link href="/login" className="btn-primary w-full justify-center">
              Ir al login
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="relative min-h-screen bg-gradient-to-br from-brand-950 via-brand-900 to-brand-800 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="flex justify-center mb-8">
          <Image src="/logo.png" alt="Media Connector" width={220} height={56} className="object-contain" priority />
        </div>

        <div className="bg-white rounded-2xl p-8 shadow-2xl">
          <h2 className="text-xl font-semibold text-gray-900 mb-6">Crear cuenta</h2>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleRegister} className="space-y-4">
            {/* Código de registro — primer campo visible */}
            <div>
              <label className="label">Código de registro</label>
              <div className="relative">
                <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="password"
                  value={registrationCode}
                  onChange={(e) => setRegistrationCode(e.target.value)}
                  className="input pl-10"
                  placeholder="Introduce el código de acceso"
                  required
                  autoComplete="off"
                />
              </div>
              <p className="text-xs text-gray-400 mt-1">Necesitas un código para crear una cuenta. Pídelo al administrador.</p>
            </div>

            <div>
              <label className="label">Nombre completo</label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input type="text" value={fullName} onChange={(e) => setFullName(e.target.value)}
                  className="input pl-10" placeholder="Tu nombre" required />
              </div>
            </div>

            <div>
              <label className="label">Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                  className="input pl-10" placeholder="tu@empresa.com" required />
              </div>
            </div>

            <div>
              <label className="label">Contraseña</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                  className="input pl-10" placeholder="Mín. 6 caracteres" required minLength={6} />
              </div>
            </div>

            <button type="submit" disabled={loading} className="btn-primary w-full justify-center py-2.5">
              {loading ? 'Creando cuenta...' : 'Crear cuenta'}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-gray-500">
            ¿Ya tienes cuenta?{' '}
            <Link href="/login" className="text-brand-600 hover:text-brand-700 font-medium">
              Iniciar sesión
            </Link>
          </p>
        </div>
      </div>
      <div className="absolute bottom-4 left-0 right-0 flex justify-center">
        <MadeBy />
      </div>
    </div>
  )
}
