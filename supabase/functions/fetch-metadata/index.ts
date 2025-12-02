
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import * as cheerio from "https://esm.sh/cheerio@1.0.0-rc.12";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { url } = await req.json();

    if (!url) {
      return new Response(
        JSON.stringify({ error: 'URL is required' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // 1. Fetch the HTML
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; WishlyBot/1.0; +http://wishly.app)'
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch URL: ${response.statusText}`);
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    // 2. Extract Metadata
    const getMeta = (prop: string) => 
      $(`meta[property="${prop}"]`).attr('content') || 
      $(`meta[name="${prop}"]`).attr('content');

    const title = getMeta('og:title') || getMeta('twitter:title') || $('title').text() || '';
    const description = getMeta('og:description') || getMeta('twitter:description') || getMeta('description') || '';
    const image = getMeta('og:image') || getMeta('twitter:image') || '';
    const siteName = getMeta('og:site_name') || '';
    
    // Brand fallback: Try to parse domain from URL if site_name is empty
    let brand = siteName;
    if (!brand) {
      try {
        const urlObj = new URL(url);
        brand = urlObj.hostname.replace('www.', '').split('.')[0];
        // Capitalize first letter
        brand = brand.charAt(0).toUpperCase() + brand.slice(1);
      } catch (e) {
        // ignore invalid url parse here
      }
    }

    // 3. Return result
    return new Response(
      JSON.stringify({
        title: title.trim(),
        description: description.trim(),
        image: image,
        brand: brand.trim(),
        url: url
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
