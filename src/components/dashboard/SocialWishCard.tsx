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
import { formatDistanceToNow } from "date-fns";

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
      
      // First get wishlists from followed users, including owner preferences
      const { data: wishlists } = await supabase
        .from("wishlists")
        .select("id, title, event_date, user_id, user_profiles(id, username, full_name, avatar_url, allow_wishlist_sharing, allow_likes, allow_comments)")
        .in("user_id", ids as any);

      if (!wishlists || wishlists.length === 0) return null as any;

      const wishlistIds = wishlists.map((w: any) => w.id);

      // Then get recent items from those wishlists
      const { data: items } = await supabase
        .from("wishlist_items")
        .select("id, title, image_url, added_at, wishlist_id")
        .in("wishlist_id", wishlistIds)
        .order("added_at", { ascending: false })
        .limit(9);

      // Determine the most recently updated wishlist among followed users
      const primaryWishlistId = (items && items[0]?.wishlist_id) || wishlistIds[0];
      const primaryWishlist = wishlists.find((w: any) => w.id === primaryWishlistId) || wishlists[0];

      // Focus on a single owner (friend) for this card: the owner of the primary wishlist
      const ownerUserId = primaryWishlist.user_id;
      const ownerWishlists = (wishlists || []).filter((w: any) => w.user_id === ownerUserId);
      const ownerWishlistIds = ownerWishlists.map((w: any) => w.id);

      // All items for this owner (we will filter per active wishlist in the component)
      const ownerItems = (items || []).filter((it: any) => ownerWishlistIds.includes(it.wishlist_id));

      // Likes for all of this owner's wishlists
      const { data: likes } = await supabase
        .from("wishlist_likes" as any)
        .select("wishlist_id, user_id")
        .in("wishlist_id", ownerWishlistIds as any);

      const likesList = likes || [];
      const likesByWishlist: Record<string, { count: number; likedByMe: boolean }> = {};
      for (const wid of ownerWishlistIds) {
        likesByWishlist[wid] = { count: 0, likedByMe: false };
      }
      for (const row of likesList as any[]) {
        const wid = row.wishlist_id as string;
        if (!likesByWishlist[wid]) {
          likesByWishlist[wid] = { count: 0, likedByMe: false };
        }
        likesByWishlist[wid].count += 1;
        if (uid && row.user_id === uid) {
          likesByWishlist[wid].likedByMe = true;
        }
      }

      return {
        owner: primaryWishlist.user_profiles,
        ownerWishlists,
        items: ownerItems,
        likesByWishlist,
        primaryWishlistId,
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

  const ownerWishlists = (data as any)?.ownerWishlists as any[] | undefined;
  const [activeWishlistId, setActiveWishlistId] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (!data?.primaryWishlistId) return;
    setActiveWishlistId(data.primaryWishlistId as string);
  }, [data?.primaryWishlistId]);

  const activeWishlist = ownerWishlists && ownerWishlists.length > 0
    ? ownerWishlists.find((w: any) => w.id === activeWishlistId) || ownerWishlists[0]
    : undefined;

  const itemsAll = (data as any)?.items as any[] | undefined;
  const items = activeWishlist && itemsAll
    ? itemsAll.filter((it: any) => it.wishlist_id === activeWishlist.id)
    : [];

  const likesByWishlist = (data as any)?.likesByWishlist as Record<string, { count: number; likedByMe: boolean }> | undefined;
  const wishlistId = activeWishlist?.id as string | undefined;
  const likesInfo = wishlistId && likesByWishlist ? likesByWishlist[wishlistId] : undefined;
  const likesCount = likesInfo?.count ?? 0;
  const likedByMe = likesInfo?.likedByMe ?? false;

  const owner = (data as any)?.owner;
  const allowLikesPref = owner?.allow_likes !== false;
  const allowCommentsPref = owner?.allow_comments !== false;
  const wishlistTitle = activeWishlist?.title as string | undefined;
  const wishlistEventDate = activeWishlist?.event_date as string | undefined;

  const latestAddedAt = (items && items.length > 0 && items[0]?.added_at) || undefined;
  const updatedAgo = latestAddedAt
    ? formatDistanceToNow(new Date(latestAddedAt), { addSuffix: true })
    : undefined;

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

        // Ignore duplicate like attempts hitting the unique (wishlist_id, user_id) constraint
        if (error && (error as any).code !== "23505") {
          throw error;
        }
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
      <Card className="relative overflow-hidden border-none bg-transparent shadow-none">
        <div className="rounded-3xl bg-gradient-to-br from-[hsl(var(--brand-cool-start))]/18 via-[hsl(var(--brand-cool-end))]/14 to-[hsl(var(--brand-warm-end))]/20 p-[1.5px]">
          <div className="rounded-3xl bg-background/85 backdrop-blur-md border border-white/40 shadow-[0_16px_40px_rgba(15,23,42,0.24)]">
            <CardHeader className="pb-4 px-4 pt-4">
              <div className="flex items-center gap-3">
                <div className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-[hsl(var(--brand-cool-start))] via-[hsl(var(--brand-cool-end))] to-[hsl(var(--brand-warm-end))] text-white shadow-[0_8px_18px_rgba(148,27,184,0.6)] ring-2 ring-white/70">
                  <Users className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-semibold tracking-tight">
                    {t('dashboard.no_recent_activity_title', 'No recent activity')}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {t('dashboard.no_recent_activity_subtitle', 'Follow friends to see their latest wishes')}
                  </p>
                </div>
              </div>
            </CardHeader>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <>
    <Dialog open={commentsOpen} onOpenChange={setCommentsOpen}>
      <Card className="relative overflow-hidden border-none bg-transparent shadow-none">
        <div className="rounded-3xl bg-gradient-to-br from-[hsl(var(--brand-cool-start))]/18 via-[hsl(var(--brand-cool-end))]/14 to-[hsl(var(--brand-warm-end))]/20 p-[1.5px]">
          <div className="rounded-3xl bg-background/85 backdrop-blur-md border border-white/40 shadow-[0_16px_40px_rgba(15,23,42,0.24)]">
        <CardHeader className="pb-4 px-5 pt-4">
          <div className="flex items-start gap-3">
            <Avatar className="h-11 w-11 shadow-[0_6px_14px_rgba(15,23,42,0.35)] ring-2 ring-white/70">
              <AvatarImage src={owner?.avatar_url || ""} />
              <AvatarFallback className="bg-gradient-to-br from-[hsl(var(--brand-cool-start))] via-[hsl(var(--brand-cool-end))] to-[hsl(var(--brand-warm-end))] text-primary-foreground font-semibold">
                {(owner?.full_name || owner?.username || 'U').charAt(0)}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <p
                className="flex items-center gap-2 text-sm font-extrabold bg-gradient-to-r from-[hsl(var(--brand-cool-start))] via-[hsl(var(--brand-cool-end))] to-[hsl(var(--brand-warm-end))] bg-clip-text text-transparent drop-shadow-[0_2px_2px_rgba(0,0,0,0.75)] truncate"
                style={{ WebkitTextStroke: "0.6px rgba(0,0,0,0.9)" }}
              >
                <span className="truncate">
                  {owner?.full_name || owner?.username || 'User'}
                </span>
              </p>
              {wishlistTitle && (
                <p className="mt-0.5 text-xs font-semibold text-foreground/90 truncate">
                  {wishlistTitle}
                </p>
              )}
              {ownerWishlists && ownerWishlists.length > 1 && (
                <div className="mt-1 flex gap-1 overflow-x-auto pb-1 -mx-1 px-1">
                  {ownerWishlists.map((w: any) => {
                    const isActive = w.id === activeWishlistId;
                    return (
                      <button
                        key={w.id}
                        type="button"
                        onClick={() => setActiveWishlistId(w.id)}
                        className={`whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] transition-colors ${
                          isActive
                            ? 'bg-gradient-to-r from-[hsl(var(--brand-cool-start))] via-[hsl(var(--brand-cool-end))] to-[hsl(var(--brand-warm-end))] text-white border-white/70 shadow-[0_4px_10px_rgba(15,23,42,0.45)]'
                            : 'bg-background/70 text-muted-foreground border-white/50 hover:bg-background hover:text-foreground'
                        }`}
                      >
                        {w.title || t('events.untitled', 'Untitled')}
                      </button>
                    );
                  })}
                </div>
              )}
              <div className="mt-0.5 flex items-center gap-2">
                {(() => {
                  if (!wishlistEventDate) return null;
                  const target = new Date(wishlistEventDate).getTime();
                  if (Number.isNaN(target)) return null;
                  const diffDays = Math.ceil((target - Date.now()) / (1000 * 60 * 60 * 24));
                  if (diffDays < 0) return null;
                  const label = diffDays === 0
                    ? t('dashboard.countdown_today', 'Today')
                    : t('dashboard.countdown_days_left', '{{count}}d left', { count: diffDays });
                  return (
                    <span className="inline-flex items-center rounded-full bg-background/80 px-2 py-0.5 text-[11px] text-muted-foreground whitespace-nowrap">
                      {label}
                    </span>
                  );
                })()}
                {wishlistId && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-3 text-[11px] font-semibold rounded-full bg-gradient-to-r from-[hsl(var(--brand-cool-start))] via-[hsl(var(--brand-cool-end))] to-[hsl(var(--brand-warm-end))] text-white shadow-[0_4px_10px_rgba(15,23,42,0.45)] hover:shadow-[0_6px_14px_rgba(15,23,42,0.55)] hover:brightness-110 border border-white/60"
                    onClick={() => navigate(`/wishlist/${wishlistId}`)}
                  >
                    {t('dashboard.view_wishlist', 'View wishlist')}
                  </Button>
                )}
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pb-4 px-5">
          {items && items.length > 0 ? (
            <div className="flex items-center gap-3">
              <div className="h-14 w-14 rounded-xl bg-muted/60 flex items-center justify-center overflow-hidden ring-1 ring-white/60 shadow-[0_8px_18px_rgba(15,23,42,0.35)]">
                {items[0].image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={items[0].image_url}
                    alt={items[0].title}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <span className="text-xl" aria-hidden>
                    🎁
                  </span>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-foreground truncate">
                  {t('dashboard.feed_added_wishes', 'Added {{count}} new wishes', { count: items.length })}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground truncate">
                  {(() => {
                    const maxTitles = 3;
                    const titles = (items || []).map((it: any) => it.title || t('events.untitled', 'Untitled'));
                    const shown = titles.slice(0, maxTitles);
                    const remaining = titles.length - shown.length;
                    const base = shown.join(' · ');
                    if (remaining > 0) {
                      return `${base} · +${remaining} more`;
                    }
                    return base;
                  })()}
                </p>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              {t('dashboard.no_items_yet', 'No wishes yet in this list.')}
            </p>
          )}
        </CardContent>
        <CardFooter className="flex justify-between items-center border-t border-border/60 bg-muted/30 px-4 py-3">
          {allowLikesPref && (
            <Button
              variant="ghost"
              size="sm"
              className="flex items-center gap-2 rounded-full px-3"
              onClick={() => likeMutation.mutate()}
            >
              <Heart className={`h-4 w-4 ${likedByMe ? 'fill-[#be123c] text-[#be123c]' : 'text-muted-foreground'}`} />
              <span className="text-sm">
                {likesCount && likesCount > 0
                  ? t('dashboard.action_like_count', '{{count}} likes', { count: likesCount })
                  : t('dashboard.action_like', 'Like')}
              </span>
            </Button>
          )}
          {owner?.allow_wishlist_sharing && (
            <Button
              variant="ghost"
              size="sm"
              className="flex items-center gap-2 rounded-full px-3"
              onClick={handleShare}
            >
              <Repeat2 className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm">{t('dashboard.action_share', 'Share')}</span>
            </Button>
          )}
          {allowCommentsPref && (
            <Button
              variant="ghost"
              size="sm"
              className="flex items-center gap-2 rounded-full px-3"
              onClick={handleCommentClick}
            >
              <MessageCircle className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm">{t('dashboard.action_comment', 'Comment')}</span>
            </Button>
          )}
        </CardFooter>
          </div>
        </div>
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
    </>
  );
}
