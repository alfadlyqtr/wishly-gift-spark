import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import WishlistStack, { WishlistCard } from "@/components/wishes/WishlistStack";

const todayISO = () => new Date().toISOString().slice(0, 10);

function useUpcomingEvents() {
  // Same base logic as useMyEvents in Events.tsx, but limited to
  // upcoming (event_date in the future) and max 5 entries.
  return useQuery({
    queryKey: ["dashboard", "upcoming-events"],
    queryFn: async () => {
      if (!supabase) return [] as { id: string; title: string | null; event_date: string | null }[];

      const { data: auth } = await supabase.auth.getUser();
      const user = auth.user;
      if (!user) return [] as { id: string; title: string | null; event_date: string | null }[];

      const { data, error } = await supabase
        .from("wishlists")
        .select("id, title, event_date, user_id, privacy_level, description")
        .eq("user_id", user.id)
        .not("event_date", "is", null)
        .order("event_date", { ascending: true });

      if (error) return [] as { id: string; title: string | null; event_date: string | null }[];
      return (data ?? []).map((row: any) => ({
        id: row.id as string,
        title: row.title as string | null,
        event_date: row.event_date as string | null,
      }));
    },
    staleTime: 60_000,
  });
}

function formatCountdown(eventDate: string | null, t: (k: string, d: string, vars?: any) => string) {
  if (!eventDate) return "";
  const target = new Date(eventDate).getTime();
  if (Number.isNaN(target)) return "";
  const now = Date.now();
  const diffMs = target - now;
  const days = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  if (days <= 0) return t("dashboard.countdown_today", "Happening today");
  if (days === 1) return t("dashboard.countdown_one_day", "1 day left");
  return t("dashboard.countdown_days", "{{days}} days left", { days });
}

export const UpcomingEventsStack = () => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { data, isLoading } = useUpcomingEvents();

  const cards: WishlistCard[] = useMemo(() => {
    if (!data || data.length === 0) return [];
    return data.map((row) => {
      const dateLabel = row.event_date
        ? new Date(row.event_date).toLocaleDateString(i18n.language === "ar" ? "ar-EG" : undefined, {
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
          })
        : "";
      const countdown = formatCountdown(row.event_date, t as any);
      const subtitle = [dateLabel, countdown].filter(Boolean).join(" • ");
      return {
        id: row.id,
        title: row.title || t("dashboard.event", "Event"),
        subtitle,
      };
    });
  }, [data, i18n.language, t]);

  if (isLoading) {
    return null;
  }

  if (!cards.length) {
    return (
      <Card className="border-none bg-transparent shadow-none">
        <CardContent className="p-4 flex items-center justify-between gap-4 rounded-2xl bg-muted/40">
          <div>
            <p className="text-sm font-semibold">
              {t("dashboard.no_upcoming_events", "No upcoming events.")}
            </p>
            <p className="text-xs text-muted-foreground">
              {t(
                "dashboard.no_upcoming_events_subtitle",
                "Create an event or add a date to a wishlist to see it here.",
              )}
            </p>
          </div>
          <button
            type="button"
            onClick={() => navigate("/events")}
            className="text-xs font-semibold rounded-full px-3 py-1 bg-primary text-primary-foreground shadow"
          >
            {t("dashboard.create_first_event", "Create your first event")}
          </button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-none bg-transparent shadow-none overflow-visible">
      <CardContent className="p-0 flex justify-center overflow-visible">
        <WishlistStack
          viewerMode
          sensitivity={220}
          cardDimensions={{ width: 280, height: 170 }}
          cards={cards}
          className="-translate-x-2"
          onCardOpen={() => navigate("/events")}
        />
      </CardContent>
    </Card>
  );
};

export default UpcomingEventsStack;
