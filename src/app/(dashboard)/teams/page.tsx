'use client'

import { useState, useEffect } from 'react'
import TopBar from '@/components/layout/TopBar'
import {
  Users, Plus, Mail, Trash2, Crown, UserCheck, LogOut, Loader2,
  Clock, XCircle, UserPlus, Shield, ChevronDown, Check
} from 'lucide-react'
import { toast } from '@/components/ui/Toast'
import { formatDate } from '@/lib/utils'

interface TeamMember {
  id: string
  user_id: string
  email: string
  role: 'owner' | 'admin' | 'member'
  status: string
  created_at: string
  is_me: boolean
}

interface TeamInvitation {
  id: string
  invited_email: string
  status: 'pending' | 'accepted' | 'expired'
  expires_at: string
  created_at: string
}

interface TeamData {
  id: string
  name: string
  owner_id: string
  created_at: string
  team_members: TeamMember[]
  team_invitations: TeamInvitation[]
}

interface MembershipData {
  role: string
  team: TeamData
}

const ROLE_LABELS: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  owner: { label: 'Propietario', icon: <Crown className="w-3 h-3" />, color: 'bg-amber-100 text-amber-700' },
  admin: { label: 'Admin', icon: <Shield className="w-3 h-3" />, color: 'bg-purple-100 text-purple-700' },
  member: { label: 'Miembro', icon: <UserCheck className="w-3 h-3" />, color: 'bg-gray-100 text-gray-600' },
}

export default function TeamsPage() {
  const [membership, setMembership] = useState<MembershipData | null>(null)
  const [loading, setLoading] = useState(true)

  // Crear equipo
  const [showCreate, setShowCreate] = useState(false)
  const [teamName, setTeamName] = useState('')
  const [creating, setCreating] = useState(false)

  // Invitar
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviting, setInviting] = useState(false)

  // Gestión de miembros
  const [memberActionId, setMemberActionId] = useState<string | null>(null)
  const [updatingMember, setUpdatingMember] = useState<string | null>(null)

  // Leaving
  const [leaving, setLeaving] = useState(false)

  const fetchTeam = async () => {
    const res = await fetch('/api/teams')
    const json = await res.json()
    setMembership(json.data)
    setLoading(false)
  }

  useEffect(() => { fetchTeam() }, [])

  const handleCreateTeam = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!teamName.trim()) return
    setCreating(true)
    const res = await fetch('/api/teams', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: teamName.trim() }),
    })
    setCreating(false)
    if (res.ok) {
      setShowCreate(false)
      setTeamName('')
      fetchTeam()
      toast.success('Equipo creado', 'El equipo ha sido creado correctamente.')
    } else {
      const json = await res.json()
      toast.error('Error', json.error ?? 'No se pudo crear el equipo.')
    }
  }

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!inviteEmail.trim()) return
    setInviting(true)
    const res = await fetch('/api/teams/invite', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: inviteEmail.trim() }),
    })
    setInviting(false)
    if (res.ok) {
      setInviteEmail('')
      fetchTeam()
      toast.success('Invitación enviada', `Se ha enviado un email de invitación a ${inviteEmail}.`)
    } else {
      const json = await res.json()
      toast.error('Error', json.error ?? 'No se pudo enviar la invitación.')
    }
  }

  const handleRevokeInvitation = async (invitationId: string, email: string) => {
    const res = await fetch('/api/teams/invite', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ invitation_id: invitationId }),
    })
    if (res.ok) {
      fetchTeam()
      toast.info('Invitación cancelada', `La invitación a ${email} ha sido cancelada.`)
    }
  }

  const handleChangeRole = async (memberUserId: string, newRole: 'admin' | 'member') => {
    setUpdatingMember(memberUserId)
    const res = await fetch('/api/teams/members', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ member_user_id: memberUserId, new_role: newRole }),
    })
    setUpdatingMember(null)
    setMemberActionId(null)
    if (res.ok) {
      fetchTeam()
      toast.success('Rol actualizado', `El miembro ahora es ${ROLE_LABELS[newRole]?.label}.`)
    } else {
      const json = await res.json()
      toast.error('Error', json.error ?? 'No se pudo actualizar el rol.')
    }
  }

  const handleRemoveMember = async (memberUserId: string, memberEmail: string) => {
    if (!confirm(`¿Eliminar a ${memberEmail} del equipo? Perderá acceso a los leads y campañas compartidas.`)) return
    setUpdatingMember(memberUserId)
    const res = await fetch('/api/teams/members', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ member_user_id: memberUserId }),
    })
    setUpdatingMember(null)
    if (res.ok) {
      fetchTeam()
      toast.success('Miembro eliminado', `${memberEmail} ha sido eliminado del equipo.`)
    } else {
      const json = await res.json()
      toast.error('Error', json.error ?? 'No se pudo eliminar el miembro.')
    }
  }

  const handleLeave = async () => {
    if (!confirm('¿Seguro que quieres salir del equipo? Si eres el propietario, el equipo se disolverá.')) return
    setLeaving(true)
    const res = await fetch('/api/teams', { method: 'DELETE' })
    setLeaving(false)
    if (res.ok) {
      setMembership(null)
      toast.success('Has salido del equipo')
    } else {
      const json = await res.json()
      toast.error('Error', json.error ?? 'No se pudo salir del equipo.')
    }
  }

  if (loading) return <div className="p-6 text-gray-400">Cargando...</div>

  const team = membership?.team
  const myRole = membership?.role
  const isOwner = myRole === 'owner'
  const canManage = !!team  // Todos los miembros del equipo tienen acceso completo
  const activeMembers = team?.team_members?.filter(m => m.status === 'active') ?? []
  const pendingInvites = team?.team_invitations?.filter(i => i.status === 'pending') ?? []

  return (
    <div className="animate-fade-in" onClick={() => setMemberActionId(null)}>
      <TopBar
        title="Equipo"
        subtitle="Colabora con tus compañeros y comparte leads"
        actions={
          team ? (
            <button onClick={handleLeave} disabled={leaving}
              className="text-xs px-3 py-1.5 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 transition-colors flex items-center gap-1.5">
              <LogOut className="w-3.5 h-3.5" />
              {myRole === 'owner' ? 'Disolver equipo' : 'Salir del equipo'}
            </button>
          ) : undefined
        }
      />

      <div className="p-6 max-w-2xl space-y-6">

        {/* Sin equipo */}
        {!team && (
          <div className="card p-8 text-center">
            <div className="w-14 h-14 bg-brand-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Users className="w-7 h-7 text-brand-600" />
            </div>
            <h2 className="text-base font-semibold text-gray-900 mb-2">No perteneces a ningún equipo</h2>
            <p className="text-sm text-gray-500 mb-6">
              Crea un equipo y comienza a colaborar. Invita a tus compañeros y compartiréis leads, campañas y actividad.
            </p>

            {!showCreate ? (
              <button onClick={() => setShowCreate(true)} className="btn-primary">
                <Plus className="w-4 h-4" /> Crear mi equipo
              </button>
            ) : (
              <form onSubmit={handleCreateTeam} className="max-w-sm mx-auto text-left space-y-3">
                <div>
                  <label className="label">Nombre del equipo</label>
                  <input
                    className="input"
                    placeholder="Ej: Equipo de Ventas, Marketing Iberia..."
                    value={teamName}
                    onChange={e => setTeamName(e.target.value)}
                    autoFocus
                  />
                </div>
                <div className="flex gap-2">
                  <button type="button" onClick={() => setShowCreate(false)} className="btn-secondary text-xs flex-1">
                    Cancelar
                  </button>
                  <button type="submit" disabled={creating || !teamName.trim()} className="btn-primary text-xs flex-1">
                    {creating ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Creando...</> : 'Crear equipo'}
                  </button>
                </div>
              </form>
            )}
          </div>
        )}

        {/* Equipo activo */}
        {team && (
          <>
            {/* Cabecera del equipo */}
            <div className="card p-5">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-brand-600 rounded-xl flex items-center justify-center shrink-0">
                  <span className="text-white text-lg font-bold">{team.name[0].toUpperCase()}</span>
                </div>
                <div>
                  <h2 className="text-base font-bold text-gray-900">{team.name}</h2>
                  <p className="text-xs text-gray-500">
                    {activeMembers.length} miembro{activeMembers.length !== 1 ? 's' : ''} · Creado el {formatDate(team.created_at)}
                  </p>
                </div>
                <div className="ml-auto">
                  <span className={`text-xs font-medium px-2.5 py-1 rounded-full flex items-center gap-1 ${ROLE_LABELS[myRole ?? 'member']?.color}`}>
                    {ROLE_LABELS[myRole ?? 'member']?.icon}
                    {ROLE_LABELS[myRole ?? 'member']?.label}
                  </span>
                </div>
              </div>
            </div>

            {/* Miembros */}
            <div className="card p-5">
              <h3 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <Users className="w-4 h-4 text-brand-600" /> Miembros ({activeMembers.length})
              </h3>
              <div className="space-y-2">
                {activeMembers.map(member => (
                  <div key={member.id} className="flex items-center gap-3 p-3 rounded-xl bg-gray-50">
                    <div className="w-8 h-8 rounded-full bg-brand-200 flex items-center justify-center shrink-0">
                      <span className="text-xs font-bold text-brand-700">
                        {member.email?.[0]?.toUpperCase() ?? '?'}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {member.email}
                        {member.is_me && <span className="text-xs text-gray-400 font-normal ml-1">(tú)</span>}
                      </p>
                      <p className="text-xs text-gray-400">Desde {formatDate(member.created_at)}</p>
                    </div>
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full flex items-center gap-1 ${ROLE_LABELS[member.role]?.color}`}>
                      {ROLE_LABELS[member.role]?.icon} {ROLE_LABELS[member.role]?.label}
                    </span>

                    {/* Acciones: solo para owner o admin, y solo sobre miembros que no son uno mismo ni owner */}
                    {canManage && !member.is_me && member.role !== 'owner' && (
                      <div className="relative" onClick={e => e.stopPropagation()}>
                        {updatingMember === member.user_id ? (
                          <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
                        ) : (
                          <button
                            onClick={() => setMemberActionId(memberActionId === member.user_id ? null : member.user_id)}
                            className="text-gray-400 hover:text-gray-600 p-1 rounded-lg hover:bg-gray-100 flex items-center gap-0.5"
                          >
                            <ChevronDown className="w-3.5 h-3.5" />
                          </button>
                        )}

                        {memberActionId === member.user_id && (
                          <div className="absolute right-0 top-8 z-20 bg-white border border-gray-200 rounded-xl shadow-lg py-1 min-w-[160px]">
                            {/* Cambiar rol — solo owner puede */}
                            {isOwner && (
                              <>
                                <button
                                  onClick={() => handleChangeRole(member.user_id, member.role === 'admin' ? 'member' : 'admin')}
                                  className="w-full text-left px-3 py-2 text-xs text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                                >
                                  {member.role === 'admin'
                                    ? <><UserCheck className="w-3.5 h-3.5 text-gray-400" /> Cambiar a Miembro</>
                                    : <><Shield className="w-3.5 h-3.5 text-purple-500" /> Hacer Admin</>
                                  }
                                </button>
                                <div className="border-t border-gray-100 my-1" />
                              </>
                            )}
                            <button
                              onClick={() => handleRemoveMember(member.user_id, member.email)}
                              className="w-full text-left px-3 py-2 text-xs text-red-600 hover:bg-red-50 flex items-center gap-2"
                            >
                              <Trash2 className="w-3.5 h-3.5" /> Eliminar del equipo
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Invitar */}
            {canManage && (
              <div className="card p-5">
                <h3 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <UserPlus className="w-4 h-4 text-brand-600" /> Invitar miembro
                </h3>
                <form onSubmit={handleInvite} className="flex gap-3">
                  <div className="relative flex-1">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="email"
                      className="input pl-9"
                      placeholder="email@empresa.com"
                      value={inviteEmail}
                      onChange={e => setInviteEmail(e.target.value)}
                    />
                  </div>
                  <button type="submit" disabled={inviting || !inviteEmail.trim()} className="btn-primary text-xs px-4 shrink-0">
                    {inviting ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Mail className="w-3.5 h-3.5" /> Invitar</>}
                  </button>
                </form>
                <p className="text-xs text-gray-400 mt-2">
                  Le llegará un email con un enlace para unirse al equipo. El enlace caduca en 7 días.
                </p>

                {/* Invitaciones pendientes */}
                {pendingInvites.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-gray-100">
                    <p className="text-xs font-semibold text-gray-500 mb-2">Invitaciones pendientes</p>
                    <div className="space-y-2">
                      {pendingInvites.map(inv => (
                        <div key={inv.id} className="flex items-center gap-3 p-2.5 bg-amber-50 border border-amber-100 rounded-xl">
                          <Clock className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium text-gray-800 truncate">{inv.invited_email}</p>
                            <p className="text-xs text-gray-400">Caduca {formatDate(inv.expires_at)}</p>
                          </div>
                          <button
                            onClick={() => handleRevokeInvitation(inv.id, inv.invited_email)}
                            className="text-xs text-red-500 hover:text-red-700 flex items-center gap-0.5"
                            title="Cancelar invitación"
                          >
                            <XCircle className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Info de permisos */}
            <div className="card p-4 bg-blue-50 border border-blue-100">
              <p className="text-xs text-blue-700 font-medium mb-1 flex items-center gap-1.5">
                <Check className="w-3.5 h-3.5" /> Acceso completo del equipo
              </p>
              <p className="text-xs text-blue-600">
                Todos los miembros del equipo tienen acceso completo: pueden ver y gestionar leads, campañas, secuencias, newsletters e invitar nuevos miembros. Solo el propietario puede disolver el equipo.
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
