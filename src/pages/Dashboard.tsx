import { useEffect } from "react";
import { SocialWishCard } from "@/components/dashboard/SocialWishCard";
import { AIRecommendationCard } from "@/components/dashboard/AIRecommendationCard";
import UpcomingEventsStack from "@/components/dashboard/UpcomingEventsStack";
import { LayoutDashboard } from "lucide-react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const Dashboard = () => {
  const { t } = useTranslation();

  // Show a toast for the latest unseen social activity (e.g. new follower, follow accepted)
  useEffect(() => {
    (async () => {
      try {
        const { data: auth } = await supabase.auth.getUser();
        const user = auth.user;
        if (!user) return;

        const { data, error } = await (supabase as any)
          .from("activities")
          .select("id, activity_type, created_at, target_id")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(1);
        if (error || !data || data.length === 0) return;

        const activity = data[0] as any;
        const storageKey = `wishly:lastSeenActivityId:${user.id}`;
        const lastSeenId = localStorage.getItem(storageKey);
        if (lastSeenId === activity.id) return;

        const type = String(activity.activity_type || "");
        let name = "";
        if (activity.target_id) {
           try {
             const { data: p } = await supabase.from("user_profiles").select("full_name, username").eq("id", activity.target_id).maybeSingle();
             if (p) name = (p as any).full_name || (p as any).username || "";
           } catch {}
        }
        let message: string | null = null;

        if (type === "new_follower") {
          message = name
            ? t("notifications.activity_new_follower", "You have a new follower") + ` · ${name}`
            : t("notifications.activity_new_follower", "You have a new follower");
        } else if (type === "follow_accepted") {
          message = name
            ? t("notifications.activity_follow_accepted", "Your follow request was accepted") + ` · ${name}`
            : t("notifications.activity_follow_accepted", "Your follow request was accepted");
        }

        if (message) {
          toast(message);
          localStorage.setItem(storageKey, activity.id as string);
        }
      } catch {
        // fail silently; dashboard should still load
      }
    })();
  }, [t]);
  return (
    <div className="container max-w-2xl mx-auto px-4 py-8 space-y-10">
      {/* Branded header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="relative inline-flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[hsl(var(--brand-cool-start))] via-[hsl(var(--brand-cool-end))] to-[hsl(var(--brand-warm-end))] shadow-[0_12px_30px_rgba(200,80,192,0.45)] ring-1 ring-white/40">
            <LayoutDashboard className="h-5 w-5 text-white drop-shadow" />
            <span className="absolute -inset-1 rounded-[14px] blur-md bg-gradient-to-br from-[#ffcc70]/20 to-[#c850c0]/10" aria-hidden="true" />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-[hsl(var(--brand-cool-start))] via-[hsl(var(--brand-cool-end))] to-[hsl(var(--brand-warm-end))] drop-shadow">{t('dashboard.title', 'Dashboard')}</h1>
            <p className="text-sm text-muted-foreground">{t('dashboard.subtitle', "Stay updated with your friends' wishes and upcoming events")}</p>
          </div>
        </div>
      </div>

      <section className="mt-4 mb-4 md:mb-6">
        <div className="rounded-3xl border border-border/40 bg-background/80 backdrop-blur-sm px-4 py-6 sm:px-6 sm:py-7 shadow-sm overflow-visible">
          <h2 className="text-sm font-semibold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-[hsl(var(--brand-cool-start))] via-[hsl(var(--brand-cool-end))] to-[hsl(var(--brand-warm-end))]">
            {t('dashboard.section_upcoming_events', 'Upcoming events')}
          </h2>
          <div className="mt-4">
            <UpcomingEventsStack />
          </div>
        </div>
      </section>

      <section className="mt-6 md:mt-8">
        <div className="rounded-3xl border border-border/40 bg-background/80 backdrop-blur-sm px-4 py-3 sm:px-5 sm:py-4 shadow-sm overflow-hidden">
          <h2 className="text-sm font-semibold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-[hsl(var(--brand-cool-start))] via-[hsl(var(--brand-cool-end))] to-[hsl(var(--brand-warm-end))]">
            {t('dashboard.section_wishlist_items', 'Wishlist items')}
          </h2>
          <div className="mt-3">
            <AIRecommendationCard />
          </div>
        </div>
      </section>

      <section className="mt-6 md:mt-10 lg:mt-16 mb-20 md:mb-24">
        <div className="rounded-3xl border border-border/40 bg-background/80 backdrop-blur-sm px-4 py-3 sm:px-5 sm:py-4 shadow-sm overflow-hidden">
          <h2 className="text-sm font-semibold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-[hsl(var(--brand-cool-start))] via-[hsl(var(--brand-cool-end))] to-[hsl(var(--brand-warm-end))]">
            {t('dashboard.section_friend_activity', 'Friend activity')}
          </h2>
          <div className="mt-6">
            <SocialWishCard />
          </div>
        </div>
      </section>
    </div>
  );
};

export default Dashboard;
