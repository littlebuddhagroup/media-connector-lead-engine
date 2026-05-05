import { NextResponse } from 'next/server'
import { GoogleGenAI } from '@google/genai'

export async function GET(request: Request) {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    return NextResponse.json({ ok: false, error: 'GEMINI_API_KEY no configurada en el servidor' })
  }

  // Leer modelo del query param (viene del selector de modelo en Settings)
  const url = new URL(request.url)
  const modelParam = url.searchParams.get('model')

  try {
    const client = new GoogleGenAI({ apiKey })
    const model = modelParam ?? process.env.GEMINI_MODEL ?? 'gemini-2.5-flash'
    const res = await client.models.generateContent({
      model,
      contents: 'Responde solo con: ok',
      config: { maxOutputTokens: 5, temperature: 0 },
    })
    const text = res.text?.trim() ?? ''
    if (text) {
      return NextResponse.json({ ok: true, model })
    }
    return NextResponse.json({ ok: false, error: 'Sin respuesta de Gemini' })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    let friendly = msg
    if (msg.includes('429') || msg.includes('RESOURCE_EXHAUSTED')) {
      friendly = 'Cuota agotada — activa el billing en Google Cloud Console'
    } else if (msg.includes('403') || msg.includes('PERMISSION_DENIED')) {
      friendly = 'Billing no activado — ve a console.cloud.google.com y activa la facturación'
    } else if (msg.includes('API_KEY_INVALID') || msg.includes('401')) {
      friendly = 'API key inválida'
    }
    return NextResponse.json({ ok: false, error: friendly })
  }
}
