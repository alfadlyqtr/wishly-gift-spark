// supabase/functions/extract-from-image/index.ts - GEMINI 2.5 FLASH-LITE CLEAN VERSION
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
// Import the Google Generative AI SDK via npm specifier (supported by Deno)
import { GoogleGenerativeAI } from 'npm:@google/generative-ai@0.11.3';

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
  const toneIntensity = (tone || 'natural').toLowerCase();
  const writingStyle = (style || 'Auto').toLowerCase();

  // The core instruction prompt (wishlist-style, personal tone)
  const prompt = `Analyze the uploaded product image.
  Identify the brand and item name, then write a wishlist-style description that sounds personal and natural (not like a store listing).
  Rules for Description:
  - Language: ${locale === 'ar' ? 'Arabic' : 'English'}
  - Tone intensity: ${toneIntensity} (options: neutral, chill, interested, excited, obsessed). Reflect emotion, but stay tasteful.
  - Writing style: ${writingStyle} (options: auto, professional, natural, gen z). Style controls register/word choice only; tone controls emotion.
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
