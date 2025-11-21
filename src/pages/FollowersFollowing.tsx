import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import BackButton from "@/components/BackButton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card } from "@/components/ui/card";
import { useTranslation } from "react-i18next";
import { cancelFollow, removeFollower, requestFollow, FollowStatus } from "@/lib/follow";
import { toast } from "sonner";

interface ProfilePreview {
  id: string;
  username: string | null;
  full_name: string | null;
  email: string | null;
  avatar_url: string | null;
}

interface ConnectionRow {
  id: string;
  fallbackId: string;
  profile: ProfilePreview | null;
  status: FollowStatus | null;
}

const FollowersFollowing = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const initialTab = (searchParams.get("tab") as "followers" | "following" | null) ?? "followers";
  const [tab, setTab] = useState<"followers" | "following">(initialTab);

  const queryClient = useQueryClient();

  const { data: authData } = useQuery({
    queryKey: ["auth-user-for-followers"],
    queryFn: async () => {
      const { data } = await supabase.auth.getUser();
      return data.user ?? null;
    },
  });

  const cancelRequestMutation = useMutation({
    mutationFn: (targetId: string) => cancelFollow(targetId),
    onSuccess: () => {
      invalidateConnections();
      toast.success(t("followers.request_canceled", "Follow request canceled."));
    },
    onError: (error: any) => toast.error(error?.message || t("common.error", "Something went wrong")),
  });

  const uid = authData?.id ?? null;

  const { data: lists, isLoading } = useQuery({
    queryKey: ["followers-following-list", uid],
    enabled: !!uid,
    queryFn: async () => {
      if (!uid) return { followers: [] as ConnectionRow[], following: [] as ConnectionRow[] };

      const followerSelect = "id,user_id,following_id,status,user_profiles!followers_user_id_fkey(id,username,full_name,email,avatar_url)";
      const followingSelect = "id,user_id,following_id,status,user_profiles!followers_following_id_fkey(id,username,full_name,email,avatar_url)";

      const [followersRes, followingRes] = await Promise.all([
        supabase
          .from("followers")
          .select(followerSelect)
          .eq("following_id", uid)
          .eq("status", "accepted"),
        supabase
          .from("followers")
          .select(followingSelect)
          .eq("user_id", uid)
          .in("status", ["pending", "accepted"]),
      ]);

      if (followersRes.error) throw followersRes.error;
      if (followingRes.error) throw followingRes.error;

      const followersData = ((followersRes.data as any[]) ?? []).map((row) => ({
        id: row.id as string,
        fallbackId: row.user_id as string,
        profile: (row.user_profiles ?? null) as ProfilePreview | null,
        status: (row.status as FollowStatus) ?? null,
      }));

      const followingData = ((followingRes.data as any[]) ?? []).map((row) => ({
        id: row.id as string,
        fallbackId: row.following_id as string,
        profile: (row.user_profiles ?? null) as ProfilePreview | null,
        status: (row.status as FollowStatus) ?? null,
      }));

      return {
        followers: followersData,
        following: followingData,
      };
    },
  });

  const followers: ConnectionRow[] = lists?.followers ?? [];
  const allFollowing: ConnectionRow[] = lists?.following ?? [];
  const following: ConnectionRow[] = allFollowing.filter((row) => row.status === "accepted");
  const followingStatusMap = useMemo(() => {
    const map = new Map<string, FollowStatus | null>();
    allFollowing.forEach((row) => {
      map.set(row.fallbackId, row.status ?? null);
    });
    return map;
  }, [allFollowing]);

  const invalidateConnections = () => {
    queryClient.invalidateQueries({ queryKey: ["followers-following-list", uid] });
  };

  const unfollowMutation = useMutation({
    mutationFn: (targetId: string) => cancelFollow(targetId),
    onSuccess: () => {
      invalidateConnections();
      toast.success(t("followers.unfollowed", "You unfollowed this user."));
    },
    onError: (error: any) => toast.error(error?.message || t("common.error", "Something went wrong")),
  });

  const removeFollowerMutation = useMutation({
    mutationFn: (followerId: string) => removeFollower(followerId),
    onSuccess: () => {
      invalidateConnections();
      toast.success(t("followers.removed", "Follower removed."));
    },
    onError: (error: any) => toast.error(error?.message || t("common.error", "Something went wrong")),
  });

  const followBackMutation = useMutation({
    mutationFn: (targetId: string) => requestFollow(targetId),
    onSuccess: () => {
      invalidateConnections();
      toast.success(t("followers.follow_back_success", "Follow request sent (awaiting approval)."));
    },
    onError: (error: any) => {
      const message = String(error?.message || "").toLowerCase();
      if (message.includes("duplicate key")) {
        invalidateConnections();
        toast.info(t("followers.already_requested", "Already requested."));
        return;
      }
      toast.error(error?.message || t("common.error", "Something went wrong"));
    },
  });

  const emptyText = useMemo(() => {
    return tab === "followers"
      ? t("followers.empty_followers", "No followers yet")
      : t("followers.empty_following", "Not following anyone yet");
  }, [tab, t]);

  return (
    <div className="container max-w-2xl mx-auto px-4 py-6 space-y-4">
      <div className="flex items-center gap-2">
        <BackButton onClick={() => navigate(-1)}>{t("followers.back", "Back")}</BackButton>
      </div>

      <div className="mx-auto mt-6 w-full max-w-[420px]">
        <div className="wl-card w-full">
          <div className="wl-card-surface p-5 text-white" style={{ alignItems: "flex-start", justifyContent: "flex-start" }}>
            <div className="w-full space-y-4">
              <div className="flex items-baseline justify-between">
                <h2 className="text-2xl font-extrabold wl-card-title">{t("followers.title", "Connections")}</h2>
                <p className="text-xs opacity-80">
                  {t("followers.subtitle", "Followers & Following")}
                </p>
              </div>

              {/* Segmented control styled like Explore page */}
              <div className="w-full">
                <div className="relative mx-auto mt-2 rounded-full p-[2px] bg-gradient-to-r from-[hsl(var(--brand-cool-start))] via-[hsl(var(--brand-cool-end))] to-[hsl(var(--brand-warm-end))] shadow-[0_12px_28px_rgba(0,0,0,0.10)]">
                  <div className="relative flex items-center rounded-full bg-white/70 backdrop-blur px-1 py-1 ring-1 ring-white/70 shadow-[inset_0_1px_3px_rgba(255,255,255,0.55),_0_6px_14px_rgba(0,0,0,0.06)] overflow-hidden">
                    <span className="pointer-events-none absolute inset-x-6 -top-1 h-5 rounded-full bg-white/60 blur-md opacity-60" />
                    {/* Sliding glass highlight */}
                    <span
                      className="pointer-events-none absolute top-1 bottom-1 w-1/2 rounded-full p-[1px] bg-gradient-to-r from-[hsl(var(--brand-cool-start))]/40 via-[hsl(var(--brand-cool-end))]/35 to-[hsl(var(--brand-warm-end))]/40 shadow-[0_6px_16px_rgba(200,80,192,0.14)] transition-all duration-300 ease-out z-0"
                      style={{ left: tab === "following" ? "calc(50% + 0px)" : "0px" }}
                    >
                      <span className="absolute inset-0 rounded-full ring-1 ring-white/60" />
                      <span className="relative block h-full w-full rounded-full bg-white/20 backdrop-blur-[2px] shadow-[inset_0_1px_3px_rgba(255,255,255,0.6),_0_4px_10px_rgba(0,0,0,0.06)]" />
                    </span>
                    <button
                      type="button"
                      onClick={() => setTab("followers")}
                      className={`relative z-10 flex-1 rounded-full px-4 py-2 text-xs font-semibold transition-colors duration-200 flex items-center justify-center gap-1 ${
                        tab === "followers" ? "text-foreground" : "text-muted-foreground"
                      }`}
                      aria-pressed={tab === "followers"}
                    >
                      <span>{t("followers.followers_tab", "Followers")}</span>
                      <span className="text-[11px] opacity-80">({followers.length})</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setTab("following")}
                      className={`relative z-10 flex-1 rounded-full px-4 py-2 text-xs font-semibold transition-colors duration-200 flex items-center justify-center gap-1 ${
                        tab === "following" ? "text-foreground" : "text-muted-foreground"
                      }`}
                      aria-pressed={tab === "following"}
                    >
                      <span>{t("followers.following_tab", "Following")}</span>
                      <span className="text-[11px] opacity-80">({following.length})</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Lists below segmented control */}
              <div className="mt-4">
                <Card className="bg-white/5 border-white/10 text-white max-h-[360px] overflow-y-auto">
                  <div className="divide-y divide-white/10">
                    {isLoading ? (
                      <div className="px-4 py-3 text-sm opacity-80">{t("followers.loading", "Loading...")}</div>
                    ) : tab === "followers" ? (
                      followers.length === 0 ? (
                        <div className="px-4 py-3 text-sm opacity-80">{emptyText}</div>
                      ) : (
                        followers.map((row) => {
                          const profile = row.profile;
                          const displayName = profile?.full_name || profile?.username || row.fallbackId;
                          const identity = profile?.username
                            ? `@${profile.username}${profile.email ? ` · ${profile.email}` : ""}`
                            : profile?.email || "";
                          const existingStatus = followingStatusMap.get(row.fallbackId);
                          const isAlreadyFollowing = existingStatus === "accepted";
                          const isPendingFollow = existingStatus === "pending";
                          return (
                            <div key={row.id} className="connections-row px-4 py-3 flex items-center gap-4">
                              <Avatar className="h-14 w-14">
                                <AvatarImage src={profile?.avatar_url || undefined} alt={displayName || "avatar"} />
                                <AvatarFallback>{displayName?.slice(0, 2).toUpperCase() || "--"}</AvatarFallback>
                              </Avatar>
                              <div className="flex-1 min-w-0">
                                <p className="connections-name text-base font-semibold truncate">{displayName}</p>
                                {identity && (
                                  <p className="connections-identity text-[12px] opacity-70 truncate">{identity}</p>
                                )}
                              </div>
                              <div className="shrink-0 connections-action-btn-wrapper">
                                {isAlreadyFollowing ? (
                                  <button
                                    type="button"
                                    className="connections-action-btn connections-action-btn--primary"
                                    disabled
                                  >
                                    <span className="connections-fold" aria-hidden="true" />
                                    <span className="connections-points" aria-hidden="true">
                                      {Array.from({ length: 10 }).map((_, idx) => (
                                        <span key={idx} className="connections-point" />
                                      ))}
                                    </span>
                                    <span className="connections-inner">{t("followers.following", "Following")}</span>
                                  </button>
                                ) : isPendingFollow ? (
                                  <button
                                    type="button"
                                    className="connections-action-btn connections-action-btn--primary"
                                    onClick={() => cancelRequestMutation.mutate(row.fallbackId)}
                                    disabled={cancelRequestMutation.isPending}
                                  >
                                    <span className="connections-fold" aria-hidden="true" />
                                    <span className="connections-points" aria-hidden="true">
                                      {Array.from({ length: 10 }).map((_, idx) => (
                                        <span key={idx} className="connections-point" />
                                      ))}
                                    </span>
                                    <span className="connections-inner">{t("followers.cancel_request", "Cancel request")}</span>
                                  </button>
                                ) : (
                                  <button
                                    type="button"
                                    className="connections-action-btn connections-action-btn--primary"
                                    onClick={() => followBackMutation.mutate(row.fallbackId)}
                                    disabled={followBackMutation.isPending}
                                  >
                                    <span className="connections-fold" aria-hidden="true" />
                                    <span className="connections-points" aria-hidden="true">
                                      {Array.from({ length: 10 }).map((_, idx) => (
                                        <span key={idx} className="connections-point" />
                                      ))}
                                    </span>
                                    <span className="connections-inner">{t("followers.follow_back", "Follow back")}</span>
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })
                      )
                    ) : following.length === 0 ? (
                      <div className="px-4 py-3 text-sm opacity-80">{emptyText}</div>
                    ) : (
                      following.map((row) => {
                        const profile = row.profile;
                        const displayName = profile?.full_name || profile?.username || row.fallbackId;
                        const identity = profile?.username
                          ? `@${profile.username}${profile.email ? ` · ${profile.email}` : ""}`
                          : profile?.email || "";
                        return (
                          <div key={row.id} className="connections-row px-4 py-3 flex items-center gap-4">
                            <Avatar className="h-14 w-14">
                              <AvatarImage src={profile?.avatar_url || undefined} alt={displayName || "avatar"} />
                              <AvatarFallback>{displayName?.slice(0, 2).toUpperCase() || "--"}</AvatarFallback>
                            </Avatar>
                            <div className="flex-1 min-w-0">
                              <p className="connections-name text-base font-semibold truncate">{displayName}</p>
                              {identity && (
                                <p className="connections-identity text-[12px] opacity-70 truncate">{identity}</p>
                              )}
                            </div>
                            <div className="shrink-0 connections-action-btn-wrapper">
                              <button
                                type="button"
                                className="connections-action-btn connections-action-btn--primary"
                                onClick={() => unfollowMutation.mutate(row.fallbackId)}
                                disabled={unfollowMutation.isPending}
                              >
                                <span className="connections-fold" aria-hidden="true" />
                                <span className="connections-points" aria-hidden="true">
                                  {Array.from({ length: 10 }).map((_, idx) => (
                                    <span key={idx} className="connections-point" />
                                  ))}
                                </span>
                                <span className="connections-inner">{t("followers.unfollow", "Unfollow")}</span>
                              </button>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </Card>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FollowersFollowing;
