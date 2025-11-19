
// Server-side short link with rich preview (OG tags) that redirects to the public wishlist page.
// Path: /w/:id -> this function responds with HTML including OG tags, then meta-refresh to the SPA page
// Configure env on Vercel:
// - SUPABASE_URL
// - SUPABASE_ANON_KEY (read-only)
// - PUBLIC_SITE_URL (e.g., https://wishly.qa)

const html = (
  {
    title,
    description,
    image,
    url,
    siteName,
    favicon,
  }: {
    title: string;
    description: string;
    image: string;
    url: string;
    siteName: string;
    favicon: string;
  }
) => `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />

    <title>${escapeHtml(title)}</title>
    <link rel="icon" href="${favicon}" sizes="any" />
    <link rel="apple-touch-icon" href="${favicon}" />

    <meta property="og:title" content="${escapeHtml(title)}" />
    <meta property="og:description" content="${escapeHtml(description)}" />
    <meta property="og:type" content="website" />
    <meta property="og:site_name" content="${escapeHtml(siteName)}" />
    <meta property="og:url" content="${escapeHtml(url)}" />
    <meta property="og:image" content="${escapeHtml(image)}" />

    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${escapeHtml(title)}" />
    <meta name="twitter:description" content="${escapeHtml(description)}" />
    <meta name="twitter:image" content="${escapeHtml(image)}" />

    <meta http-equiv="refresh" content="0;url=${escapeHtml(url)}" />
  </head>
  <body>
    <noscript>
      <a href="${escapeHtml(url)}">Open wishlist</a>
    </noscript>
  </body>
</html>`;

export default async function handler(req: any, res: any) {
  try {
    const { id } = req.query as { id?: string };
    if (!id) return res.status(400).send("Missing id");

    const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
    const supabaseAnon = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
    const publicSite = (process.env.PUBLIC_SITE_URL || process.env.VITE_PUBLIC_SITE_URL || (req.headers["x-forwarded-proto"] && req.headers.host ? `${req.headers["x-forwarded-proto"]}://${req.headers.host}` : "")) as string;

    const targetUrl = `${publicSite.replace(/\/$/, "")}/wishlist/${id}?mode=gifter`;
    const fallbackImage = `${publicSite.replace(/\/$/, "")}/favicon.ico`;
    const siteName = "Wishly";

    let ogTitle = "Wishlist";
    let ogDesc = "View this wishlist on Wishly";
    let ogImage = fallbackImage;

    if (supabaseUrl && supabaseAnon) {
      try {
        const endpoint = `${supabaseUrl.replace(/\/$/, "")}/rest/v1/wishlists?id=eq.${encodeURIComponent(
          id
        )}&select=title,owner:user_profiles(full_name,username)`;
        const r = await fetch(endpoint, {
          headers: {
            apikey: supabaseAnon,
            Authorization: `Bearer ${supabaseAnon}`,
            Accept: "application/json",
          },
        });
        if (r.ok) {
          const arr = (await r.json()) as any[];
          const row = Array.isArray(arr) && arr.length ? arr[0] : null;
          const title: string = row?.title || "Wishlist";
          const fullName: string | undefined = row?.owner?.full_name || row?.owner?.username;
          const owner = fullName ? fullName : "Someone";
          ogTitle = `${owner}'s Wishlist — ${title}`;
          ogDesc = `Check out ${owner}'s wishlist on Wishly`;
          // You can put a nicer banner under /public if desired, fallback to favicon for now
          ogImage = `${publicSite.replace(/\/$/, "")}/placeholder.svg`;
        }
      } catch {
        // Ignore and use fallback OG
      }
    }

    res.setHeader("Content-Type", "text/html; charset=utf-8");
    return res.status(200).send(
      html({
        title: ogTitle,
        description: ogDesc,
        image: ogImage,
        url: targetUrl,
        siteName,
        favicon: `${publicSite.replace(/\/$/, "")}/favicon.ico`,
      })
    );
  } catch (e) {
    return res.status(500).send("Server error");
  }
}

function escapeHtml(input: string) {
  return input
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
