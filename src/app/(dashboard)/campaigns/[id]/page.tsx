import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import TopBar from '@/components/layout/TopBar'
import { Plus, Users, Mail, TrendingUp, Zap, ArrowLeft } from 'lucide-react'
import { formatDate, statusLabel, statusColor, priorityColor, scoreToBg } from '@/lib/utils'

type Params = { params: Promise<{ id: string }> }

export default async function CampaignDetailPage({ params }: Params) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: campaign, error } = await supabase
    .from('campaigns')
    .select('*, leads(id, company_name, email, status, priority, score, created_at, is_enriched)')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (error || !campaign) notFound()

  const leads = campaign.leads ?? []
  const replyRate = campaign.contacted_leads > 0
    ? Math.round((campaign.replied_leads / campaign.contacted_leads) * 100)
    : 0

  return (
    <div className="animate-fade-in">
      <TopBar
        title={campaign.name}
        subtitle={`${statusLabel(campaign.status)} · ${leads.length} leads`}
        actions={
          <div className="flex gap-2">
            <Link href="/campaigns" className="btn-secondary text-xs py-1.5">
              <ArrowLeft className="w-3.5 h-3.5" /> Campañas
            </Link>
            <Link href={`/imports?campaign=${id}`} className="btn-primary text-xs py-1.5">
              <Plus className="w-3.5 h-3.5" /> Importar leads
            </Link>
          </div>
        }
      />

      <div className="p-6 space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: 'Total leads', value: campaign.total_leads, icon: Users, color: 'text-blue-600 bg-blue-50' },
            { label: 'Contactados', value: campaign.contacted_leads, icon: Mail, color: 'text-purple-600 bg-purple-50' },
            { label: 'Respondidos', value: campaign.replied_leads, icon: TrendingUp, color: 'text-green-600 bg-green-50' },
            { label: 'Tasa respuesta', value: `${replyRate}%`, icon: Zap, color: 'text-brand-600 bg-brand-50' },
          ].map((stat) => (
            <div key={stat.label} className="card p-4">
              <div className={`w-8 h-8 rounded-lg ${stat.color} flex items-center justify-center mb-2`}>
                <stat.icon className="w-4 h-4" />
              </div>
              <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
              <p className="text-xs text-gray-500 mt-0.5">{stat.label}</p>
            </div>
          ))}
        </div>

        {/* Info campaña */}
        <div className="card p-5">
          <div className="grid sm:grid-cols-3 gap-4 text-sm">
            {campaign.description && (
              <div className="sm:col-span-3">
                <span className="text-xs text-gray-400 uppercase tracking-wide font-medium">Descripción</span>
                <p className="text-gray-700 mt-1">{campaign.description}</p>
              </div>
            )}
            {[
              { label: 'País', value: campaign.country },
              { label: 'Sector', value: campaign.sector },
              { label: 'Idioma', value: campaign.language },
              { label: 'Tipo empresa', value: campaign.target_type },
              { label: 'Tamaño', value: campaign.target_size },
              { label: 'Creada', value: formatDate(campaign.created_at) },
            ].filter(f => f.value).map(field => (
              <div key={field.label}>
                <span className="text-xs text-gray-400 uppercase tracking-wide font-medium">{field.label}</span>
                <p className="text-gray-700 font-medium mt-0.5">{field.value}</p>
              </div>
            ))}
            {campaign.keywords?.length > 0 && (
              <div className="sm:col-span-3">
                <span className="text-xs text-gray-400 uppercase tracking-wide font-medium">Keywords</span>
                <div className="flex flex-wrap gap-1.5 mt-1">
                  {campaign.keywords.map((kw: string) => (
                    <span key={kw} className="text-xs bg-brand-50 text-brand-700 px-2 py-0.5 rounded-full">{kw}</span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Tabla de leads */}
        <div className="card">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
            <h3 className="text-sm font-semibold text-gray-900">Leads de esta campaña</h3>
            <Link href={`/leads?campaign=${id}`} className="text-xs text-brand-600 hover:text-brand-700">
              Ver en CRM →
            </Link>
          </div>
          {leads.length === 0 ? (
            <div className="py-12 text-center">
              <p className="text-sm text-gray-500 mb-4">Esta campaña no tiene leads todavía.</p>
              <Link href={`/imports?campaign=${id}`} className="btn-primary text-xs">
                <Plus className="w-3.5 h-3.5" /> Importar leads CSV
              </Link>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100">
                    {['Empresa', 'Email', 'Estado', 'Prioridad', 'Score', 'Añadido'].map(h => (
                      <th key={h} className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {leads.map((lead: { id: string; company_name: string; email?: string; status: string; priority: string; score: number; created_at: string; is_enriched?: boolean }) => (
                    <tr key={lead.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-5 py-3">
                        <Link href={`/leads/${lead.id}`} className="font-medium text-gray-900 hover:text-brand-700">
                          {lead.company_name}
                        </Link>
                        {lead.is_enriched && (
                          <span className="ml-2 text-xs text-brand-500">✦ IA</span>
                        )}
                      </td>
                      <td className="px-5 py-3 text-gray-500">{lead.email || '—'}</td>
                      <td className="px-5 py-3">
                        <span className={`badge ${statusColor(lead.status)}`}>
                          {statusLabel(lead.status)}
                        </span>
                      </td>
                      <td className="px-5 py-3">
                        <span className={`badge ${priorityColor(lead.priority)}`}>
                          {lead.priority}
                        </span>
                      </td>
                      <td className="px-5 py-3">
                        <span className={`badge font-semibold ${scoreToBg(lead.score)}`}>
                          {lead.score}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-gray-400 text-xs">
                        {formatDate(lead.created_at)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
