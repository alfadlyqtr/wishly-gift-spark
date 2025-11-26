import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Heart, MessageCircle } from "lucide-react";
import { useTranslation } from "react-i18next";
import { formatDistanceToNow } from "date-fns";

export const RecentActivityCard = () => {
  const { t } = useTranslation();

  const { data } = useQuery({
    queryKey: ["dashboard", "recent-activity"],
    queryFn: async () => {
      if (!supabase) return null;
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth.user?.id;
      if (!uid) return null;

      // Get user's wishlists
      const { data: wishlists } = await supabase
        .from("wishlists")
        .select("id, title")
        .eq("user_id", uid);

      if (!wishlists || wishlists.length === 0) return null;

      const wishlistIds = wishlists.map((w: any) => w.id);

      // Get recent likes on user's wishlists
      const { data: likes } = await supabase
        .from("wishlist_likes" as any)
        .select("id, user_id, wishlist_id, created_at, user_profiles(id, username, full_name, avatar_url)")
        .in("wishlist_id", wishlistIds)
        .neq("user_id", uid) // Exclude self-likes
        .order("created_at", { ascending: false })
        .limit(5);

      // Get recent comments on user's wishlists
      const { data: comments } = await supabase
        .from("wishlist_comments" as any)
        .select("id, user_id, wishlist_id, content, created_at, user_profiles(id, username, full_name, avatar_url)")
        .in("wishlist_id", wishlistIds)
        .neq("user_id", uid) // Exclude self-comments
        .order("created_at", { ascending: false })
        .limit(5);

      // Combine and sort by created_at
      const likeActivities = (likes || []).map((l: any) => ({
        type: "like",
        id: l.id,
        user_id: l.user_id,
        wishlist_id: l.wishlist_id,
        created_at: l.created_at,
        profile: l.user_profiles,
        wishlist_title: wishlists.find((w: any) => w.id === l.wishlist_id)?.title || "Wishlist",
      }));

      const commentActivities = (comments || []).map((c: any) => ({
        type: "comment",
        id: c.id,
        user_id: c.user_id,
        wishlist_id: c.wishlist_id,
        content: c.content,
        created_at: c.created_at,
        profile: c.user_profiles,
        wishlist_title: wishlists.find((w: any) => w.id === c.wishlist_id)?.title || "Wishlist",
      }));

      const allActivities = [...likeActivities, ...commentActivities].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );

      return allActivities.slice(0, 10);
    },
  });

  if (!data || data.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg font-semibold">
          {t("dashboard.recent_activity_title", "Your recent activity")}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {data.map((activity: any) => {
          const prof = activity.profile;
          const name = prof?.full_name || prof?.username || "User";
          const timeAgo = formatDistanceToNow(new Date(activity.created_at), { addSuffix: true });

          return (
            <div key={`${activity.type}-${activity.id}`} className="flex items-start gap-3 text-sm">
              <Avatar className="h-9 w-9 mt-0.5">
                <AvatarImage src={prof?.avatar_url || ""} />
                <AvatarFallback className="text-xs bg-gradient-to-br from-[hsl(var(--brand-cool-start))] via-[hsl(var(--brand-cool-end))] to-[hsl(var(--brand-warm-end))] text-white">
                  {name.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  {activity.type === "like" ? (
                    <Heart className="h-4 w-4 text-[#be123c] fill-[#be123c]" />
                  ) : (
                    <MessageCircle className="h-4 w-4 text-blue-600" />
                  )}
                  <span className="font-semibold truncate">{name}</span>
                  <span className="text-muted-foreground">
                    {activity.type === "like"
                      ? t("dashboard.activity_liked", "liked")
                      : t("dashboard.activity_commented", "commented on")}
                  </span>
                </div>
                <div className="text-xs text-muted-foreground truncate mt-0.5">
                  {activity.wishlist_title}
                </div>
                {activity.type === "comment" && activity.content && (
                  <div className="text-sm text-foreground mt-1 line-clamp-2">"{activity.content}"</div>
                )}
                <div className="text-xs text-muted-foreground mt-1">{timeAgo}</div>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
};
