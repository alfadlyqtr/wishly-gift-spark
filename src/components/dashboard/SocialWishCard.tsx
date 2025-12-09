import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Heart, MessageCircle, Users } from "lucide-react";
import { ShareButton } from "@/components/ui/ShareButton";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { MentionInput } from "@/components/ui/MentionInput";
import { formatDistanceToNow } from "date-fns";
import { motion, useMotionValue, useTransform } from "motion/react";

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

      // Group wishlists by owner
      const wishlistsByOwner: Record<string, any[]> = {};
      const ownerById: Record<string, any> = {};
      for (const w of wishlists as any[]) {
        const ownerId = (w as any).user_id as string;
        if (!wishlistsByOwner[ownerId]) wishlistsByOwner[ownerId] = [];
        wishlistsByOwner[ownerId].push(w);
        if ((w as any).user_profiles) {
          ownerById[ownerId] = (w as any).user_profiles;
        }
      }

      // Likes for all wishlists
      const { data: likes } = await supabase
        .from("wishlist_likes" as any)
        .select("wishlist_id, user_id")
        .in("wishlist_id", wishlistIds as any);

      const likesList = likes || [];
      const likesByWishlist: Record<string, { count: number; likedByMe: boolean }> = {};
      for (const wid of wishlistIds) {
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

      // Build a friend entry per owner — include ALL followed users, even those without items
      const friends: any[] = [];
      for (const ownerId of ids as string[]) {
        const ownerWishlists = wishlistsByOwner[ownerId] || [];
        const ownerWishlistIds = ownerWishlists.map((w: any) => w.id);
        const ownerItems = (items || []).filter((it: any) => ownerWishlistIds.includes(it.wishlist_id));
        const primaryWishlistId = ownerItems[0]?.wishlist_id || ownerWishlistIds[0] || null;

        // Fetch profile if not already in ownerById
        let ownerProfile = ownerById[ownerId];
        if (!ownerProfile) {
          const { data: prof } = await supabase
            .from("user_profiles")
            .select("id, username, full_name, avatar_url, allow_wishlist_sharing, allow_likes, allow_comments")
            .eq("id", ownerId)
            .maybeSingle();
          ownerProfile = prof || { id: ownerId, username: null, full_name: null, avatar_url: null };
        }

        friends.push({
          owner: ownerProfile,
          ownerWishlists,
          items: ownerItems,
          likesByWishlist,
          primaryWishlistId,
        });
      }

      if (friends.length === 0) return null as any;

      return { friends } as any;
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

  const friends = (data as any)?.friends as any[] | undefined;
  const [activeFriendIndex, setActiveFriendIndex] = useState(0);
  const [activeWishlistId, setActiveWishlistId] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (!friends || friends.length === 0) return;
    const first = friends[0];
    setActiveFriendIndex(0);
    setActiveWishlistId(first.primaryWishlistId as string | undefined);
  }, [friends?.length]);

  const activeFriend = friends && friends.length > 0
    ? friends[Math.min(activeFriendIndex, friends.length - 1)]
    : undefined;

  const ownerWishlists = activeFriend?.ownerWishlists as any[] | undefined;

  useEffect(() => {
    if (!activeFriend?.primaryWishlistId) return;
    setActiveWishlistId(activeFriend.primaryWishlistId as string);
  }, [activeFriend?.primaryWishlistId]);

  const activeWishlist = ownerWishlists && ownerWishlists.length > 0
    ? ownerWishlists.find((w: any) => w.id === activeWishlistId) || ownerWishlists[0]
    : undefined;

  const itemsAll = activeFriend?.items as any[] | undefined;
  const items = activeWishlist && itemsAll
    ? itemsAll.filter((it: any) => it.wishlist_id === activeWishlist.id)
    : [];

  const likesByWishlist = activeFriend?.likesByWishlist as Record<string, { count: number; likedByMe: boolean }> | undefined;
  const wishlistId = activeWishlist?.id as string | undefined;
  const likesInfo = wishlistId && likesByWishlist ? likesByWishlist[wishlistId] : undefined;
  const likesCount = likesInfo?.count ?? 0;
  const likedByMe = likesInfo?.likedByMe ?? false;

  const owner = activeFriend?.owner;
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

  const dragX = useMotionValue(0);
  const rotateY = useTransform(dragX, [-80, 80], [-12, 12]);

  const handleDragEnd = (_: any, info: any) => {
    const offsetX = info?.offset?.x ?? 0;
    const velocityX = info?.velocity?.x ?? 0;
    const threshold = 60;
    const velocityThreshold = 300;

    if (offsetX < -threshold || velocityX < -velocityThreshold) {
      // Flick left → next friend
      setActiveFriendIndex((prev) => {
        if (!friends || friends.length === 0) return 0;
        return (prev + 1) % friends.length;
      });
    } else if (offsetX > threshold || velocityX > velocityThreshold) {
      // Flick right → previous friend
      setActiveFriendIndex((prev) => {
        if (!friends || friends.length === 0) return 0;
        return (prev - 1 + friends.length) % friends.length;
      });
    }
    dragX.set(0);
  };

  const hasFriends = !!friends && friends.length > 0;

  // Show the global "No recent activity" card only when there is truly
  // nothing to show (no friends at all).
  if (!data || !hasFriends) {
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

  // Build the visible stack: up to 5 friends starting from activeFriendIndex
  const maxStack = Math.min(5, friends.length);
  const stackIndices: number[] = [];
  for (let i = 0; i < maxStack; i++) {
    stackIndices.push((activeFriendIndex + i) % friends.length);
  }

  // Helper to render a single friend card (used for stacked cards behind the top one)
  const renderStackedCard = (friendIdx: number, stackPosition: number) => {
    const friend = friends[friendIdx];
    const friendOwner = friend?.owner;
    const friendWishlists = friend?.ownerWishlists as any[] | undefined;
    const friendItems = friend?.items as any[] | undefined;
    
    const cardWishlist = friendWishlists?.[0];
    const cardItems = cardWishlist && friendItems
      ? friendItems.filter((it: any) => it.wishlist_id === cardWishlist?.id)
      : [];

    // Use the same rotation math as WishlistStack: rotateZ with origin at bottom-right
    // Increased rotation (12 degrees per card) so stacked cards are clearly visible
    const rotateZ = (maxStack - stackPosition - 1) * 12;
    const scale = 1 + stackPosition * 0.06 - maxStack * 0.06;
    const yOffset = stackPosition * 10;

    return (
      <motion.div
        key={`stack-${friendIdx}-${stackPosition}`}
        className="absolute"
        style={{ 
          width: '100%',
          transformOrigin: '90% 90%',
        }}
        animate={{
          rotateZ,
          scale,
          y: yOffset,
        }}
        transition={{ type: 'spring', stiffness: 260, damping: 20 }}
      >
        <Card
          className="relative overflow-hidden rounded-[24px] bg-gradient-to-br from-[hsl(var(--brand-cool-start))] via-[hsl(var(--brand-cool-end))] to-[hsl(var(--brand-warm-end))] shadow-[0_24px_40px_rgba(0,0,0,0.35)] max-w-sm mx-auto"
        >
          <div className="rounded-[24px] bg-background/88 backdrop-blur-md">
            <CardHeader className="pb-4 px-5 pt-4">
              <div className="flex items-start gap-3">
                <Avatar className="h-11 w-11 shadow-[0_6px_14px_rgba(15,23,42,0.35)] ring-2 ring-white/70">
                  <AvatarImage src={friendOwner?.avatar_url || ""} />
                  <AvatarFallback className="bg-gradient-to-br from-[hsl(var(--brand-cool-start))] via-[hsl(var(--brand-cool-end))] to-[hsl(var(--brand-warm-end))] text-primary-foreground font-semibold">
                    {(friendOwner?.full_name || friendOwner?.username || 'U').charAt(0)}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p
                    className="flex items-center gap-2 text-sm font-extrabold bg-gradient-to-r from-[hsl(var(--brand-cool-start))] via-[hsl(var(--brand-cool-end))] to-[hsl(var(--brand-warm-end))] bg-clip-text text-transparent drop-shadow-[0_2px_2px_rgba(0,0,0,0.75)] truncate"
                    style={{ WebkitTextStroke: "0.6px rgba(0,0,0,0.9)" }}
                  >
                    <span className="truncate">
                      {friendOwner?.full_name || friendOwner?.username || 'User'}
                    </span>
                  </p>
                  {friendWishlists && friendWishlists.length > 0 && (
                    <p className="mt-1 text-xs text-muted-foreground truncate">
                      {friendWishlists[0]?.title === 'My Birthday Wishlist'
                        ? t('wishlist.my_birthday_wishlist', 'My Birthday Wishlist')
                        : (friendWishlists[0]?.title || t('events.untitled', 'Untitled'))}
                    </p>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent className="pb-2 px-5">
              {cardItems && cardItems.length > 0 ? (
                <div className="flex items-center gap-3">
                  <div className="h-14 w-14 rounded-xl bg-muted/60 flex items-center justify-center overflow-hidden ring-1 ring-white/60 shadow-[0_8px_18px_rgba(15,23,42,0.35)]">
                    {cardItems[0].image_url ? (
                      <img src={cardItems[0].image_url} alt={cardItems[0].title} className="h-full w-full object-cover" />
                    ) : (
                      <span className="text-xl" aria-hidden>🎁</span>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-foreground truncate">
                      {t('dashboard.feed_added_wishes', 'Added {{count}} new wishes', { count: cardItems.length })}
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
              <span className="text-xs text-muted-foreground">&nbsp;</span>
            </CardFooter>
          </div>
        </Card>
      </motion.div>
    );
  };

  return (
    <>
    <Dialog open={commentsOpen} onOpenChange={setCommentsOpen}>
      {/* Container for the stacked cards - static back cards + draggable top card */}
      <div
        className="relative max-w-sm mx-auto mt-10 md:mt-6"
        style={{ minHeight: 340, perspective: 600 }}
      >
        {/* Render back cards first (static, not draggable) */}
        {stackIndices.slice(1).reverse().map((friendIdx, reversePos) => {
          const stackPosition = maxStack - 1 - reversePos;
          return renderStackedCard(friendIdx, stackPosition);
        })}
        
        {/* Top card - this one is draggable */}
        <motion.div
          className="absolute inset-x-0 top-8 md:top-6 w-full cursor-grab active:cursor-grabbing"
          style={{ 
            x: dragX, 
            rotateY, 
            transformPerspective: 800,
            transformOrigin: '90% 90%',
            zIndex: maxStack + 1,
          }}
          drag="x"
          dragElastic={0.3}
          dragConstraints={{ left: 0, right: 0 }}
          onDragEnd={handleDragEnd}
          whileDrag={{ scale: 1.02 }}
          animate={{
            rotateZ: (maxStack - 1) * 12,
            scale: 1,
            y: 0,
          }}
          transition={{ type: 'spring', stiffness: 260, damping: 20 }}
        >
          <Card
            className="relative overflow-hidden rounded-[24px] bg-gradient-to-br from-[hsl(var(--brand-cool-start))] via-[hsl(var(--brand-cool-end))] to-[hsl(var(--brand-warm-end))] shadow-[0_24px_40px_rgba(0,0,0,0.35)] max-w-sm mx-auto"
          >
            <div className="rounded-[24px] bg-background/88 backdrop-blur-md">
              <CardHeader className="pb-3 px-4 pt-3 sm:pb-4 sm:px-5 sm:pt-4">
                <div className="flex items-start gap-3">
                  <Avatar className="h-9 w-9 sm:h-11 sm:w-11 shadow-[0_6px_14px_rgba(15,23,42,0.35)] ring-2 ring-white/70">
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
                    {ownerWishlists && ownerWishlists.length > 0 && (
                      <div className="mt-1 inline-flex max-w-full items-center gap-1 overflow-x-auto rounded-full border border-[hsl(var(--brand-cool-end))]/60 bg-background/10 px-1 py-0.5 -mx-1 px-1 shadow-[0_0_0_1px_rgba(15,23,42,0.35)]">
                        {ownerWishlists.map((w: any) => {
                          const isActive = w.id === activeWishlistId;
                          return (
                            <button
                              key={w.id}
                              type="button"
                              onClick={() => setActiveWishlistId(w.id)}
                              className={`relative whitespace-nowrap rounded-full px-3 py-0.5 text-[11px] font-semibold transition-colors ${
                                isActive
                                  ? 'bg-white text-[hsl(var(--brand-cool-end))] border border-[hsl(var(--brand-cool-end))]/80 shadow-sm'
                                  : 'bg-transparent text-[hsl(var(--brand-cool-end))]/80 hover:text-[hsl(var(--brand-cool-end))]'
                              }`}
                            >
                              {w.title === 'My Birthday Wishlist' 
                                ? t('wishlist.my_birthday_wishlist', 'My Birthday Wishlist') 
                                : (w.title || t('events.untitled', 'Untitled'))}
                            </button>
                          );
                        })}
                      </div>
                    )}
                    <div className="mt-0.5" />
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pb-2 px-4 sm:px-5">
                {items && items.length > 0 ? (
                  <div className="flex items-center gap-3">
                    <div className="h-12 w-12 sm:h-14 sm:w-14 rounded-xl bg-muted/60 flex items-center justify-center overflow-hidden ring-1 ring-white/60 shadow-[0_8px_18px_rgba(15,23,42,0.35)]">
                      {items[0].image_url ? (
                        <img src={items[0].image_url} alt={items[0].title} className="h-full w-full object-cover" />
                      ) : (
                        <span className="text-xl" aria-hidden>🎁</span>
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
              {wishlistId && (
                <div className="px-4 sm:px-5 pb-2 mt-1 flex items-center justify-center gap-2">
                  {(() => {
                    if (!wishlistEventDate) return null;
                    const target = new Date(wishlistEventDate).getTime();
                    if (Number.isNaN(target)) return null;

                    const now = Date.now();
                    const diffMs = target - now;
                    if (diffMs < 0) return null;

                    const totalMinutes = Math.floor(diffMs / (1000 * 60));
                    const days = Math.floor(totalMinutes / (60 * 24));
                    const remainingMinutesAfterDays = totalMinutes - days * 60 * 24;
                    const hours = Math.floor(remainingMinutesAfterDays / 60);
                    const minutes = remainingMinutesAfterDays % 60;

                    const label = t(
                      'dashboard.countdown_full_left',
                      '{{days}}d {{hours}}h {{minutes}}m left',
                      { days, hours, minutes },
                    );

                    return (
                      <span className="inline-flex items-center rounded-full bg-gradient-to-r from-[hsl(var(--brand-cool-start))] via-[hsl(var(--brand-cool-end))] to-[hsl(var(--brand-warm-end))] px-2 py-0.5 text-[11px] text-white whitespace-nowrap shadow-[0_0_14px_rgba(56,189,248,0.7)]">
                        {label}
                      </span>
                    );
                  })()}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-3 text-[11px] font-semibold rounded-full bg-gradient-to-r from-[hsl(var(--brand-cool-start))] via-[hsl(var(--brand-cool-end))] to-[hsl(var(--brand-warm-end))] text-white shadow-[0_4px_10px_rgba(15,23,42,0.45)] hover:shadow-[0_6px_14px_rgba(15,23,42,0.55)] hover:brightness-110 border border-white/60"
                    onClick={() => navigate(`/wishlist/${wishlistId}`)}
                  >
                    {t('dashboard.view_wishlist', 'View wishlist')}
                  </Button>
                </div>
              )}
              <CardFooter className="flex justify-between items-center border-t border-border/60 bg-muted/30 px-3 py-2.5 sm:px-4 sm:py-3">
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
                {owner?.allow_wishlist_sharing && wishlistId && (
                  <ShareButton
                    url={`${window.location.origin}/w/${wishlistId}`}
                    title={(data as any)?.wishlist?.title || 'Wishlist'}
                    size="sm"
                  />
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
          </Card>
        </motion.div>
      </div>

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
            <MentionInput
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
