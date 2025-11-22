// supabase/functions/extract-from-image/index.ts - GEMINI 2.5 FLASH-LITE CLEAN VERSION
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
// Import the Google Generative AI SDK via esm.sh CDN (Deno-compatible)
import { GoogleGenerativeAI } from 'https://esm.sh/@google/generative-ai@0.21.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};

// 1. Get the new Gemini API Key from Supabase Secrets
const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');

async function geminiExtractStructure(image_base64: string, locale: string, tone?: string, style?: string) {
  if (!GEMINI_API_KEY) {
    throw new Error('Missing GEMINI_API_KEY secret');
  }

  // Initialize the Gemini client
  const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash-lite' });

  // Define the structured output format (JSON Schema)
  const schema = {
    type: 'object',
    properties: {
      Brand: { type: 'string', description: 'The company or designer brand name, e.g., Louis Vuitton.' },
      Item_Name: { type: 'string', description: 'The specific or generic product name, e.g., Reflection Square Sunglasses.' },
      Description: { 
        type: 'string', 
        description: 'A brief, natural description of the item, color, and key features. Must be 2-3 lines maximum.' 
      }
    },
    required: ['Brand', 'Item_Name', 'Description']
  } as const;

  // Tone/style guidance
  // Normalize inputs
  const toneIntensityRaw = (tone || 'natural').toLowerCase();
  const toneIntensity = ['neutral','chill','interested','excited','obsessed'].includes(toneIntensityRaw)
    ? toneIntensityRaw
    : 'natural';
  let writingStyle = (style || 'auto').toLowerCase().replace(/\s+/g, ' ');
  if (writingStyle === 'genz') writingStyle = 'gen z';
  if (!['auto','professional','natural','gen z'].includes(writingStyle)) writingStyle = 'auto';

  // Derive tone/style rule snippets
  const toneRulesMap: Record<string, string> = {
    neutral: 'No first-person. Objective phrasing. No exclamations.',
    chill: 'Soft, calm phrasing. First-person optional. No exclamations.',
    interested: 'One mild first-person cue (e.g., "I like"). Positive but restrained.',
    excited: 'Upbeat first-person (e.g., "I love"). One exclamation at most; keep tasteful.',
    obsessed: 'Enthusiastic first-person (e.g., "I really want this"). No more than one exclamation. Still tasteful.'
  };
  const styleRulesMap: Record<string, string> = {
    'auto': 'Neutral register based on language. No slang or emoji.',
    'professional': 'Formal, clean sentences, no slang/emoji, avoid contractions.',
    'natural': 'Everyday conversational voice, contractions allowed, no slang/emoji.',
    'gen z': 'Light slang allowed, at most 1 emoji, concise and playful.'
  };
  const toneRule = toneRulesMap[toneIntensity] || toneRulesMap['interested'];
  const styleRule = styleRulesMap[writingStyle] || styleRulesMap['auto'];

  // The core instruction prompt (wishlist-style, personal tone)
  const prompt = `Analyze the uploaded product image.
  Identify the brand and item name, then write a wishlist-style description that sounds personal and natural (not like a store listing).
  Rules for Description:
  - Language: ${locale === 'ar' ? 'Arabic' : 'English'}
  - Tone: ${toneIntensity}. ${toneRule}
  - Style: ${writingStyle}. ${styleRule}
  - Avoid marketing jargon and spec-sheet terms; no prices or model codes.
  - Length: 1–2 sentences (<= 200 characters ideally).
  - Brand: mention naturally once near the start; do not repeat the brand.
  - Focus on color/material/feel and why it’s desirable.
  Respond ONLY with the JSON matching the schema.`;

  try {
    const result = await model.generateContent({
      contents: [
        {
          role: 'user',
          parts: [
            { inlineData: { mimeType: 'image/jpeg', data: image_base64 } },
            { text: prompt },
          ],
        },
      ],
      generationConfig: {
        responseMimeType: 'application/json',
        // Deno types accept plain object here
        responseSchema: schema as unknown as Record<string, unknown>,
        temperature: 0.2,
      },
    });

    const jsonText = result.response.text().trim();
    return JSON.parse(jsonText);
  } catch (e) {
    console.error('Gemini API Error:', e);
    // Return a structured error response
    return {
        Brand: 'Error',
        Item_Name: 'Analysis Failed',
        Description: 'Could not extract structured details using the AI Vision model.',
    };
  }
}

// -----------------------------------------------------------
// Main Handler: Now simplified to call the new Gemini function
// -----------------------------------------------------------
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // 3. Request body parsing
    const { image_base64, locale = 'en', tone, style } = await req.json();
    if (!image_base64) {
      throw new Error('image_base64 is required');
    }

    // 4. Call the new simplified Gemini function
    const structured = await geminiExtractStructure(image_base64, locale, tone, style);

    // 5. Return the final structured JSON response
    return new Response(JSON.stringify({
      ok: true,
      structured,
    }), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return new Response(JSON.stringify({
      ok: false,
      error: msg
    }), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      },
      status: 400
    });
  }
});

// NOTE: All previous functions (visionAnnotate, summarizeVision, hexToColorName, deepseekStructure) 
// have been removed to minimize complexity and cost.
