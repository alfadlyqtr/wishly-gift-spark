// supabase/functions/extract-from-image/index.ts
// Google Vision OCR + Deepseek post-processing - CLEAN VERSION
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const VISION_API_KEY = Deno.env.get('GOOGLE_VISION_API_KEY')
const VISION_URL = `https://vision.googleapis.com/v1/images:annotate?key=${VISION_API_KEY ?? ''}`
const VISION_USE_WEB = (Deno.env.get('VISION_USE_WEB') || 'false').toLowerCase() === 'true'

async function visionAnnotate(imageBase64: string) {
  if (!VISION_API_KEY) throw new Error('Missing GOOGLE_VISION_API_KEY secret')
  const reqBody = {
    requests: [{
      image: { content: imageBase64 },
      features: [
        { type: 'DOCUMENT_TEXT_DETECTION' },
        { type: 'LOGO_DETECTION' },
        { type: 'LABEL_DETECTION', maxResults: 10 },
        { type: 'IMAGE_PROPERTIES' },
        ...(VISION_USE_WEB ? [{ type: 'WEB_DETECTION' }] : []),
      ],
    }],
  }
  const res = await fetch(VISION_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(reqBody),
  })
  if (!res.ok) throw new Error(`Vision error ${res.status}: ${await res.text()}`)
  return await res.json()
}

function hexToColorName(hex: string): { name: string; confidence: number } {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  
  // Calculate brightness and saturation
  const brightness = (r + g + b) / 3
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const saturation = max === 0 ? 0 : (max - min) / max
  
  // Skip very dark or very light colors with low saturation (noise)
  if (brightness < 30 && saturation < 0.2) return { name: '', confidence: 0 }
  if (brightness > 230 && saturation < 0.1) return { name: '', confidence: 0 }
  
  // Precise color detection
  if (brightness < 40) return { name: 'black', confidence: 0.9 }
  if (brightness > 220 && saturation < 0.15) return { name: 'white', confidence: 0.9 }
  
  // Gold detection (high R, medium-high G, low B)
  if (r > 180 && g > 140 && g < 200 && b < 100) return { name: 'gold', confidence: 0.85 }
  
  // Blue detection
  if (b > r && b > g && b > 100) {
    if (brightness < 100) return { name: 'navy blue', confidence: 0.8 }
    return { name: 'blue', confidence: 0.8 }
  }
  
  // Gray detection
  if (Math.abs(r - g) < 30 && Math.abs(g - b) < 30 && Math.abs(r - b) < 30) {
    if (brightness < 80) return { name: 'dark gray', confidence: 0.7 }
    if (brightness > 160) return { name: 'light gray', confidence: 0.7 }
    return { name: 'gray', confidence: 0.7 }
  }
  
  // Red (should be rare)
  if (r > g + 50 && r > b + 50) return { name: 'red', confidence: 0.6 }
  
  // Green
  if (g > r + 50 && g > b + 50) return { name: 'green', confidence: 0.6 }
  
  return { name: '', confidence: 0 }
}

function summarizeVision(visionJson: any) {
  try {
    const resp = visionJson?.responses?.[0] || {}
    const text = resp.fullTextAnnotation?.text || ''
    const logos = (resp.logoAnnotations || []).map((l: any) => l.description).filter(Boolean)
    const labels = (resp.labelAnnotations || []).map((l: any) => l.description).filter(Boolean)
    
    // Extract and filter colors
    const rawColors: { hex: string; score: number }[] = []
    const dom = resp.imagePropertiesAnnotation?.dominantColors?.colors || []
    for (const c of dom) {
      const r = c.color?.red ?? 0, g = c.color?.green ?? 0, b = c.color?.blue ?? 0
      const hex = `#${[r, g, b].map(v => v.toString(16).padStart(2, '0')).join('')}`
      const colorInfo = hexToColorName(hex)
      if (colorInfo.name && colorInfo.confidence > 0.6) {
        rawColors.push({ hex, score: c.score ?? 0 })
      }
    }
    
    // Get top 2 distinct colors only
    const colors = rawColors.slice(0, 2)
    
    const webGuess = resp.webDetection?.bestGuessLabels?.[0]?.label || ''
    const webEntities = (resp.webDetection?.webEntities || [])
      .filter((e: any) => e.score > 0.5)
      .map((e: any) => e.description)
      .filter(Boolean)
      .slice(0, 3)
    
    return { text, logos, labels, colors, webGuess, webEntities }
  } catch {
    return { text: '', logos: [], labels: [], colors: [], webGuess: '', webEntities: [] }
  }
}

async function deepseekStructure(args: {
  text: string; logos: string[]; labels: string[]; colors: { hex: string; score: number }[]; 
  webGuess?: string; webEntities?: string[]; locale: "en" | "ar";
}) {
  const { text, logos, labels, colors, webGuess = '', webEntities = [], locale } = args
  
  // Extract color names (top 2 only)
  const colorNames = colors.map(c => hexToColorName(c.hex).name).filter(Boolean).slice(0, 2)
  
  // Build title from brand + web guess or labels
  const brand = logos[0] || ''
  const modelHint = webGuess || webEntities[0] || labels[0] || ''
  const title = brand && modelHint ? `${brand} ${modelHint}` : (brand || modelHint || 'Product')
  
  // Fallback description (clean, no brand repetition)
  const productType = labels[0] || 'item'
  const colorPhrase = colorNames.length > 0 
    ? (locale === 'ar' ? `بألوان ${colorNames.join(' و')}` : `in ${colorNames.join(' and ')}`)
    : ''
  const fallbackDesc = locale === 'ar'
    ? `${productType} ${colorPhrase}`.trim()
    : `${productType.charAt(0).toUpperCase() + productType.slice(1)} ${colorPhrase}`.trim()
  
  // Try Deepseek for natural description
  try {
    const gatewayUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/ai-gateway`
    const sys = locale === 'ar'
      ? `أنت Wishly. أعِد JSON: {title, brand, description, url}. الوصف: جملة واحدة طبيعية تصف المنتج بدون ذكر العلامة التجارية. مثال: "نظارة شمسية مربعة فاخرة بإطار أسود وتفاصيل ذهبية". بدون أسعار.`
      : `You are Wishly. Return JSON: {title, brand, description, url}. Description: ONE natural sentence describing the product WITHOUT mentioning the brand name. Example: "Luxury square sunglasses with black acetate frame and gold-tone hardware". No prices.`
    
    const colorDesc = colorNames.join(locale === 'ar' ? ' و' : ' and ')
    const content = locale === 'ar'
      ? `المنتج: ${modelHint}\nالعلامة: ${brand}\nالنوع: ${labels.slice(0, 3).join('، ')}\nالألوان: ${colorDesc}\n\nاكتب وصفًا طبيعيًا بدون ذكر "${brand}".`
      : `Product: ${modelHint}\nBrand: ${brand}\nType: ${labels.slice(0, 3).join(', ')}\nColors: ${colorDesc}\n\nWrite a natural description WITHOUT mentioning "${brand}".`
    
    const body = {
      model: 'deepseek-chat',
      messages: [
        { role: 'system', content: sys },
        { role: 'user', content },
      ],
      temperature: 0.4,
      max_tokens: 200,
    }
    
    const res = await fetch(gatewayUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${Deno.env.get('SUPABASE_ANON_KEY')}`,
      },
      body: JSON.stringify(body),
    })
    
    if (res.ok) {
      const txt = await res.text()
      const jsonMatch = txt.match(/\{[\s\S]*?"description"[\s\S]*?\}/)
      if (jsonMatch) {
        const out = JSON.parse(jsonMatch[0])
        if (out.description && !out.description.includes(brand)) {
          return {
            title: out.title || title,
            brand: out.brand || brand,
            description: out.description,
            url: ''
          }
        }
      }
    }
  } catch (e) {
    console.error('Deepseek error:', e)
  }
  
  return { title, brand, description: fallbackDesc, url: '' }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  try {
    const { image_base64, locale = 'en' } = await req.json()
    if (!image_base64) throw new Error('image_base64 is required')
    
    const vision = await visionAnnotate(image_base64)
    const summary = summarizeVision(vision)
    const structured = await deepseekStructure({ 
      text: summary.text, 
      logos: summary.logos, 
      labels: summary.labels, 
      colors: summary.colors, 
      webGuess: summary.webGuess, 
      webEntities: summary.webEntities, 
      locale 
    })
    
    return new Response(JSON.stringify({
      ok: true,
      structured,
      colors: summary.colors,
      logos: summary.logos,
      labels: summary.labels,
      webGuess: summary.webGuess,
      webEntities: summary.webEntities,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return new Response(JSON.stringify({ ok: false, error: msg }), { 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }, 
      status: 400 
    })
  }
})
