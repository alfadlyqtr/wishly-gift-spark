// supabase/functions/ai-gateway/index.ts
// This function scrapes product URLs and extracts details using DeepSeek AI

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { corsHeaders } from '../_shared/cors.ts';

// IMPORTANT: The DeepSeek API Key must be set in the Supabase Project's "Secrets"
// It should be named 'DEEPSEEK_API_KEY'
const DEEPSEEK_API_KEY = Deno.env.get('DEEPSEEK_API_KEY');
const DEEPSEEK_API_URL = 'https://api.deepseek.com/v1/chat/completions';

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { url, mode, tone, name, description, product_url, locale } = body ?? {};

    // If mode is rewrite-description, use DeepSeek to rewrite copy and return early
    if (mode === 'rewrite-description') {
      if (!DEEPSEEK_API_KEY) {
        throw new Error('DeepSeek API key is not set in project secrets.');
      }

      const systemPrompt = `You are a copywriter helping a brand edit a product description inside a dashboard.
You must respond ONLY with valid JSON, no explanations or markdown.

Return a JSON object with this shape:
{
  "name": "refined product name (same language as input)",
  "description": "rewritten description"
}

Rules for the "name" field:
- Must be a single concise product title, not a full sentence.
- No marketing phrases, no calls to action.
- No duplicated description text.
- Max 90 characters.

Tone options and rules:
- tidy: shorter and cleaner than the original. Max 2-3 sentences. Remove repetition.
- confident: strong, clear, but still professional.
- pro: more technical/spec driven, less marketing, but readable.
- sales: friendly, persuasive, focused on benefits.
- aggressive: high-energy sales copy with urgency, but do not invent fake discounts.

Always keep product facts accurate and do not change currency or numbers.
Language: ${locale || 'en'}.
`; 

      const userContent = `tone: ${tone || 'tidy'}
product name: ${name || ''}
current description: ${description || ''}
product url: ${product_url || ''}`;

      const deepseekResponse = await fetch(DEEPSEEK_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${DEEPSEEK_API_KEY}`,
        },
        body: JSON.stringify({
          model: 'deepseek-chat',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userContent },
          ],
          temperature: 0.6,
          max_tokens: 300,
        }),
      });

      if (!deepseekResponse.ok) {
        const errorBody = await deepseekResponse.text();
        console.error('DeepSeek rewrite API Error:', errorBody);
        throw new Error('Failed to rewrite description with AI.');
      }

      const aiResult = await deepseekResponse.json();
      const aiContent = aiResult.choices?.[0]?.message?.content || '{}';

      let rewritten: { name?: string; description?: string } = {};
      try {
        const jsonStr = aiContent.replace(/```json\n?/gi, '').replace(/```\n?/gi, '').trim();
        rewritten = JSON.parse(jsonStr);
      } catch (e) {
        console.error('Failed to parse DeepSeek rewrite response as JSON:', aiContent);
        rewritten = {};
      }

      return new Response(JSON.stringify({
        name: rewritten.name ?? name ?? '',
        description: rewritten.description ?? description ?? '',
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 1. Get the URL from request body for scraping mode
    if (!url) {
      throw new Error('URL is required');
    }

    // 2. Validate API key
    if (!DEEPSEEK_API_KEY) {
      throw new Error('DeepSeek API key is not set in project secrets.');
    }

    // 3. Fetch the webpage content
    console.log('Fetching URL:', url);
    const pageResponse = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
      },
    });

    if (!pageResponse.ok) {
      throw new Error(`Failed to fetch URL: ${pageResponse.status}`);
    }

    const html = await pageResponse.text();
    
    // Extract basic info from HTML (title, meta tags)
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    const descMatch = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i);
    const ogImageMatch = html.match(/<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["']/i);
    
    const basicTitle = titleMatch ? titleMatch[1].trim() : '';
    const basicDesc = descMatch ? descMatch[1].trim() : '';
    const basicImage = ogImageMatch ? ogImageMatch[1].trim() : '';

    // 4. Use DeepSeek to extract structured product info from the page HTML
    const prompt = `You are helping build a product catalog. Read this product page HTML and return ONLY a JSON object with these fields:
{
  "title": "clean product name (no store name, no 'Buy', no marketing phrase)",
  "description": "rich product description (3-6 sentences, focused on specs and real details)",
  "image_url": "best main product image URL",
  "item_url": "canonical product URL"
}

Guidelines for title:
- Short, product-focused.
- Remove words like "Buy", "Shop", and the store name (Apple, Amazon, etc.).
- Do NOT copy the whole description into the title.

Guidelines for description:
- Use information from the page (features, specs, variants) instead of generic marketing fluff.
- Prefer concrete details: chip, memory, storage, size, material, color, etc.
- 3-6 sentences max. No bullet points, no markdown.
- Do NOT invent fake discounts or availability.

You may use these extracted hints, but you are NOT required to keep them exactly:
- Raw <title>: ${basicTitle}
- Raw meta description: ${basicDesc}
- Raw og:image: ${basicImage}
- URL: ${url}

HTML snippet (first 4000 characters):
${html.substring(0, 4000)}

Return ONLY valid JSON, no markdown, no explanation.`;

    const deepseekResponse = await fetch(DEEPSEEK_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${DEEPSEEK_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.3,
        max_tokens: 500,
      }),
    });

    if (!deepseekResponse.ok) {
      const errorBody = await deepseekResponse.text();
      console.error('DeepSeek API Error:', errorBody);
      
      // Fallback to basic extraction if AI fails
      return new Response(JSON.stringify({
        title: basicTitle || 'Product',
        description: basicDesc || '',
        image_url: basicImage || '',
        item_url: url,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const aiResult = await deepseekResponse.json();
    const aiContent = aiResult.choices?.[0]?.message?.content || '{}';
    
    // Parse AI response
    let productData;
    try {
      // Remove markdown code blocks if present
      const jsonStr = aiContent.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      productData = JSON.parse(jsonStr);
    } catch (e) {
      console.error('Failed to parse AI response:', aiContent);
      // Fallback to basic extraction
      productData = {
        title: basicTitle || 'Product',
        description: basicDesc || '',
        image_url: basicImage || '',
        item_url: url,
      };
    }

    // 5. Return structured product data with a cleaned-up title
    const rawTitle = (productData.title || basicTitle || 'Product').trim();
    let cleanedTitle = rawTitle;

    // Remove leading marketing verbs like "Buy" or "Shop"
    cleanedTitle = cleanedTitle.replace(/^(Buy|Shop)\s+/i, '');

    // Remove trailing store name sections like "- Apple" or "| Apple"
    cleanedTitle = cleanedTitle.replace(/\s*[-–|]\s*(Apple|Amazon|Best Buy|Target).*$/i, '');

    if (!cleanedTitle.trim()) {
      cleanedTitle = rawTitle;
    }

    return new Response(JSON.stringify({
      title: cleanedTitle,
      description: productData.description || basicDesc || '',
      image_url: productData.image_url || basicImage || '',
      item_url: productData.item_url || url,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error in AI Gateway:', errorMessage);
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});
