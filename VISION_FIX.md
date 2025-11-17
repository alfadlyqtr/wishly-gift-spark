# Fix Google Vision API Key Restrictions

## Problem
Your Vision API key has "HTTP referrers" restriction enabled, which blocks server-to-server calls from Supabase Edge Functions.

## Solution (Choose One)

### Option 1: Remove Referrer Restrictions (Quick Fix)
1. Go to: https://console.cloud.google.com/apis/credentials
2. Click your Vision API key
3. Under "Application restrictions":
   - Change from "HTTP referrers" to **"None"**
4. Under "API restrictions":
   - Keep "Restrict key"
   - Select only **"Cloud Vision API"**
5. Click **Save**
6. Wait 5 minutes for propagation
7. Test extraction again

### Option 2: Use Service Account (More Secure)
I can switch the Edge Function to use a Vision service account with OAuth instead of an API key.

Steps:
1. Create a service account in Google Cloud
2. Grant "Cloud Vision API User" role
3. Download JSON key
4. Add to Supabase secrets as GOOGLE_VISION_SERVICE_ACCOUNT
5. I'll update the function to use OAuth

## After Fix
- Refresh app
- Try "Extract details with AI"
- Should see title/brand/description filled from Vision + Deepseek
- Toast will show "Extracted details from image"

## Current Status
- Frontend: ✅ Calling extract-from-image correctly
- Edge Function: ✅ Deployed and active
- Vision API: ❌ Blocked by referrer restrictions
