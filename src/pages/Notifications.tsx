import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import BackButton from "@/components/BackButton";
import { Bell, Heart, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { acceptFollowRequest, declineFollowRequest, requestFollow, cancelFollow } from "@/lib/follow";
import { useTranslation } from "react-i18next";
import { formatDistanceToNow } from "date-fns";
import { Dialog, DialogContent } from "@/components/ui/dialog";

type ActivityFilter = "all" | "follows" | "likes" | "comments";

const Notifications = () => {
  const [uid, setUid] = useState<string | null>(null);
  const [filter, setFilter] = useState<ActivityFilter>("all");
  const [selectedUser, setSelectedUser] = useState<any | null>(null);
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getUser().then(({ data }) => setUid(data.user?.id ?? null));
  }, []);

  const queryClient = useQueryClient();

  const { data = [], isLoading } = useQuery({
    queryKey: ["activities", uid],
    enabled: !!supabase && !!uid,
    staleTime: 1000 * 60 * 5, // 5 minutes
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("activities")
        .select(
          "id, activity_type, target_id, created_at, user_profiles:target_id(id, username, full_name, email, avatar_url)"
        )
        .eq("user_id", uid as string)
        .order("created_at", { ascending: false })
        .limit(30);
      if (error) throw error;
      return data || [];
    },
  });
  const { data: pendingFollowData = [], isLoading: pendingLoading } = useQuery({
    queryKey: ["notifications", "pending_follows", uid],
    enabled: !!supabase && !!uid,
    staleTime: 1000 * 60 * 5, // 5 minutes
    queryFn: async () => {
      const { data, error } = await supabase
        .from("followers")
        .select("user_id, created_at, user_profiles!followers_user_id_fkey(id, username, full_name, email, avatar_url)")
        .eq("following_id", uid as string)
        .eq("status", "pending")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch likes and comments on user's wishlists
  const { data: socialActivity = [], isLoading: socialLoading } = useQuery({
    queryKey: ["notifications", "social", uid],
    enabled: !!supabase && !!uid,
    staleTime: 1000 * 60 * 5, // 5 minutes
    queryFn: async () => {
      // Get user's wishlists
      const { data: wishlists } = await supabase
        .from("wishlists")
        .select("id, title")
        .eq("user_id", uid as string);

      if (!wishlists || wishlists.length === 0) return [];

      const wishlistIds = wishlists.map((w: any) => w.id);

      // Get likes on user's wishlists
      const { data: likes } = await (supabase as any)
        .from("wishlist_likes")
        .select("id, user_id, wishlist_id, created_at")
        .in("wishlist_id", wishlistIds)
        .neq("user_id", uid) // Exclude self-likes
        .order("created_at", { ascending: false })
        .limit(50);

      // Get comments on user's wishlists
      const { data: comments } = await (supabase as any)
        .from("wishlist_comments")
        .select("id, user_id, wishlist_id, content, created_at")
        .in("wishlist_id", wishlistIds)
        .neq("user_id", uid) // Exclude self-comments
        .order("created_at", { ascending: false })
        .limit(50);

      // Fetch profiles for likes and comments
      const userIds = new Set<string>();
      (likes || []).forEach((l: any) => l.user_id && userIds.add(l.user_id));
      (comments || []).forEach((c: any) => c.user_id && userIds.add(c.user_id));

      const profileMap = new Map();
      if (userIds.size > 0) {
        const { data: profiles } = await supabase
          .from("user_profiles")
          .select("id, username, full_name, avatar_url")
          .in("id", Array.from(userIds));
        
        if (profiles) {
          profiles.forEach((p: any) => profileMap.set(p.id, p));
        }
      }

      // Combine and sort
      const likeActivities = (likes || []).map((l: any) => ({
        type: "like",
        id: `like-${l.id}`,
        user_id: l.user_id,
        wishlist_id: l.wishlist_id,
        created_at: l.created_at,
        wishlist_title: wishlists.find((w: any) => w.id === l.wishlist_id)?.title || "Wishlist",
        user_profiles: profileMap.get(l.user_id) || null
      }));

      const commentActivities = (comments || []).map((c: any) => ({
        type: "comment",
        id: `comment-${c.id}`,
        user_id: c.user_id,
        wishlist_id: c.wishlist_id,
        content: c.content,
        created_at: c.created_at,
        wishlist_title: wishlists.find((w: any) => w.id === c.wishlist_id)?.title || "Wishlist",
        user_profiles: profileMap.get(c.user_id) || null
      }));

      return [...likeActivities, ...commentActivities].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
    },
  });

  const { data: followStatus, isLoading: followStatusLoading } = useQuery({
    queryKey: ["notifications", "follow_status", uid, selectedUser?.id],
    enabled: !!supabase && !!uid && !!selectedUser?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from("followers")
        .select("status")
        .eq("user_id", uid)
        .eq("following_id", selectedUser.id)
        .maybeSingle();
      return data?.status || null;
    },
  });

  const handleFollowToggle = async () => {
    if (!selectedUser?.id || !uid) return;
    try {
      if (followStatus === "accepted" || followStatus === "pending") {
        await cancelFollow(selectedUser.id);
        toast.success(t("followers.unfollowed", "Unfollowed"));
      } else {
        await requestFollow(selectedUser.id);
        toast.success(t("followers.follow_sent", "Request sent"));
      }
      queryClient.invalidateQueries({ queryKey: ["notifications", "follow_status"] });
    } catch (err) {
      console.error(err);
      toast.error(t("common.error_generic", "Something went wrong"));
    }
  };

  const approve = useMutation({
    mutationFn: (fromUserId: string) => acceptFollowRequest(fromUserId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications", "pending_follows"] });
      queryClient.invalidateQueries({ queryKey: ["profile", "social"] });
      toast.success(t('settings.follow_request_approved', 'Follow request approved'));
    },
  });
  const decline = useMutation({
    mutationFn: (fromUserId: string) => declineFollowRequest(fromUserId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications", "pending_follows"] });
      toast.success(t('settings.follow_request_declined', 'Follow request declined'));
    },
  });

  return (
    <div className="container max-w-2xl mx-auto px-4 py-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="relative inline-flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[hsl(var(--brand-cool-start))] via-[hsl(var(--brand-cool-end))] to-[hsl(var(--brand-warm-end))] shadow-[0_12px_30px_rgba(200,80,192,0.45)] ring-1 ring-white/40">
            <Bell className="h-5 w-5 text-white drop-shadow" />
            <span className="absolute -inset-1 rounded-[14px] blur-md bg-gradient-to-br from-[#ffcc70]/20 to-[#c850c0]/10" aria-hidden="true" />
          </div>
          <h2 className="text-2xl font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-[hsl(var(--brand-cool-start))] via-[hsl(var(--brand-cool-end))] to-[hsl(var(--brand-warm-end))] drop-shadow">
            {t('notifications.title', 'Notifications')}
          </h2>
        </div>
        <BackButton onClick={() => navigate('/dashboard')}>{t('common.back', 'Back')}</BackButton>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2">
        <button
          type="button"
          onClick={() => setFilter("all")}
          className={`px-4 py-2 rounded-full text-sm font-semibold transition whitespace-nowrap ${
            filter === "all"
              ? "bg-gradient-to-br from-[hsl(var(--brand-cool-start))] to-[hsl(var(--brand-warm-end))] text-white shadow-sm"
              : "bg-white/70 text-foreground hover:bg-white/90"
          }`}
        >
          {t("notifications.filter_all", "All")}
        </button>
        <button
          type="button"
          onClick={() => setFilter("follows")}
          className={`px-4 py-2 rounded-full text-sm font-semibold transition whitespace-nowrap ${
            filter === "follows"
              ? "bg-gradient-to-br from-[hsl(var(--brand-cool-start))] to-[hsl(var(--brand-warm-end))] text-white shadow-sm"
              : "bg-white/70 text-foreground hover:bg-white/90"
          }`}
        >
          {t("notifications.filter_follows", "Follows")}
        </button>
        <button
          type="button"
          onClick={() => setFilter("likes")}
          className={`px-4 py-2 rounded-full text-sm font-semibold transition whitespace-nowrap ${
            filter === "likes"
              ? "bg-gradient-to-br from-[hsl(var(--brand-cool-start))] to-[hsl(var(--brand-warm-end))] text-white shadow-sm"
              : "bg-white/70 text-foreground hover:bg-white/90"
          }`}
        >
          {t("notifications.filter_likes", "Likes")}
        </button>
        <button
          type="button"
          onClick={() => setFilter("comments")}
          className={`px-4 py-2 rounded-full text-sm font-semibold transition whitespace-nowrap ${
            filter === "comments"
              ? "bg-gradient-to-br from-[hsl(var(--brand-cool-start))] to-[hsl(var(--brand-warm-end))] text-white shadow-sm"
              : "bg-white/70 text-foreground hover:bg-white/90"
          }`}
        >
          {t("notifications.filter_comments", "Comments")}
        </button>
      </div>

      {/* Approvals Section */}
      <div className="space-y-2">
        <div className="notifications-card rounded-2xl bg-white/80 backdrop-blur ring-1 ring-white/70 shadow-[0_18px_40px_rgba(0,0,0,0.06)] p-3">
          <div className="font-bold mb-2">{t('notifications.follow_requests_title', 'Follow Requests')}</div>
          {pendingLoading ? (
            <div className="text-sm text-muted-foreground">{t('common.loading', 'Loading...')}</div>
          ) : (pendingFollowData as any[]).length === 0 ? (
            <div className="text-xs text-muted-foreground">{t('notifications.no_pending_requests', 'No pending requests')}</div>
          ) : (
            (pendingFollowData as any[]).map((r: any) => (
              <div key={`${r.user_id}-${r.created_at}`} className="flex items-center justify-between rounded-xl bg-white/70 backdrop-blur ring-1 ring-white/70 p-3 mb-2">
                <div className="flex items-center gap-4 min-w-0">
                  <button type="button" onClick={() => setSelectedUser(r.user_profiles)} className="relative flex shrink-0 overflow-hidden rounded-full h-16 w-16 ring-2 ring-white/80 cursor-pointer hover:opacity-90 transition-opacity">
                    <img className="h-full w-full object-cover" src={r.user_profiles?.avatar_url || "/avatar.svg"} alt={r.user_profiles?.full_name || r.user_profiles?.username || "user"} />
                  </button>
                  <div className="leading-tight min-w-0">
                    <div className="font-semibold truncate max-w-[160px]">{r.user_profiles?.full_name || r.user_profiles?.username || r.user_id}</div>
                    <div className="text-xs text-muted-foreground truncate max-w-[220px]">{t('notifications.requested_to_follow_you', 'Requested to follow you')}</div>
                    {r.user_profiles && (
                      <div className="text-[11px] text-muted-foreground truncate max-w-[220px]">
                        {`${r.user_profiles.username ? `@${r.user_profiles.username}` : ''}${r.user_profiles.email ? (r.user_profiles.username ? ' · ' : '') + r.user_profiles.email : ''}`}
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    className="notif-approve-btn"
                    onClick={() => approve.mutate(r.user_id)}
                    disabled={approve.isPending}
                  >
                    <span className="notif-approve-hoverEffect" aria-hidden="true">
                      <div />
                    </span>
                    <span className="relative z-10">
                      {t('notifications.ok', 'OK 👍')}
                    </span>
                  </button>
                  <button
                    type="button"
                    className="notif-decline-btn"
                    onClick={() => decline.mutate(r.user_id)}
                    disabled={decline.isPending}
                  >
                    {t('notifications.no_thanks', 'No thanks')}
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Activity Feed */}
        {isLoading || socialLoading ? (
          <div className="rounded-2xl bg-white/70 backdrop-blur ring-1 ring-white/70 p-3 text-sm text-muted-foreground">{t('common.loading', 'Loading...')}</div>
        ) : (() => {
          // Merge and filter activities
          const followActivities = (data as any[]).map((a: any) => ({ ...a, activityType: "follow" }));
          const allActivities = [...followActivities, ...socialActivity].sort(
            (a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
          );

          const filteredActivities = allActivities.filter((a: any) => {
            if (filter === "all") return true;
            if (filter === "follows") return a.activityType === "follow";
            if (filter === "likes") return a.type === "like";
            if (filter === "comments") return a.type === "comment";
            return true;
          });

          const visibleActivities = filteredActivities.filter((a: any) => !dismissedIds.has(a.id));

          if (visibleActivities.length === 0 && (pendingFollowData as any[]).length === 0) {
            return (
              <div className="rounded-2xl bg-white/70 backdrop-blur ring-1 ring-white/70 p-3 text-sm text-muted-foreground">
                {t('notifications.all_caught_up', "You're all caught up.")}
              </div>
            );
          }

          return (
            <div className="space-y-2">
              {visibleActivities.length > 0 && (
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => {
                      setDismissedIds((prev) => {
                        const next = new Set(prev);
                        visibleActivities.forEach((item: any) => {
                          if (item?.id) next.add(item.id);
                        });
                        return next;
                      });
                    }}
                    className="inline-flex items-center gap-1 rounded-full bg-slate-100 hover:bg-slate-200 text-[11px] font-medium text-slate-600 px-3 py-1 border border-slate-200"
                  >
                    {t('notifications.clear_all', 'Clear all')}
                  </button>
                </div>
              )}

              {visibleActivities.map((a: any) => {
            // Render social activity (likes/comments)
            if (a.type === "like" || a.type === "comment") {
              const timeAgo = formatDistanceToNow(new Date(a.created_at), { addSuffix: true });

              return (
                <div key={a.id} className="flex items-start gap-3 rounded-2xl bg-white/80 backdrop-blur ring-1 ring-white/70 shadow-[0_18px_40px_rgba(0,0,0,0.06)] p-3">
                  <button type="button" onClick={() => setSelectedUser(a.user_profiles)} className="relative flex shrink-0 overflow-hidden rounded-full h-9 w-9 ring-2 ring-white/80 cursor-pointer hover:opacity-90 transition-opacity">
                    <img
                      className="h-full w-full object-cover"
                      src={a.user_profiles?.avatar_url || "/avatar.svg"}
                      alt={a.user_profiles?.full_name || a.user_profiles?.username || "User"}
                    />
                  </button>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm">
                      <span className="font-semibold text-foreground">
                        {a.user_profiles?.full_name || a.user_profiles?.username || "Someone"}
                      </span>
                      <span className="text-muted-foreground ml-1">
                        {a.type === "like"
                          ? t("notifications.liked_your_wishlist", "liked your wishlist")
                          : t("notifications.commented_on_your_wishlist", "commented on your wishlist")}
                      </span>
                    </div>
                    <div className="text-xs text-muted-foreground font-medium mt-0.5 truncate">
                      {a.wishlist_title}
                    </div>
                    {a.type === "comment" && a.content && (
                      <div className="text-sm text-foreground mt-1 line-clamp-2">"{a.content}"</div>
                    )}
                    <div className="flex items-center justify-between mt-1">
                      <div className="flex items-center gap-2">
                        {a.type === "like" ? (
                          <Heart className="h-3 w-3 text-[#be123c] fill-[#be123c]" />
                        ) : (
                          <MessageCircle className="h-3 w-3 text-blue-600" />
                        )}
                        <span className="text-xs text-muted-foreground">{timeAgo}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setDismissedIds((prev) => {
                            const next = new Set(prev);
                            next.add(a.id);
                            return next;
                          });
                        }}
                        className="inline-flex items-center rounded-full bg-slate-100 hover:bg-slate-200 text-[11px] font-medium text-slate-600 px-2 py-0.5 border border-slate-200"
                      >
                        {t('notifications.clear_one', 'Clear')}
                      </button>
                    </div>
                  </div>
                </div>
              );
            }

            // Render follow activity (existing code)
            return (
            <div key={a.id} className="flex items-center justify-between rounded-2xl bg-white/80 backdrop-blur ring-1 ring-white/70 shadow-[0_18px_40px_rgba(0,0,0,0.06)] p-3">
              <div className="flex items-center gap-3 min-w-0">
                {a.user_profiles ? (
                  <button type="button" onClick={() => setSelectedUser(a.user_profiles)} className="relative flex shrink-0 overflow-hidden rounded-full h-9 w-9 ring-2 ring-white/80 cursor-pointer hover:opacity-90 transition-opacity">
                    <img
                      className="h-full w-full object-cover"
                      src={a.user_profiles.avatar_url || "/avatar.svg"}
                      alt={a.user_profiles.full_name || a.user_profiles.username || "user"}
                    />
                  </button>
                ) : null}
                <div className="min-w-0">
                  <div className="font-medium truncate">
                    {(() => {
                      const type = String(a.activity_type || "");
                      const profile = a.user_profiles as any | undefined;
                      const displayName = profile?.full_name || profile?.username || "";
                      if (type === "new_follower") {
                        return displayName
                          ? t('notifications.activity_new_follower', 'You have a new follower') + ` · ${displayName}`
                          : t('notifications.activity_new_follower', 'You have a new follower');
                      }
                      if (type === "follow_accepted") {
                        return displayName
                          ? t('notifications.activity_follow_accepted', 'You accepted a follow request') + ` · ${displayName}`
                          : t('notifications.activity_follow_accepted', 'You accepted a follow request');
                      }
                      if (type === 'wish_claimed') {
                        return displayName
                          ? t('notifications.activity_wish_claimed', 'New claim request') + ` · ${displayName}`
                          : t('notifications.activity_wish_claimed', 'New claim request');
                      }
                      switch (type) {
                        case "wish_added":
                          return t('notifications.activity_wish_added', 'You added a new wish');
                        case "wishlist_created":
                          return t('notifications.activity_wishlist_created', 'You created a new wishlist');
                        case "wishlist_updated":
                          return t('notifications.activity_wishlist_updated', 'You updated a wishlist');
                        case "question_answered":
                          const brandName = a.metadata?.brand_name || "A brand";
                          const productName = a.metadata?.product_name || "a product";
                          return t('notifications.activity_question_answered', '{{brand}} answered your question about {{product}}', { brand: brandName, product: productName });
                        default:
                          return t('notifications.activity_update', 'Update');
                      }
                    })()}
                  </div>
                  {a.user_profiles && (
                    <div className="text-xs text-muted-foreground truncate">
                      {`${a.user_profiles.username ? `@${a.user_profiles.username}` : ''}${a.user_profiles.email ? (a.user_profiles.username ? ' · ' : '') + a.user_profiles.email : ''}`}
                    </div>
                  )}
                  <div className="flex items-center justify-between mt-1">
                    <div className="text-xs text-muted-foreground">
                      {(() => {
                        const d = new Date(a.created_at);
                        if (i18n.language === 'ar') {
                          return d.toLocaleString('ar-EG', { dateStyle: 'short', timeStyle: 'short' });
                        }
                        return d.toLocaleString();
                      })()}
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setDismissedIds((prev) => {
                          const next = new Set(prev);
                          next.add(a.id);
                          return next;
                        });
                      }}
                      className="inline-flex items-center rounded-full bg-slate-100 hover:bg-slate-200 text-[11px] font-medium text-slate-600 px-2 py-0.5 border border-slate-200"
                    >
                      {t('notifications.clear_one', 'Clear')}
                    </button>
                  </div>
                </div>
              </div>
            </div>
            );
          })}
            </div>
          );
        })()}
      </div>

      {selectedUser && (
        <Dialog open={!!selectedUser} onOpenChange={(open) => !open && setSelectedUser(null)}>
          <DialogContent className="max-w-xs sm:max-w-sm border-0 bg-transparent shadow-none p-0">
            <div className="flex items-center justify-between gap-3 rounded-2xl bg-white/90 backdrop-blur ring-1 ring-white/70 shadow-[0_18px_40px_rgba(0,0,0,0.1)] p-4">
              <div className="flex items-center gap-3 min-w-0">
                <span className="relative flex shrink-0 overflow-hidden rounded-full h-12 w-12 ring-2 ring-white/80">
                  <img
                    src={selectedUser.avatar_url || "/avatar.svg"}
                    alt={selectedUser.full_name || selectedUser.username || "User"}
                    className="h-full w-full object-cover"
                  />
                </span>
                <div className="min-w-0">
                  <div className="font-semibold truncate text-base">{selectedUser.full_name || selectedUser.username || "User"}</div>
                  {selectedUser.username && (
                    <div className="text-sm text-muted-foreground">@{selectedUser.username}</div>
                  )}
                </div>
              </div>
              {selectedUser.id !== uid && (
                <button
                  type="button"
                  onClick={handleFollowToggle}
                  disabled={followStatusLoading}
                  className={`shrink-0 px-4 py-1.5 rounded-full text-xs font-semibold transition-all ${
                    followStatus === "accepted" || followStatus === "pending"
                      ? "bg-slate-100 text-slate-600 hover:bg-slate-200"
                      : "bg-gradient-to-r from-[hsl(var(--brand-cool-start))] to-[hsl(var(--brand-warm-end))] text-white hover:opacity-90 shadow-sm"
                  }`}
                >
                  {followStatusLoading
                    ? t('common.loading', 'Loading...')
                    : followStatus === "accepted"
                      ? t("followers.unfollow", "Unfollow")
                      : followStatus === "pending"
                        ? t("followers.cancel_request", "Cancel request")
                        : t("explore.follow", "Follow")}
                </button>
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
};

export default Notifications;
