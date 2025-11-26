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

      // Get likes on user's wishlists (we need wishlist_id + created_at to know which list was liked)
      const { data: likes } = await supabase
        .from("wishlist_likes" as any)
        .select("id, wishlist_id, created_at")
        .in("wishlist_id", wishlistIds)
        .neq("user_id", uid)
        .order("created_at", { ascending: false })
        .limit(20);

      // Get comments on user's wishlists (count only)
      const { data: comments } = await supabase
        .from("wishlist_comments" as any)
        .select("id")
        .in("wishlist_id", wishlistIds)
        .neq("user_id", uid);

      const likesCount = likes?.length || 0;

      // Determine which wishlist was most recently liked
      let latestLikedTitle: string | null = null;
      if (likes && likes.length > 0) {
        const latest = likes[0] as any;
        const wl = (wishlists as any[]).find((w) => w.id === latest.wishlist_id);
        latestLikedTitle = (wl && wl.title) || null;
      }

      return {
        likesCount,
        commentsCount: comments?.length || 0,
        latestLikedTitle,
      } as { likesCount: number; commentsCount: number; latestLikedTitle: string | null };
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg font-semibold">
          {t("dashboard.recent_activity_title", "Your recent activity")}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {!data ? (
          <div className="text-sm text-muted-foreground text-center py-4">
            {t("dashboard.no_recent_activity", "No recent activity on your wishlists yet")}
          </div>
        ) : (
          <>
            <div className="flex items-center gap-2 text-sm">
              <Heart className="h-4 w-4 text-[#be123c] fill-[#be123c]" />
              <span className="font-semibold">{data.likesCount}</span>
              <span className="text-muted-foreground">
                {data.likesCount === 0
                  ? t("dashboard.activity_likes_count", "likes on your wishlists")
                  : data.likesCount === 1 && data.latestLikedTitle
                    ? t(
                        "dashboard.activity_likes_single",
                        "like on {{title}}",
                        { title: data.latestLikedTitle }
                      )
                    : t("dashboard.activity_likes_count", "likes on your wishlists")}
              </span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <MessageCircle className="h-4 w-4 text-blue-600" />
              <span className="font-semibold">{data.commentsCount}</span>
              <span className="text-muted-foreground">
                {t("dashboard.activity_comments_count", "comments on your wishlists")}
              </span>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
};
