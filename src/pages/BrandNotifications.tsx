import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Bell, Store, LayoutDashboard, Heart, Eye, Users } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

const BrandNotifications = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  // Step 1: Get brand ID (cached separately for reuse)
  const { data: brandId } = useQuery({
    queryKey: ["brand-id"],
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes - brand ID rarely changes
    queryFn: async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) return null;

      const { data: brand } = await (supabase as any)
        .from("brands")
        .select("id")
        .eq("user_id", auth.user.id)
        .maybeSingle();

      return brand?.id ?? null;
    },
  });

  // Step 2: Fetch analytics summary only when brandId is available
  // Uses the lightweight brand_analytics_summary RPC for better performance
  const { data, isLoading } = useQuery({
    queryKey: ["brand-notifications-summary", brandId],
    enabled: !!brandId, // Only run when brandId is available
    staleTime: 30 * 1000, // Cache for 30 seconds - analytics can be slightly stale
    queryFn: async () => {
      if (!brandId) return null;

      // Try the optimized summary function first
      const { data: summary, error: summaryError } = await (supabase as any).rpc(
        "brand_analytics_summary",
        { brand_uuid: brandId }
      );

      // If summary function exists and returns data, use it
      if (!summaryError && summary && summary.length > 0) {
        const row = summary[0];
        return {
          wishlistAdds: Number(row.total_wishlist_adds) || 0,
          totalViews: Number(row.total_views) || 0,
          uniqueUsers: Number(row.unique_users) || 0,
        };
      }

      // Fallback to full analytics function if summary not available
      const { data: analytics } = await (supabase as any).rpc(
        "brand_dashboard_analytics",
        { brand_uuid: brandId }
      );

      const rows = ((analytics || []) as any[]) as Array<{
        adds_count: number | null;
        views_count: number | null;
        liker_ids: string[] | null;
        viewer_ids: string[] | null;
      }>;

      let wishlistAdds = 0;
      let totalViews = 0;
      const userIdSet = new Set<string>();

      for (const row of rows) {
        wishlistAdds += row.adds_count ?? 0;
        totalViews += row.views_count ?? 0;
        (row.liker_ids || []).forEach((id) => id && userIdSet.add(id));
        (row.viewer_ids || []).forEach((id) => id && userIdSet.add(id));
      }

      return {
        wishlistAdds,
        totalViews,
        uniqueUsers: userIdSet.size,
      };
    },
  });

  const wishlistAdds = data?.wishlistAdds ?? 0;
  const totalViews = data?.totalViews ?? 0;
  const uniqueUsers = data?.uniqueUsers ?? 0;

  return (
    <div className="min-h-[calc(100vh-7rem)] pb-6 px-4 pt-5 sm:pt-6">
      <div className="mx-auto w-full max-w-3xl space-y-6">
        {/* Page header */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="relative inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-[hsl(var(--brand-cool-start))] via-[hsl(var(--brand-cool-end))] to-[hsl(var(--brand-warm-end))] shadow-[0_14px_32px_rgba(200,80,192,0.45)] ring-1 ring-white/60 overflow-hidden">
              <Bell className="h-5 w-5 text-white drop-shadow" />
              <span
                className="pointer-events-none absolute -inset-2 rounded-[20px] bg-gradient-to-br from-[#ffcc70]/25 via-[#ff758c]/18 to-[#c850c0]/20 blur-xl"
                aria-hidden="true"
              />
            </div>
            <div className="flex flex-col gap-0.5">
              <h1 className="text-2xl font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-[hsl(var(--brand-cool-start))] via-[hsl(var(--brand-cool-end))] to-[hsl(var(--brand-warm-end))] drop-shadow-[0_1px_1px_rgba(15,23,42,0.65)]">
                {t("brand.notifications.title", "Brand Notifications")}
              </h1>
              <p className="text-xs sm:text-sm text-slate-500">
                {t(
                  "brand.notifications.subtitle",
                  "All engagement and activity related to your brand will show up here."
                )}
              </p>
            </div>
          </div>
          <div className="hidden sm:flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="border-slate-200 bg-white/80 backdrop-blur-sm text-xs"
              onClick={() => navigate("/brand/dashboard")}
            >
              <LayoutDashboard className="mr-1.5 h-3.5 w-3.5" />
              {t("brand.notifications.back_to_dashboard", "Dashboard")}
            </Button>
          </div>
        </div>

        {/* Empty state / hero card */}
        <Card className="relative overflow-hidden border-none bg-gradient-to-br from-white/80 via-white/90 to-slate-50/95 shadow-[0_20px_60px_rgba(15,23,42,0.16)]">
          <span
            className="pointer-events-none absolute -right-24 top-[-40%] h-64 w-64 rounded-full bg-gradient-to-br from-[hsl(var(--brand-cool-start))]/25 via-[hsl(var(--brand-cool-end))]/18 to-[hsl(var(--brand-warm-end))]/24 blur-3xl"
            aria-hidden="true"
          />
          <span
            className="pointer-events-none absolute -left-10 bottom-[-35%] h-56 w-56 rounded-full bg-gradient-to-br from-[#22c55e]/15 via-[#0ea5e9]/12 to-[#6366f1]/10 blur-3xl"
            aria-hidden="true"
          />

          <CardHeader className="relative pb-4 sm:pb-6">
            <CardTitle className="flex items-center justify-between gap-3">
              <div className="flex flex-col gap-1">
                <span className="text-sm font-semibold uppercase tracking-[0.25em] text-slate-400">
                  {t("brand.notifications.pulse_label", "BRAND PULSE")}
                </span>
                <span className="text-lg sm:text-xl font-bold text-slate-900">
                  {t(
                    "brand.notifications.empty_title",
                    "You're all caught up – for now"
                  )}
                </span>
              </div>
              <div className="hidden sm:flex flex-col items-end gap-1 text-right">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-[11px] font-medium text-emerald-700 ring-1 ring-emerald-200/80">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  {t("brand.notifications.live_label", "Live brand activity")}
                </span>
                <span className="text-[11px] text-slate-500">
                  {t("brand.notifications.live_hint", "New wishlist and product events will surface here.")}
                </span>
              </div>
            </CardTitle>
          </CardHeader>

          <CardContent className="relative pb-6 sm:pb-7 flex flex-col gap-5 sm:gap-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="space-y-2 max-w-xl">
                <p className="text-sm text-slate-600">
                  {t(
                    "brand.notifications.empty_body",
                    "As your products get wishlisted, viewed, and loved, we'll surface the most important signals for your brand here."
                  )}
                </p>
                <p className="text-xs text-slate-500">
                  {t(
                    "brand.notifications.empty_body_secondary",
                    "Keep an eye on this feed to spot power users, rising products, and high-intent moments."
                  )}
                </p>
              </div>

              <div className="flex flex-col gap-2 min-w-[220px] max-w-xs">
                <Button
                  className="w-full justify-center bg-gradient-to-r from-[hsl(var(--brand-cool-start))] via-[hsl(var(--brand-cool-end))] to-[hsl(var(--brand-warm-end))] text-white shadow-[0_14px_30px_rgba(148,163,184,0.55)] hover:brightness-110"
                  size="sm"
                  onClick={() => navigate("/brand/products")}
                >
                  <Store className="mr-1.5 h-4 w-4" />
                  {t(
                    "brand.notifications.cta_add_products",
                    "Add or spotlight products"
                  )}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full justify-center border-slate-200 bg-white/80 text-xs text-slate-700 hover:bg-white"
                  onClick={() => navigate("/brand/dashboard")}
                >
                  {t(
                    "brand.notifications.cta_view_insights",
                    "Jump to brand insights dashboard"
                  )}
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <button
                type="button"
                onClick={() => navigate("/brand/dashboard")}
                className="group text-left rounded-2xl bg-white/90 backdrop-blur-xl ring-1 ring-white/80 shadow-[0_14px_28px_rgba(148,163,184,0.40)] px-3.5 py-3 flex flex-col gap-1.5 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[hsl(var(--brand-cool-start))] hover:shadow-[0_18px_38px_rgba(148,163,184,0.55)] hover:-translate-y-0.5 active:translate-y-0 transition-all duration-200 ease-out"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[10px] font-semibold tracking-wide text-slate-500">
                    {t("brand.notifications.mini_metric_1_label", "Wishlist activity")}
                  </span>
                  <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-gradient-to-br from-[hsl(var(--brand-cool-start))]/90 to-[hsl(var(--brand-cool-end))]/90 text-white shadow-[0_8px_18px_rgba(148,163,184,0.65)] group-hover:scale-105 transition-transform duration-200">
                    <Heart className="h-3.5 w-3.5" />
                  </span>
                </div>
                <span className="text-xl font-extrabold tracking-tight text-slate-900">
                  {isLoading
                    ? t("brand.notifications.loading", "Loading…")
                    : wishlistAdds.toLocaleString()}
                </span>
                <span className="text-[11px] text-slate-500">
                  {t(
                    "brand.notifications.mini_metric_1_hint",
                    "Total wishlist adds across all your products."
                  )}
                </span>
              </button>
              <button
                type="button"
                onClick={() => navigate("/brand/dashboard")}
                className="group text-left rounded-2xl bg-white/90 backdrop-blur-xl ring-1 ring-white/80 shadow-[0_14px_28px_rgba(148,163,184,0.40)] px-3.5 py-3 flex flex-col gap-1.5 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[hsl(var(--brand-cool-start))] hover:shadow-[0_18px_38px_rgba(148,163,184,0.55)] hover:-translate-y-0.5 active:translate-y-0 transition-all duration-200 ease-out"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[10px] font-semibold tracking-wide text-slate-500">
                    {t("brand.notifications.mini_metric_2_label", "Product views")}
                  </span>
                  <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-gradient-to-br from-[#22c55e] to-[#0ea5e9] text-white shadow-[0_8px_18px_rgba(45,212,191,0.65)] group-hover:scale-105 transition-transform duration-200">
                    <Eye className="h-3.5 w-3.5" />
                  </span>
                </div>
                <span className="text-xl font-extrabold tracking-tight text-slate-900">
                  {isLoading
                    ? t("brand.notifications.loading", "Loading…")
                    : totalViews.toLocaleString()}
                </span>
                <span className="text-[11px] text-slate-500">
                  {t(
                    "brand.notifications.mini_metric_2_hint",
                    "Lifetime views on your brand products."
                  )}
                </span>
              </button>
              <button
                type="button"
                onClick={() => navigate("/brand/followers")}
                className="group text-left rounded-2xl bg-white/90 backdrop-blur-xl ring-1 ring-white/80 shadow-[0_14px_28px_rgba(148,163,184,0.40)] px-3.5 py-3 flex flex-col gap-1.5 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[hsl(var(--brand-cool-start))] hover:shadow-[0_18px_38px_rgba(148,163,184,0.55)] hover:-translate-y-0.5 active:translate-y-0 transition-all duration-200 ease-out"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[10px] font-semibold tracking-wide text-slate-500">
                    {t("brand.notifications.mini_metric_3_label", "Fans & followers")}
                  </span>
                  <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-gradient-to-br from-[hsl(var(--brand-warm-start))] to-[hsl(var(--brand-warm-end))] text-white shadow-[0_8px_18px_rgba(248,113,113,0.65)] group-hover:scale-105 transition-transform duration-200">
                    <Users className="h-3.5 w-3.5" />
                  </span>
                </div>
                <span className="text-xl font-extrabold tracking-tight text-slate-900">
                  {isLoading
                    ? t("brand.notifications.loading", "Loading…")
                    : uniqueUsers.toLocaleString()}
                </span>
                <span className="text-[11px] text-slate-500">
                  {t(
                    "brand.notifications.mini_metric_3_hint",
                    "People who viewed or liked your products."
                  )}
                </span>
              </button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default BrandNotifications;
