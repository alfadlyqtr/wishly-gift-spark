export default async function handler(req: any, res: any) {
  try {
    const { id } = req.query as { id?: string };
    if (!id) return res.status(400).json({ error: 'missing id' });

    const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
    const supabaseAnon = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
    if (!supabaseUrl || !supabaseAnon) return res.status(200).json({ owner: {} });

    // Fetch wishlist with joined owner profile (public, read-only via anon key).
    const endpoint = `${supabaseUrl.replace(/\/$/, '')}/rest/v1/wishlists?id=eq.${encodeURIComponent(
      id
    )}&select=owner:user_profiles(full_name,username,avatar_url,allow_friends_claim,show_countdown_timer)`;
    const r = await fetch(endpoint, {
      headers: {
        apikey: supabaseAnon,
        Authorization: `Bearer ${supabaseAnon}`,
        Accept: 'application/json',
      },
    });

    if (!r.ok) return res.status(200).json({ owner: {} });
    const arr = (await r.json()) as any[];
    const owner = arr && arr[0] && arr[0].owner ? arr[0].owner : {};
    return res.status(200).json({ owner });
  } catch (e) {
    return res.status(200).json({ owner: {} });
  }
}
