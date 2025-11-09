// supabase/functions/ai-gateway/index.ts
// This function is a secure proxy for the DeepSeek API key.

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
    // 1. Get the user's request body (e.g., the prompt, the URL to scrape)
    const body = await req.json();

    // 2. Validate API key
    if (!DEEPSEEK_API_KEY) {
      throw new Error('DeepSeek API key is not set in project secrets.');
    }

    // 3. Forward the request to DeepSeek, adding the secret API key.
    // We are acting as a secure proxy.
    const deepseekResponse = await fetch(DEEPSEEK_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${DEEPSEEK_API_KEY}`,
      },
      body: JSON.stringify(body), // Pass the user's request body directly
    });

    if (!deepseekResponse.ok) {
      const errorBody = await deepseekResponse.text();
      console.error('DeepSeek API Error:', errorBody);
      throw new Error(`DeepSeek API error: ${deepseekResponse.status}`);
    }

    // 4. Stream the response back to the user's browser.
    // This allows for the "live typing" effect from the AI.
    return new Response(deepseekResponse.body, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/event-stream',
      },
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
