import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Gift, CalendarDays } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useNavigate } from "react-router-dom";

export const EventReminderCard = () => {
  const navigate = useNavigate();
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

  if (!data) {
    return (
      <Card className="overflow-hidden bg-white/80 backdrop-blur ring-1 ring-white/70">
        <CardContent className="p-5 flex items-center gap-3 text-muted-foreground">
          <CalendarDays className="h-5 w-5" />
          <span>No upcoming events.</span>
        </CardContent>
      </Card>
    );
  }

  const daysLeft = Math.ceil((new Date(data.event_date).getTime() - new Date().getTime()) / (1000*60*60*24));
  return (
    <Card className="overflow-hidden bg-gradient-to-br from-brand-cool-start to-brand-cool-end border-none text-white">
      <CardContent className="p-6 space-y-4">
        <div className="flex items-center gap-3">
          <Avatar className="h-12 w-12 border-2 border-white">
            <AvatarImage src="" />
            <AvatarFallback className="bg-primary text-primary-foreground">E</AvatarFallback>
          </Avatar>
          <div>
            <p className="font-semibold text-lg">{data.title || 'Event'} in {daysLeft} days</p>
            <p className="text-sm text-white/90">Happening on {new Date(data.event_date).toLocaleDateString()}</p>
          </div>
        </div>
        <div className="flex gap-3">
          <Button 
            onClick={() => navigate('/wishlists')}
            className="flex-1 bg-gradient-to-r from-brand-warm-start to-brand-warm-end border-none text-white hover:shadow-lg transition-all"
          >
            <Gift className="mr-2 h-4 w-4" />
            See Wishlists
          </Button>
          <Button 
            variant="secondary" 
            className="flex-1 bg-white text-primary hover:bg-white/90"
          >
            Start a Group Gift
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
