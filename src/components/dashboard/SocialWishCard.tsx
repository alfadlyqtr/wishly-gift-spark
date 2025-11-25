import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Heart, Repeat2, MessageCircle, Users } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

export const SocialWishCard = () => {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [commentText, setCommentText] = useState("");

  const { data } = useQuery({
    queryKey: ["dashboard", "social", "v2"],
    queryFn: async () => {
      if (!supabase) return null as any;
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth.user?.id;
      if (!uid) return null as any;
      const { data: follows } = await supabase
        .from("followers")
        .select("following_id")
        .eq("user_id", uid);
      const followedIds = (follows || [])
        .map((f: any) => f.following_id)
        .filter((id: string | null | undefined) => !!id && id !== uid);
      const ids = Array.from(new Set(followedIds));
      if (ids.length === 0) return null as any;
      
      // First get wishlists from followed users
      const { data: wishlists } = await supabase
        .from("wishlists")
        .select("id, title, user_id, user_profiles(id, username, full_name, avatar_url, allow_wishlist_sharing)")
        .in("user_id", ids as any);

      if (!wishlists || wishlists.length === 0) return null as any;

      const wishlistIds = wishlists.map((w: any) => w.id);

      // Then get items from those wishlists
      const { data: items } = await supabase
        .from("wishlist_items")
        .select("id, title, image_url, added_at, wishlist_id")
        .in("wishlist_id", wishlistIds)
        .order("added_at", { ascending: false })
        .limit(3);

      // For now, show the most recently updated wishlist among followed users
      const primaryWishlistId = (items && items[0]?.wishlist_id) || wishlistIds[0];
      const ownerWishlist = wishlists.find((w: any) => w.id === primaryWishlistId) || wishlists[0];
      const ownerItems = (items || []).filter((it: any) => it.wishlist_id === ownerWishlist.id).slice(0, 3);

      // Likes for this wishlist
      const { data: likes } = await supabase
        .from("wishlist_likes" as any)
        .select("user_id")
        .eq("wishlist_id", ownerWishlist.id);

      const likesList = likes || [];
      const likesCount = likesList.length;
      const likedByMe = !!uid && likesList.some((l: any) => l.user_id === uid);

      return {
        wishlist: ownerWishlist,
        items: ownerItems,
        likesCount,
        likedByMe,
      } as any;
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
          queryClient.invalidateQueries({ queryKey: ["dashboard", "social", "v2"] });
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

  const owner = (data as any)?.wishlist?.user_profiles;
  const wishlistId = (data as any)?.wishlist?.id as string | undefined;
  const likesCount = (data as any)?.likesCount as number | undefined;
  const likedByMe = (data as any)?.likedByMe as boolean | undefined;
  const items = (data as any)?.items as any[] | undefined;

  const likeMutation = useMutation({
    mutationFn: async () => {
      if (!supabase || !wishlistId) return;
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth.user?.id;
      if (!uid) {
        toast.error(t("common.not_authenticated", "You need to sign in"));
        return;
      }

      if (likedByMe) {
        const { error } = await supabase
          .from("wishlist_likes" as any)
          .delete()
          .eq("wishlist_id", wishlistId)
          .eq("user_id", uid);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("wishlist_likes" as any)
          .insert({ wishlist_id: wishlistId, user_id: uid });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dashboard", "social", "v2"] });
    },
    onError: (e: any) => {
      toast.error(e?.message || t("dashboard.error_like", "Failed to like wishlist"));
    },
  });

  const { data: comments = [] } = useQuery({
    queryKey: ["wishlist-comments", wishlistId],
    enabled: !!supabase && !!wishlistId && commentsOpen,
    queryFn: async () => {
      if (!supabase || !wishlistId) return [] as any[];
      const { data, error } = await supabase
        .from("wishlist_comments" as any)
        .select("id, content, created_at, user_id")
        .eq("wishlist_id", wishlistId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      const rows = data || [];

      // Attach basic profile data for each unique commenter so we can show their name
      const userIds = Array.from(new Set(rows.map((r: any) => r.user_id).filter(Boolean)));
      if (userIds.length === 0) return rows as any[];

      const { data: profiles, error: profErr } = await supabase
        .from("user_profiles" as any)
        .select("id, username, full_name, avatar_url")
        .in("id", userIds as any);
      if (profErr) {
        // If profile lookup fails, still return raw comments
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
      if (!supabase || !wishlistId) return;
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth.user?.id;
      if (!uid) {
        toast.error(t("common.not_authenticated", "You need to sign in"));
        return;
      }
      const { error } = await supabase
        .from("wishlist_comments" as any)
        .insert({ wishlist_id: wishlistId, user_id: uid, content: text });
      if (error) throw error;
    },
    onSuccess: () => {
      setCommentText("");
      if (wishlistId) {
        queryClient.invalidateQueries({ queryKey: ["wishlist-comments", wishlistId] });
      }
    },
    onError: (e: any) => {
      toast.error(e?.message || t("dashboard.error_comment", "Failed to add comment"));
    },
  });

  const handleShare = async () => {
    if (!wishlistId) return;

    try {
      const publicBase = (import.meta as any).env?.VITE_PUBLIC_SITE_URL as string | undefined;
      const origin = publicBase && /^https?:\/\//i.test(publicBase)
        ? publicBase.replace(/\/$/, "")
        : window.location.origin;
      const url = `${origin}/w/${wishlistId}`;
      const shareTitle = (data as any)?.wishlist?.title || "Wishlist";
      const text = `${shareTitle} — ${url}`;

      const nav: any = navigator as any;
      if (nav?.share) {
        const payload: any = { title: shareTitle, text, url };
        if (!nav.canShare || nav.canShare(payload)) {
          try {
            await nav.share(payload);
            return;
          } catch {
            // fall through
          }
        }
      }

      await navigator.clipboard.writeText(url);
      toast.success(t("dashboard.share_copied", "Link copied"));
    } catch (e: any) {
      toast.error(e?.message || t("dashboard.error_share", "Failed to share"));
    }
  };

  const handleCommentClick = () => {
    setCommentsOpen(true);
  };

  if (!data || !items || items.length === 0) {
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

  return (
    <Dialog open={commentsOpen} onOpenChange={setCommentsOpen}>
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-3">
            <Avatar className="h-10 w-10">
              <AvatarImage src={owner?.avatar_url || ""} />
              <AvatarFallback className="bg-primary text-primary-foreground">{(owner?.full_name || owner?.username || 'U').charAt(0)}</AvatarFallback>
            </Avatar>
            <div>
              <p className="font-semibold">{owner?.full_name || owner?.username || 'User'}</p>
              <p className="text-sm text-muted-foreground">{t('dashboard.added_wishes', 'Added {{count}} wishes', { count: (items || []).length })}</p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pb-3">
          <div className="grid grid-cols-3 gap-3">
            {(items || []).map((wish: any) => (
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
          <Button
            variant="ghost"
            size="sm"
            className="flex items-center gap-2"
            onClick={() => likeMutation.mutate()}
          >
            <Heart className={`h-4 w-4 ${likedByMe ? 'fill-[#800000] text-[#800000]' : ''}`} />
            <span className="text-sm">
              {likesCount && likesCount > 0
                ? t('dashboard.action_like_count', '{{count}} likes', { count: likesCount })
                : t('dashboard.action_like', 'Like')}
            </span>
          </Button>
          {owner?.allow_wishlist_sharing && (
            <Button
              variant="ghost"
              size="sm"
              className="flex items-center gap-2"
              onClick={handleShare}
            >
              <Repeat2 className="h-4 w-4" />
              <span className="text-sm">{t('dashboard.action_share', 'Share')}</span>
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            className="flex items-center gap-2"
            onClick={handleCommentClick}
          >
            <MessageCircle className="h-4 w-4" />
            <span className="text-sm">{t('dashboard.action_comment', 'Comment')}</span>
          </Button>
        </CardFooter>
      </Card>

      {wishlistId && (
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t('dashboard.comments_title', 'Comments')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 max-h-64 overflow-y-auto mb-3">
            {(comments as any[]).length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {t('dashboard.comments_empty', 'No comments yet. Be the first to comment!')}
              </p>
            ) : (
              (comments as any[]).map((c: any) => (
                <div key={c.id} className="flex items-start gap-2 text-sm">
                  <Avatar className="h-7 w-7 mt-0.5">
                    <AvatarImage src={c.profile?.avatar_url || ''} />
                    <AvatarFallback className="text-xs bg-gradient-to-br from-[hsl(var(--brand-cool-start))] via-[hsl(var(--brand-cool-end))] to-[hsl(var(--brand-warm-end))] text-white">
                      {(c.profile?.full_name || c.profile?.username || c.user_id || 'U').toString().charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <div className="font-semibold leading-tight">
                      {c.profile?.full_name || c.profile?.username || 'User'}
                    </div>
                    <div className="leading-snug text-foreground">
                      {c.content}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
          <div className="flex items-center gap-2 pt-1">
            <Input
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              placeholder={t('dashboard.comments_placeholder', 'Add a comment...')}
              aria-label={t('dashboard.comments_placeholder', 'Add a comment...')}
            />
            <Button
              variant="gradient"
              size="sm"
              disabled={!commentText.trim() || addCommentMutation.isPending}
              onClick={() => addCommentMutation.mutate()}
            >
              {t('dashboard.comments_post', 'Post')}
            </Button>
          </div>
        </DialogContent>
      )}
    </Dialog>
  );
}
