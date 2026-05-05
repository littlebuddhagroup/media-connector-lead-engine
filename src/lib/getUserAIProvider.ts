import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Lee el proveedor de IA preferido del usuario desde su fila de settings.
 * Devuelve 'gemini' por defecto si no hay setting guardado.
 */
export async function getUserAIProvider(
  supabase: SupabaseClient,
  userId: string
): Promise<string> {
  const { data } = await supabase
    .from('settings')
    .select('ai_provider')
    .eq('user_id', userId)
    .single()

  return (data?.ai_provider as string) ?? 'gemini'
}

/**
 * Lee proveedor Y modelo de IA del usuario desde settings.
 * Modelo por defecto: gemini-2.0-flash (rápido y estable).
 */
export async function getUserAISettings(
  supabase: SupabaseClient,
  userId: string
): Promise<{ provider: string; model: string }> {
  const { data } = await supabase
    .from('settings')
    .select('ai_provider, ai_model')
    .eq('user_id', userId)
    .single()

  return {
    provider: (data?.ai_provider as string) ?? 'gemini',
    model: (data?.ai_model as string) ?? 'gemini-2.5-flash',
  }
}
