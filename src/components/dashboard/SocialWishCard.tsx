import { useEffect } from "react";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Heart, Repeat2, MessageCircle, Users } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useTranslation } from "react-i18next";

export const SocialWishCard = () => {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const { data } = useQuery({
    queryKey: ["dashboard", "social"],
    queryFn: async () => {
      if (!supabase) return null as any;
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth.user?.id;
      if (!uid) return null as any;
      const { data: follows } = await supabase
        .from("followers")
        .select("following_id")
        .eq("user_id", uid);
      const ids = (follows || []).map((f: any) => f.following_id);
      if (ids.length === 0) return [] as any[];
      const { data: items } = await supabase
        .from("wishlist_items")
        .select("id, title, image_url, created_at, wishlists(id, title, user_profiles(id, username, full_name, avatar_url))")
        .in("wishlists.user_id", ids as any)
        .order("created_at", { ascending: false })
        .limit(3);
      return items || [];
    },
  });

  useEffect(() => {
    if (!supabase) return;

    const channel = (supabase as any)
      .channel("dashboard-social-wishes")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "wishlist_items" },
        () => {
          queryClient.invalidateQueries({ queryKey: ["dashboard", "social"] });
        },
      )
      .subscribe();

    return () => {
      try {
        (supabase as any).removeChannel(channel);
      } catch {
        // ignore cleanup errors
      }
    };
  }, [queryClient]);

  if (!data || (data as any[]).length === 0) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-3">
            <div className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-[hsl(var(--brand-cool-start))] via-[hsl(var(--brand-cool-end))] to-[hsl(var(--brand-warm-end))] text-white ring-1 ring-white/60">
              <Users className="h-4 w-4" />
            </div>
            <div>
              <p className="font-semibold">{t('dashboard.no_recent_activity_title', 'No recent activity')}</p>
              <p className="text-sm text-muted-foreground">{t('dashboard.no_recent_activity_subtitle', 'Follow friends to see their latest wishes')}</p>
            </div>
          </div>
        </CardHeader>
      </Card>
    );
  }

  const owner = (data as any[])[0].wishlists?.user_profiles;
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-3">
          <Avatar className="h-10 w-10">
            <AvatarImage src={owner?.avatar_url || ""} />
            <AvatarFallback className="bg-primary text-primary-foreground">{(owner?.full_name || owner?.username || 'U').charAt(0)}</AvatarFallback>
          </Avatar>
          <div>
            <p className="font-semibold">{owner?.full_name || owner?.username || 'User'}</p>
            <p className="text-sm text-muted-foreground">{t('dashboard.added_wishes', 'Added {{count}} wishes', { count: (data as any[]).length })}</p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pb-3">
        <div className="grid grid-cols-3 gap-3">
          {(data as any[]).map((wish: any) => (
            <div key={wish.id} className="aspect-square rounded-lg bg-muted flex items-center justify-center overflow-hidden">
              {wish.image_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={wish.image_url} alt={wish.title} className="h-full w-full object-cover" />
              ) : (
                <span className="text-2xl" aria-hidden>🎁</span>
              )}
            </div>
          ))}
        </div>
      </CardContent>
      <CardFooter className="flex justify-around border-t pt-3">
        <Button variant="ghost" size="sm" className="flex items-center gap-2">
          <Heart className="h-4 w-4" />
          <span className="text-sm">{t('dashboard.action_like', 'Like')}</span>
        </Button>
        <Button variant="ghost" size="sm" className="flex items-center gap-2">
          <Repeat2 className="h-4 w-4" />
          <span className="text-sm">{t('dashboard.action_share', 'Share')}</span>
        </Button>
        <Button variant="ghost" size="sm" className="flex items-center gap-2">
          <MessageCircle className="h-4 w-4" />
          <span className="text-sm">{t('dashboard.action_comment', 'Comment')}</span>
        </Button>
      </CardFooter>
    </Card>
  );
};
