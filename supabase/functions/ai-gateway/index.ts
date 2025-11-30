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
    // 1. Get the URL from request body
    const { url } = await req.json();

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

    // 4. Use DeepSeek to extract structured product info
    const prompt = `Extract product information from this webpage content. Return ONLY a JSON object with these fields: title, description, image_url, item_url.

Title from page: ${basicTitle}
Description from page: ${basicDesc}
Image from page: ${basicImage}
URL: ${url}

HTML snippet (first 2000 chars):
${html.substring(0, 2000)}

Return ONLY valid JSON, no markdown, no explanation:`;

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

    // 5. Return structured product data
    return new Response(JSON.stringify({
      title: productData.title || basicTitle || 'Product',
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
