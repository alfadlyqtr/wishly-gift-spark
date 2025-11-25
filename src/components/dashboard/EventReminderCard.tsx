import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Gift, CalendarDays } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";

export const EventReminderCard = () => {
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const [countdown, setCountdown] = useState<{ days: number; hours: number; minutes: number } | null>(null);

  const { data } = useQuery({
    queryKey: ["dashboard", "next-event"],
    queryFn: async () => {
      if (!supabase) return null as any;
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth.user?.id;
      if (!uid) return null as any;
      const today = new Date().toISOString().slice(0, 10);
      const { data: rows } = await supabase
        .from("events")
        .select("id, title, event_date")
        .eq("user_id", uid)
        .gte("event_date", today)
        .order("event_date", { ascending: true })
        .limit(1);
      return (rows && rows[0]) || null;
    },
  });

  useEffect(() => {
    if (!data?.event_date) {
      setCountdown(null);
      return;
    }
    const target = new Date(data.event_date).getTime();
    if (Number.isNaN(target)) {
      setCountdown(null);
      return;
    }

    const update = () => {
      const now = Date.now();
      const diffMs = target - now;
      if (diffMs <= 0) {
        setCountdown({ days: 0, hours: 0, minutes: 0 });
        return;
      }
      const totalMinutes = Math.floor(diffMs / (1000 * 60));
      const days = Math.floor(totalMinutes / (60 * 24));
      const hours = Math.floor((totalMinutes - days * 24 * 60) / 60);
      const minutes = totalMinutes % 60;
      setCountdown({ days, hours, minutes });
    };

    update();
    const id = setInterval(update, 60_000);
    return () => clearInterval(id);
  }, [data?.event_date]);

  if (!data) {
    return (
      <Card className="overflow-hidden bg-white/80 backdrop-blur ring-1 ring-white/70">
        <CardContent className="p-5 flex items-center gap-3 text-muted-foreground">
          <CalendarDays className="h-5 w-5" />
          <span>{t('dashboard.no_upcoming_events', 'No upcoming events.')}</span>
        </CardContent>
      </Card>
    );
  }

  const countdownLabel = (() => {
    if (!countdown) return null;
    const { days, hours, minutes } = countdown;
    if (days === 0 && hours === 0 && minutes === 0) {
      return t('dashboard.countdown_today', 'Happening today');
    }
    return t('dashboard.countdown_full', '{{days}}d {{hours}}h {{minutes}}m left', { days, hours, minutes });
  })();

  const daysLeft = Math.ceil((new Date(data.event_date).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
  return (
    <Card className="overflow-hidden bg-gradient-to-br from-brand-cool-start to-brand-cool-end border-none text-white">
      <CardContent className="p-6 space-y-4">
        <div className="flex items-center gap-3">
          <Avatar className="h-12 w-12 border-2 border-white">
            <AvatarImage src="" />
            <AvatarFallback className="bg-primary text-primary-foreground">E</AvatarFallback>
          </Avatar>
          <div>
            <p className="font-semibold text-lg">
              {t('dashboard.next_event_title', '{{title}} in {{days}} days', {
                title: data.title || t('dashboard.event', 'Event'),
                days: daysLeft,
              })}
            </p>
            <p className="text-sm text-white/90">
              {countdownLabel || t('dashboard.next_event_date', 'Happening on {{date}}', {
                date:
                  new Date(data.event_date).toLocaleDateString(
                    i18n.language === 'ar' ? 'ar-EG' : undefined,
                    { year: 'numeric', month: '2-digit', day: '2-digit' }
                  ),
              })}
            </p>
          </div>
        </div>
        <div className="flex gap-3">
          <Button 
            onClick={() => navigate('/wishlists')}
            className="flex-1 bg-gradient-to-r from-brand-warm-start to-brand-warm-end border-none text-white hover:shadow-lg transition-all"
          >
            <Gift className="mr-2 h-4 w-4" />
            {t('dashboard.see_wishlists', 'See Wishlists')}
          </Button>
          <Button 
            variant="secondary" 
            className="flex-1 bg-white text-primary hover:bg-white/90"
          >
            {t('dashboard.start_group_gift', 'Start a Group Gift')}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
