import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import TopBar from '@/components/layout/TopBar'
import { Plus, Users, Mail, TrendingUp } from 'lucide-react'
import { statusLabel, statusColor, formatDate } from '@/lib/utils'

export default async function CampaignsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: campaigns } = await supabase
    .from('campaigns')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  return (
    <div className="animate-fade-in">
      <TopBar
        title="Campañas"
        subtitle={`${campaigns?.length ?? 0} campañas creadas`}
        actions={
          <Link href="/campaigns/new" className="btn-primary text-xs py-1.5">
            <Plus className="w-3.5 h-3.5" /> Nueva campaña
          </Link>
        }
      />

      <div className="p-6">
        {campaigns?.length === 0 ? (
          <div className="card flex flex-col items-center justify-center py-20 text-center">
            <div className="w-14 h-14 bg-brand-50 rounded-2xl flex items-center justify-center mb-4">
              <Plus className="w-7 h-7 text-brand-500" />
            </div>
            <h3 className="text-base font-semibold text-gray-900 mb-1">Crea tu primera campaña</h3>
            <p className="text-sm text-gray-500 mb-6 max-w-sm">
              Organiza tus leads en campañas por sector, país o tipo de empresa objetivo.
            </p>
            <Link href="/campaigns/new" className="btn-primary">
              <Plus className="w-4 h-4" /> Nueva campaña
            </Link>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {campaigns?.map((campaign) => {
              const replyRate = campaign.contacted_leads > 0
                ? Math.round((campaign.replied_leads / campaign.contacted_leads) * 100)
                : 0
              return (
                <Link
                  key={campaign.id}
                  href={`/campaigns/${campaign.id}`}
                  className="card p-5 hover:shadow-md hover:border-brand-200 transition-all group"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-semibold text-gray-900 truncate group-hover:text-brand-700">
                        {campaign.name}
                      </h3>
                      {campaign.description && (
                        <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">{campaign.description}</p>
                      )}
                    </div>
                    <span className={`badge ml-2 shrink-0 ${statusColor(campaign.status)}`}>
                      {statusLabel(campaign.status)}
                    </span>
                  </div>

                  <div className="flex items-center gap-1 flex-wrap mb-3">
                    {campaign.country && (
                      <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{campaign.country}</span>
                    )}
                    {campaign.sector && (
                      <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{campaign.sector}</span>
                    )}
                  </div>

                  <div className="grid grid-cols-3 gap-2 mb-3">
                    <div className="text-center p-2 bg-gray-50 rounded-lg">
                      <p className="text-lg font-bold text-gray-900">{campaign.total_leads}</p>
                      <p className="text-xs text-gray-500 flex items-center justify-center gap-0.5">
                        <Users className="w-3 h-3" /> Leads
                      </p>
                    </div>
                    <div className="text-center p-2 bg-gray-50 rounded-lg">
                      <p className="text-lg font-bold text-gray-900">{campaign.contacted_leads}</p>
                      <p className="text-xs text-gray-500 flex items-center justify-center gap-0.5">
                        <Mail className="w-3 h-3" /> Contact.
                      </p>
                    </div>
                    <div className="text-center p-2 bg-gray-50 rounded-lg">
                      <p className="text-lg font-bold text-gray-900">{replyRate}%</p>
                      <p className="text-xs text-gray-500 flex items-center justify-center gap-0.5">
                        <TrendingUp className="w-3 h-3" /> Resp.
                      </p>
                    </div>
                  </div>

                  {/* Barra de progreso */}
                  <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-brand-500 rounded-full"
                      style={{
                        width: `${campaign.total_leads > 0
                          ? Math.min(100, (campaign.contacted_leads / campaign.total_leads) * 100)
                          : 0}%`
                      }}
                    />
                  </div>

                  <p className="text-xs text-gray-400 mt-2">
                    Creada {formatDate(campaign.created_at)}
                  </p>
                </Link>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
