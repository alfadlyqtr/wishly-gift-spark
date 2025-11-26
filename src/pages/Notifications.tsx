import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import BackButton from "@/components/BackButton";
import { Bell, Heart, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { acceptFollowRequest, declineFollowRequest } from "@/lib/follow";
import { useTranslation } from "react-i18next";
import { formatDistanceToNow } from "date-fns";

type ActivityFilter = "all" | "follows" | "likes" | "comments";

const Notifications = () => {
  const [uid, setUid] = useState<string | null>(null);
  const [filter, setFilter] = useState<ActivityFilter>("all");
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
        .select("id, user_id, wishlist_id, created_at, user_profiles(id, username, full_name, avatar_url)")
        .in("wishlist_id", wishlistIds)
        .neq("user_id", uid) // Exclude self-likes
        .order("created_at", { ascending: false })
        .limit(50);

      // Get comments on user's wishlists
      const { data: comments } = await (supabase as any)
        .from("wishlist_comments")
        .select("id, user_id, wishlist_id, content, created_at, user_profiles(id, username, full_name, avatar_url)")
        .in("wishlist_id", wishlistIds)
        .neq("user_id", uid) // Exclude self-comments
        .order("created_at", { ascending: false })
        .limit(50);

      // Combine and sort
      const likeActivities = (likes || []).map((l: any) => ({
        type: "like",
        id: `like-${l.id}`,
        user_id: l.user_id,
        wishlist_id: l.wishlist_id,
        created_at: l.created_at,
        profile: l.user_profiles,
        wishlist_title: wishlists.find((w: any) => w.id === l.wishlist_id)?.title || "Wishlist",
      }));

      const commentActivities = (comments || []).map((c: any) => ({
        type: "comment",
        id: `comment-${c.id}`,
        user_id: c.user_id,
        wishlist_id: c.wishlist_id,
        content: c.content,
        created_at: c.created_at,
        profile: c.user_profiles,
        wishlist_title: wishlists.find((w: any) => w.id === c.wishlist_id)?.title || "Wishlist",
      }));

      return [...likeActivities, ...commentActivities].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
    },
  });

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
                  <span className="relative flex shrink-0 overflow-hidden rounded-full h-16 w-16 ring-2 ring-white/80">
                    <img className="h-full w-full object-cover" src={r.user_profiles?.avatar_url || "/avatar.svg"} alt={r.user_profiles?.full_name || r.user_profiles?.username || "user"} />
                  </span>
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

          if (filteredActivities.length === 0 && (pendingFollowData as any[]).length === 0) {
            return (
              <div className="rounded-2xl bg-white/70 backdrop-blur ring-1 ring-white/70 p-3 text-sm text-muted-foreground">
                {t('notifications.all_caught_up', "You're all caught up.")}
              </div>
            );
          }

          return filteredActivities.map((a: any) => {
            // Render social activity (likes/comments)
            if (a.type === "like" || a.type === "comment") {
              const prof = a.profile;
              const name = prof?.full_name || prof?.username || "User";
              const timeAgo = formatDistanceToNow(new Date(a.created_at), { addSuffix: true });

              return (
                <div key={a.id} className="flex items-start gap-3 rounded-2xl bg-white/80 backdrop-blur ring-1 ring-white/70 shadow-[0_18px_40px_rgba(0,0,0,0.06)] p-3">
                  <Avatar className="h-9 w-9 mt-0.5">
                    <AvatarImage src={prof?.avatar_url || ""} />
                    <AvatarFallback className="text-xs bg-gradient-to-br from-[hsl(var(--brand-cool-start))] via-[hsl(var(--brand-cool-end))] to-[hsl(var(--brand-warm-end))] text-white">
                      {name.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      {a.type === "like" ? (
                        <Heart className="h-4 w-4 text-[#be123c] fill-[#be123c]" />
                      ) : (
                        <MessageCircle className="h-4 w-4 text-blue-600" />
                      )}
                      <span className="font-semibold truncate">{name}</span>
                      <span className="text-sm text-muted-foreground">
                        {a.type === "like"
                          ? t("notifications.liked_your_wishlist", "liked your wishlist")
                          : t("notifications.commented_on_wishlist", "commented on your wishlist")}
                      </span>
                    </div>
                    <div className="text-xs text-muted-foreground truncate mt-0.5">
                      {a.wishlist_title}
                    </div>
                    {a.type === "comment" && a.content && (
                      <div className="text-sm text-foreground mt-1 line-clamp-2">"{a.content}"</div>
                    )}
                    <div className="text-xs text-muted-foreground mt-1">{timeAgo}</div>
                  </div>
                </div>
              );
            }

            // Render follow activity (existing code)
            return (
            <div key={a.id} className="flex items-center justify-between rounded-2xl bg-white/80 backdrop-blur ring-1 ring-white/70 shadow-[0_18px_40px_rgba(0,0,0,0.06)] p-3">
              <div className="flex items-center gap-3 min-w-0">
                {a.user_profiles ? (
                  <span className="relative flex shrink-0 overflow-hidden rounded-full h-9 w-9 ring-2 ring-white/80">
                    <img
                      className="h-full w-full object-cover"
                      src={a.user_profiles.avatar_url || "/avatar.svg"}
                      alt={a.user_profiles.full_name || a.user_profiles.username || "user"}
                    />
                  </span>
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
                  <div className="text-xs text-muted-foreground">
                    {(() => {
                      const d = new Date(a.created_at);
                      if (i18n.language === 'ar') {
                        return d.toLocaleString('ar-EG', { dateStyle: 'short', timeStyle: 'short' });
                      }
                      return d.toLocaleString();
                    })()}
                  </div>
                </div>
              </div>
            </div>
            );
          });
        })()}
      </div>
    </div>
  );
};

export default Notifications;
