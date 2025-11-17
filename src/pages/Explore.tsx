import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Store, Search, Filter, Users } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const Explore = () => {
  const { t } = useTranslation();
  const [mode, setMode] = useState<"brands" | "users">("brands");
  const [q, setQ] = useState("");
  const debouncedQ = useMemo(() => q.trim(), [q]);

  const usersQuery = useQuery({
    queryKey: ["explore", "users", debouncedQ],
    queryFn: async () => {
      const s = debouncedQ;
      if (!s) return [];
      // Try email + username + full_name; if email column doesn't exist, fallback
      try {
        const { data } = await (supabase as any)
          .from("user_profiles")
          .select("id, username, full_name, avatar_url")
          .eq("is_searchable", true)
          .or(`username.ilike.%${s}%,full_name.ilike.%${s}%,email.ilike.%${s}%`)
          .limit(20);
        return data ?? [];
      } catch {
        const { data } = await (supabase as any)
          .from("user_profiles")
          .select("id, username, full_name, avatar_url")
          .eq("is_searchable", true)
          .or(`username.ilike.%${s}%,full_name.ilike.%${s}%`)
          .limit(20);
        return data ?? [];
      }
    },
    enabled: mode === "users" && debouncedQ.length > 0,
  });

  const brandsQuery = useQuery({
    queryKey: ["explore", "brands", debouncedQ],
    queryFn: async () => {
      const s = debouncedQ;
      if (!s) return [];
      const { data } = await (supabase as any)
        .from("wishlists")
        .select("id, title, description")
        .eq("privacy_level", "public")
        .or(`title.ilike.%${s}%,description.ilike.%${s}%`)
        .limit(20);
      return data ?? [];
    },
    enabled: mode === "brands" && debouncedQ.length > 0,
  });

  return (
    <div className="container max-w-2xl mx-auto px-4 py-6 space-y-6">
      {/* Header like Events */}
      <div className="mt-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="relative inline-flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[hsl(var(--brand-cool-start))] via-[hsl(var(--brand-cool-end))] to-[hsl(var(--brand-warm-end))] shadow-[0_12px_30px_rgba(200,80,192,0.45)] ring-1 ring-white/40">
              <Store className="h-5 w-5 text-white drop-shadow" />
              <span className="absolute -inset-1 rounded-[14px] blur-md bg-gradient-to-br from-[#ffcc70]/20 to-[#c850c0]/10" aria-hidden="true" />
            </div>
            <h2 className="text-2xl font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-[hsl(var(--brand-cool-start))] via-[hsl(var(--brand-cool-end))] to-[hsl(var(--brand-warm-end))] drop-shadow">
              {t('explore.title', 'Explore')}
            </h2>
          </div>
          <p className="hidden sm:block text-muted-foreground max-w-xs text-right leading-snug">
            {t('explore.subtitle', 'Discover trending gifts, popular wishlists, and amazing products curated just for you.')}
          </p>
        </div>
        <p className="sm:hidden mt-2 text-muted-foreground">
          {t('explore.subtitle', 'Discover trending gifts, popular wishlists, and amazing products curated just for you.')}
        </p>
      </div>

      {/* Search bar */}
      <div className="mx-auto w-full max-w-md">
        <div className="rounded-[14px] p-[2px] bg-gradient-to-r from-[hsl(var(--brand-cool-start))] via-[hsl(var(--brand-cool-end))] to-[hsl(var(--brand-warm-end))] shadow-[0_12px_28px_rgba(200,80,192,0.18)]">
          <div className="relative rounded-[12px] bg-white shadow-sm">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 inline-flex h-8 w-8 items-center justify-center rounded-full bg-white text-[hsl(var(--brand-cool-start))] shadow-[0_3px_8px_rgba(65,88,208,0.18)]">
              <Search className="h-4.5 w-4.5" />
            </span>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={mode === "brands" ? t('explore.search_placeholder_brands', 'Search brands, stores, products') : t('explore.search_placeholder_users', 'Search users')}
              aria-label={t('explore.search_aria', 'Search')}
              className="h-12 w-full rounded-[12px] border-0 pl-12 pr-12 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
            />
            <button
              type="button"
              className="absolute right-2 top-1/2 -translate-y-1/2 inline-flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-[hsl(var(--brand-cool-start))] via-[hsl(var(--brand-cool-end))] to-[hsl(var(--brand-warm-end))] text-white shadow-[0_8px_18px_rgba(200,80,192,0.28)]"
              aria-label="Filters"
            >
              <Filter className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Toggle - clean segmented control */}
      <div className="mx-auto w-full max-w-md">
        <div className="relative mx-auto mt-2 rounded-full p-[2px] bg-gradient-to-r from-[hsl(var(--brand-cool-start))] via-[hsl(var(--brand-cool-end))] to-[hsl(var(--brand-warm-end))] shadow-[0_12px_28px_rgba(0,0,0,0.10)]">
          <div className="relative flex items-center rounded-full bg-white/70 backdrop-blur px-1 py-1 ring-1 ring-white/70 shadow-[inset_0_1px_3px_rgba(255,255,255,0.55),_0_6px_14px_rgba(0,0,0,0.06)] overflow-hidden">
            <span className="pointer-events-none absolute inset-x-6 -top-1 h-5 rounded-full bg-white/60 blur-md opacity-60" />
            {/* Sliding glass highlight */}
            <span
              className="pointer-events-none absolute top-1 bottom-1 w-1/2 rounded-full p-[1px] bg-gradient-to-r from-[hsl(var(--brand-cool-start))]/40 via-[hsl(var(--brand-cool-end))]/35 to-[hsl(var(--brand-warm-end))]/40 shadow-[0_6px_16px_rgba(200,80,192,0.14)] transition-all duration-300 ease-out z-0"
              style={{ left: mode === 'users' ? 'calc(50% + 0px)' : '0px' }}
            >
              <span className="absolute inset-0 rounded-full ring-1 ring-white/60" />
              <span className="relative block h-full w-full rounded-full bg-white/20 backdrop-blur-[2px] shadow-[inset_0_1px_3px_rgba(255,255,255,0.6),_0_4px_10px_rgba(0,0,0,0.06)]" />
            </span>
          <button
            type="button"
            onClick={() => setMode('brands')}
            className={`relative z-10 flex-1 rounded-full px-4 py-2 text-xs font-semibold transition-colors duration-200 flex items-center justify-center gap-1 ${
              mode === 'brands' ? 'text-foreground' : 'text-muted-foreground'
            }`}
            aria-pressed={mode === 'brands'}
          >
            <Store className="h-4 w-4" />
            <span>{t('explore.segment_brands', 'Brands/Stores')}</span>
          </button>
          <button
            type="button"
            onClick={() => setMode('users')}
            className={`relative z-10 flex-1 rounded-full px-4 py-2 text-xs font-semibold transition-colors duration-200 flex items-center justify-center gap-1 ${
              mode === 'users' ? 'text-foreground' : 'text-muted-foreground'
            }`}
            aria-pressed={mode === 'users'}
          >
            <Users className="h-4 w-4" />
            <span>{t('explore.segment_users', 'Users')}</span>
          </button>
          </div>
        </div>
      </div>

      {/* Placeholder body for this stage */}
      <div className="mx-auto w-full max-w-md space-y-3">
        {mode === "brands" ? (
          debouncedQ.length === 0 ? (
            <div className="rounded-2xl bg-white/70 backdrop-blur ring-1 ring-white/70 shadow-[0_18px_40px_rgba(0,0,0,0.06)] p-4 text-sm text-muted-foreground">{t('explore.empty_brands', 'Search brands, stores, or products.')}</div>
          ) : brandsQuery.isLoading ? (
            <div className="flex items-center justify-center py-10"><div className="loader"><span className="text">{t('explore.loading', 'Loading')}</span></div></div>
          ) : (brandsQuery.data?.length ?? 0) === 0 ? (
            <div className="rounded-2xl bg-white/70 backdrop-blur ring-1 ring-white/70 shadow-[0_18px_40px_rgba(0,0,0,0.06)] p-4 text-sm text-muted-foreground">{t('explore.no_results', 'No results.')}</div>
          ) : (
            <div className="space-y-3">
              {brandsQuery.data!.map((w: any) => (
                <div key={w.id} className="rounded-2xl bg-white/80 backdrop-blur ring-1 ring-white/70 shadow-[0_18px_40px_rgba(0,0,0,0.06)] p-4">
                  <div className="font-medium truncate">{w.title || "Untitled"}</div>
                  {w.description && <div className="text-sm text-muted-foreground line-clamp-2">{w.description}</div>}
                </div>
              ))}
            </div>
          )
        ) : (
          debouncedQ.length === 0 ? (
            <div className="rounded-2xl bg-white/70 backdrop-blur ring-1 ring-white/70 shadow-[0_18px_40px_rgba(0,0,0,0.06)] p-4 text-sm text-muted-foreground">{t('explore.empty_users', 'Type a name, username, or email to search users.')}</div>
          ) : usersQuery.isLoading ? (
            <div className="flex items-center justify-center py-10"><div className="loader"><span className="text">Loading</span></div></div>
          ) : (usersQuery.data?.length ?? 0) === 0 ? (
            <div className="rounded-2xl bg-white/70 backdrop-blur ring-1 ring-white/70 shadow-[0_18px_40px_rgba(0,0,0,0.06)] p-4 text-sm text-muted-foreground">No results.</div>
          ) : (
            <div className="space-y-3">
              {usersQuery.data!.map((u: any) => (
                <div key={u.id} className="flex items-center gap-3 rounded-2xl bg-white/80 backdrop-blur ring-1 ring-white/70 shadow-[0_18px_40px_rgba(0,0,0,0.06)] p-4">
                  <div className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-[hsl(var(--brand-cool-start))] via-[hsl(var(--brand-cool-end))] to-[hsl(var(--brand-warm-end))] text-white ring-1 ring-white/60 shadow-[0_6px_14px_rgba(200,80,192,0.28)]">
                    <Users className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="font-medium truncate">{u.full_name || u.username || "User"}</div>
                    {u.username && <div className="text-sm text-muted-foreground">@{u.username}</div>}
                  </div>
                </div>
              ))}
            </div>
          )
        )}
      </div>
    </div>
  );
};

export default Explore;
