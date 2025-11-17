// supabase/functions/extract-from-image/index.ts
// Google Vision OCR + optional Deepseek post-processing to structure fields
// Requires Supabase secrets:
// - GOOGLE_VISION_API_KEY: string
// - (optional) DEEPSEEK_API_KEY already used by ai-gateway

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { corsHeaders } from '../_shared/cors.ts'

const VISION_API_KEY = Deno.env.get('GOOGLE_VISION_API_KEY')
const VISION_URL = `https://vision.googleapis.com/v1/images:annotate?key=${VISION_API_KEY ?? ''}`

// Helper to call Google Vision
async function visionAnnotate(imageBase64: string) {
  if (!VISION_API_KEY) throw new Error('Missing GOOGLE_VISION_API_KEY secret')
  const reqBody = {
    requests: [
      {
        image: { content: imageBase64 },
        features: [
          { type: 'DOCUMENT_TEXT_DETECTION' },
          { type: 'LOGO_DETECTION' },
          { type: 'LABEL_DETECTION', maxResults: 8 },
          { type: 'IMAGE_PROPERTIES' },
        ],
      },
    ],
  }
  const res = await fetch(VISION_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(reqBody),
  })
  if (!res.ok) throw new Error(`Vision error ${res.status}: ${await res.text()}`)
  const json = await res.json()
  return json
}

function summarizeVision(visionJson: any) {
  try {
    const resp = visionJson?.responses?.[0] || {}
    const text = resp.fullTextAnnotation?.text || ''
    const logos = (resp.logoAnnotations || []).map((l: any) => l.description).filter(Boolean)
    const labels = (resp.labelAnnotations || []).map((l: any) => l.description).filter(Boolean)
    const colors: { hex: string; score: number }[] = []
    const dom = resp.imagePropertiesAnnotation?.dominantColors?.colors || []
    for (const c of dom) {
      const r = c.color?.red ?? 0, g = c.color?.green ?? 0, b = c.color?.blue ?? 0
      const hex = `#${[r, g, b].map(v => v.toString(16).padStart(2, '0')).join('')}`
      colors.push({ hex, score: c.score ?? 0 })
    }
    return { text, logos, labels, colors }
  } catch {
    return { text: '', logos: [], labels: [], colors: [] as { hex: string; score: number }[] }
  }
}

async function deepseekStructure({ text, logos, labels, locale }: { text: string; logos: string[]; labels: string[]; locale: 'en' | 'ar' }) {
  // Call our existing ai-gateway with OpenAI-style chat to produce structured JSON
  const gatewayUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/ai-gateway`
  const sys = locale === 'ar'
    ? 'أنت Wishly. صِغ حقول JSON فقط: title, brand, description, url. لا تُدخل أسعارًا. إن لم تتوفر قيمة فاترك الحقل.'
    : 'You are Wishly. Return ONLY JSON fields: title, brand, description, url. No prices. Leave missing fields empty.'
  const content = locale === 'ar'
    ? `نص مُستخرج من الصورة:\n${text}\n\nشعارات مرجعية: ${logos.join(', ')}\nتسميات وصِفات: ${labels.join(', ')}`
    : `OCR text:\n${text}\n\nLogos: ${logos.join(', ')}\nLabels: ${labels.join(', ')}`
  const body = {
    model: 'deepseek-chat',
    messages: [
      { role: 'system', content: sys },
      { role: 'user', content },
    ],
    temperature: 0.2,
    max_tokens: 400,
  }
  const res = await fetch(gatewayUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${Deno.env.get('SUPABASE_ANON_KEY')}` },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    // Best-effort: just craft minimal output from text/logos/labels
    const brand = logos[0] || ''
    const title = brand ? `${brand} ${labels[0] || ''}`.trim() : (labels[0] || '')
    const description = text.slice(0, 300)
    return { title, brand, description, url: '' }
  }
  let out: any = null
  try { out = await res.json() } catch { const txt = await res.text(); const m = txt.match(/\{[\s\S]*\}/); if (m) out = JSON.parse(m[0]) }
  if (out && typeof out === 'object') return out
  // Fallback minimal
  const brand = logos[0] || ''
  const title = brand ? `${brand} ${labels[0] || ''}`.trim() : (labels[0] || '')
  const description = text.slice(0, 300)
  return { title, brand, description, url: '' }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  try {
    const { image_base64, locale = 'en' } = await req.json()
    if (!image_base64) throw new Error('image_base64 is required')
    const vision = await visionAnnotate(image_base64)
    const summary = summarizeVision(vision)
    const structured = await deepseekStructure({ text: summary.text, logos: summary.logos, labels: summary.labels, locale })
    return new Response(JSON.stringify({
      ok: true,
      structured,
      colors: summary.colors,
      logos: summary.logos,
      labels: summary.labels,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return new Response(JSON.stringify({ ok: false, error: msg }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 })
  }
})
