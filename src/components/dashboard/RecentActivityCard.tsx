import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MentionInput } from "@/components/ui/MentionInput";
import { Heart, MessageCircle } from "lucide-react";
import { useTranslation } from "react-i18next";
import { formatDistanceToNow } from "date-fns";
import { ar, enUS } from "date-fns/locale";

type WishlistWithStats = {
  id: string;
  title: string;
  likesCount: number;
  commentsCount: number;
  latestActivityAt: string | null;
};

type RecentActivityData = {
  wishlists: WishlistWithStats[];
  defaultActiveId: string | null;
};

export const RecentActivityCard = () => {
  const { t, i18n } = useTranslation();
  const dateLocale = i18n.language === 'ar' ? ar : enUS;
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [activeWishlistId, setActiveWishlistId] = useState<string | null>(null);
  const [commentText, setCommentText] = useState("");

  const { data } = useQuery<RecentActivityData | null>({
    queryKey: ["dashboard", "recent-activity", "per-wishlist"],
    queryFn: async () => {
      if (!supabase) return null;
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth.user?.id;
      if (!uid) return null;

      const { data: wishlists } = await supabase
        .from("wishlists")
        .select("id, title")
        .eq("user_id", uid);

      if (!wishlists || wishlists.length === 0) return null;

      const wishlistIds = wishlists.map((w: any) => w.id);

      const { data: likes } = await supabase
        .from("wishlist_likes" as any)
        .select("id, wishlist_id, created_at")
        .in("wishlist_id", wishlistIds)
        .neq("user_id", uid)
        .order("created_at", { ascending: false })
        .limit(100);

      const { data: comments } = await supabase
        .from("wishlist_comments" as any)
        .select("id, wishlist_id, created_at")
        .in("wishlist_id", wishlistIds)
        .neq("user_id", uid)
        .order("created_at", { ascending: false })
        .limit(100);

      const likesList = likes || [];
      const commentsList = comments || [];

      const byWishlist: Record<string, WishlistWithStats> = {};
      for (const w of wishlists as any[]) {
        byWishlist[w.id] = {
          id: w.id,
          title: w.title || t("events.untitled", "Untitled"),
          likesCount: 0,
          commentsCount: 0,
          latestActivityAt: null,
        };
      }

      const updateLatest = (wishlistId: string, createdAt: string | null) => {
        if (!createdAt) return;
        const entry = byWishlist[wishlistId];
        if (!entry) return;
        if (!entry.latestActivityAt) {
          entry.latestActivityAt = createdAt;
          return;
        }
        if (new Date(createdAt).getTime() > new Date(entry.latestActivityAt).getTime()) {
          entry.latestActivityAt = createdAt;
        }
      };

      for (const like of likesList as any[]) {
        const wlId = like.wishlist_id as string;
        const entry = byWishlist[wlId];
        if (!entry) continue;
        entry.likesCount += 1;
        updateLatest(wlId, like.created_at as string);
      }

      for (const comment of commentsList as any[]) {
        const wlId = comment.wishlist_id as string;
        const entry = byWishlist[wlId];
        if (!entry) continue;
        entry.commentsCount += 1;
        updateLatest(wlId, comment.created_at as string);
      }

      const wishlistsWithStats = Object.values(byWishlist);
      wishlistsWithStats.sort((a, b) => {
        const aTime = a.latestActivityAt ? new Date(a.latestActivityAt).getTime() : 0;
        const bTime = b.latestActivityAt ? new Date(b.latestActivityAt).getTime() : 0;
        return bTime - aTime;
      });

      const defaultActiveId =
        wishlistsWithStats.find((w) => w.latestActivityAt) ?.id ||
        (wishlistsWithStats[0] ? wishlistsWithStats[0].id : null);

      return {
        wishlists: wishlistsWithStats,
        defaultActiveId,
      };
    },
  });

  useEffect(() => {
    if (!data) return;
    if (!activeWishlistId && data.defaultActiveId) {
      setActiveWishlistId(data.defaultActiveId);
    }
  }, [data, activeWishlistId]);

  const activeWishlist =
    data?.wishlists.find((w) => w.id === activeWishlistId) ||
    (data?.wishlists && data.wishlists.length > 0 ? data.wishlists[0] : null);

  const {
    data: commentsData = [],
    isLoading: commentsLoading,
  } = useQuery({
    queryKey: ["dashboard", "recent-activity", "comments", activeWishlist?.id],
    enabled: !!supabase && !!activeWishlist?.id,
    queryFn: async () => {
      if (!supabase || !activeWishlist?.id) return [] as any[];
      const wishlistId = activeWishlist.id;
      const { data, error } = await supabase
        .from("wishlist_comments" as any)
        .select("id, content, created_at, user_id")
        .eq("wishlist_id", wishlistId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      const rows = data || [];

      const userIds = Array.from(
        new Set(rows.map((r: any) => r.user_id).filter(Boolean)),
      );
      if (userIds.length === 0) return rows as any[];

      const { data: profiles, error: profilesError } = await supabase
        .from("user_profiles" as any)
        .select("id, username, full_name, avatar_url")
        .in("id", userIds as any);
      if (profilesError) {
        return rows as any[];
      }

      const byId = new Map<string, any>();
      for (const p of profiles || []) {
        if (p && (p as any).id) byId.set((p as any).id, p);
      }

      return rows.map((r: any) => ({
        ...r,
        profile: byId.get(r.user_id) || null,
      }));
    },
  });

  const addCommentMutation = useMutation({
    mutationFn: async () => {
      const text = commentText.trim();
      if (!text) return;
      if (!supabase || !activeWishlist?.id) return;
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth.user?.id;
      if (!uid) {
        return;
      }
      const { error } = await supabase
        .from("wishlist_comments" as any)
        .insert({ wishlist_id: activeWishlist.id, user_id: uid, content: text });
      if (error) throw error;

      try {
        await supabase.functions.invoke("push-dispatch", { body: { type: "comment_added", wishlistId: activeWishlist.id } });
      } catch {}
    },
    onSuccess: () => {
      setCommentText("");
      if (activeWishlist?.id) {
        queryClient.invalidateQueries({
          queryKey: ["dashboard", "recent-activity", "comments", activeWishlist.id],
        });
        queryClient.invalidateQueries({
          queryKey: ["dashboard", "recent-activity", "per-wishlist"],
        });
      }
    },
  });

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <CardTitle className="text-lg font-semibold">
          {t("dashboard.recent_activity_title", "Your recent activity")}
        </CardTitle>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="text-xs"
          onClick={() => navigate("/notifications")}
        >
          {t("dashboard.view_all_activity", "View all activity")}
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {!data || data.wishlists.length === 0 ? (
          <div className="text-sm text-muted-foreground">
            {t("dashboard.no_recent_activity_title", "No recent activity")}
          </div>
        ) : (
          <>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {data.wishlists.map((w) => {
                const isActive = activeWishlist && w.id === activeWishlist.id;
                return (
                  <button
                    key={w.id}
                    type="button"
                    onClick={() => setActiveWishlistId(w.id)}
                    className={`flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold whitespace-nowrap border transition-colors ${
                      isActive
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-muted text-foreground border-border hover:bg-muted/80"
                    }`}
                  >
                    <span className="truncate max-w-[140px]">
                      {w.title === "My Birthday Wishlist"
                        ? t("wishlist.my_birthday_wishlist", "My Birthday Wishlist")
                        : w.title}
                    </span>
                  </button>
                );
              })}
            </div>

            {activeWishlist ? (
              <div className="space-y-3 text-sm">
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <Heart className="h-4 w-4 text-[#be123c] fill-[#be123c]" />
                    <span className="font-semibold">{activeWishlist.likesCount}</span>
                    <span className="text-muted-foreground text-xs">
                      {t("dashboard.activity_likes_count", "likes")}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <MessageCircle className="h-4 w-4 text-blue-600" />
                    <span className="font-semibold">{activeWishlist.commentsCount}</span>
                    <span className="text-muted-foreground text-xs">
                      {t("dashboard.activity_comments_count", "comments")}
                    </span>
                  </div>
                </div>

                <div className="border rounded-lg p-3 max-h-52 overflow-y-auto bg-muted/40">
                  {commentsLoading ? (
                    <div className="text-xs text-muted-foreground">
                      {t("common.loading", "Loading...")}
                    </div>
                  ) : (commentsData as any[]).length === 0 ? (
                    <div className="text-xs text-muted-foreground">
                      {t(
                        "dashboard.comments_empty",
                        "No comments yet. Be the first to comment!",
                      )}
                    </div>
                  ) : (
                    (commentsData as any[]).map((c: any) => {
                      const displayName =
                        c.profile?.full_name || c.profile?.username || t("common.someone", "Someone");
                      const created = c.created_at
                        ? formatDistanceToNow(new Date(c.created_at), {
                            addSuffix: true,
                            locale: dateLocale,
                          })
                        : "";
                      return (
                        <div
                          key={c.id}
                          className="flex items-start gap-2 text-xs mb-2 last:mb-0"
                        >
                          <Avatar className="h-7 w-7 mt-0.5">
                            <AvatarImage src={c.profile?.avatar_url || ""} />
                            <AvatarFallback>
                              {displayName.toString().charAt(0).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-semibold truncate">{displayName}</span>
                              {created && (
                                <span className="text-[10px] text-muted-foreground shrink-0">
                                  {created}
                                </span>
                              )}
                            </div>
                            <div className="text-foreground leading-snug mt-0.5 break-words">
                              {c.content}
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <MentionInput
                    value={commentText}
                    onChange={(e) => setCommentText(e.target.value)}
                    placeholder={t(
                      "dashboard.comments_placeholder",
                      "Add a comment...",
                    )}
                    aria-label={t(
                      "dashboard.comments_placeholder",
                      "Add a comment...",
                    )}
                  />
                  <Button
                    type="button"
                    size="sm"
                    disabled={!commentText.trim() || addCommentMutation.isPending}
                    onClick={() => addCommentMutation.mutate()}
                  >
                    {t("dashboard.comments_post", "Post")}
                  </Button>
                </div>
              </div>
            ) : null}
          </>
        )}
      </CardContent>
    </Card>
  );
};
