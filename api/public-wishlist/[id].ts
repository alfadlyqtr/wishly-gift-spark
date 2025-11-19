export default async function handler(req: any, res: any) {
  try {
    const { id } = req.query as { id?: string };
    if (!id) return res.status(400).json({ error: 'missing id' });

    const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
    const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const publicKey =
      process.env.SUPABASE_ANON_KEY ||
      process.env.VITE_SUPABASE_ANON_KEY ||
      process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
    const key = serviceRole || publicKey;
    if (!supabaseUrl || !key) return res.status(200).json({ owner: {} });

    const base = supabaseUrl.replace(/\/$/, '');
    // Step 1: get wishlist to read user_id
    const wlResp = await fetch(`${base}/rest/v1/wishlists?id=eq.${encodeURIComponent(id)}&select=user_id`, {
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        Accept: 'application/json',
      },
    });
    if (!wlResp.ok) return res.status(200).json({ owner: {} });
    const wlArr = (await wlResp.json()) as any[];
    const userId = Array.isArray(wlArr) && wlArr[0]?.user_id ? wlArr[0].user_id : null;
    if (!userId) return res.status(200).json({ owner: {} });

    // Step 2: read public profile fields by id
    const profResp = await fetch(
      `${base}/rest/v1/user_profiles?id=eq.${encodeURIComponent(userId)}&select=full_name,username,avatar_url,allow_friends_claim,show_countdown_timer`,
      {
        headers: {
          apikey: key,
          Authorization: `Bearer ${key}`,
          Accept: 'application/json',
        },
      }
    );
    if (!profResp.ok) return res.status(200).json({ owner: {} });
    const profArr = (await profResp.json()) as any[];
    const owner = Array.isArray(profArr) && profArr[0] ? profArr[0] : {};
    return res.status(200).json({ owner });
  } catch (e) {
    return res.status(200).json({ owner: {} });
  }
}
