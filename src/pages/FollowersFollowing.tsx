import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import BackButton from "@/components/BackButton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card } from "@/components/ui/card";
import { useTranslation } from "react-i18next";

interface FollowerRow {
  id: string;
  user_id: string;
  following_id: string;
  status: string | null;
}

const FollowersFollowing = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const initialTab = (searchParams.get("tab") as "followers" | "following" | null) ?? "followers";
  const [tab, setTab] = useState<"followers" | "following">(initialTab);

  const { data: authData } = useQuery({
    queryKey: ["auth-user-for-followers"],
    queryFn: async () => {
      const { data } = await supabase.auth.getUser();
      return data.user ?? null;
    },
  });

  const uid = authData?.id ?? null;

  const { data: lists, isLoading } = useQuery({
    queryKey: ["followers-following-list", uid],
    enabled: !!uid,
    queryFn: async () => {
      if (!uid) return { followers: [] as FollowerRow[], following: [] as FollowerRow[] };

      const [followersRes, followingRes] = await Promise.all([
        supabase
          .from("followers")
          .select("id,user_id,following_id,status")
          .eq("following_id", uid)
          .eq("status", "accepted"),
        supabase
          .from("followers")
          .select("id,user_id,following_id,status")
          .eq("user_id", uid)
          .eq("status", "accepted"),
      ]);

      if (followersRes.error) throw followersRes.error;
      if (followingRes.error) throw followingRes.error;

      return {
        followers: (followersRes.data as FollowerRow[]) ?? [],
        following: (followingRes.data as FollowerRow[]) ?? [],
      };
    },
  });

  const followers = lists?.followers ?? [];
  const following = lists?.following ?? [];

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
                        followers.map((row) => (
                          <div key={row.id} className="px-4 py-3 flex items-center gap-3">
                            <Avatar className="h-9 w-9">
                              <AvatarImage src={undefined} alt="" />
                              <AvatarFallback>{row.user_id.slice(0, 2).toUpperCase()}</AvatarFallback>
                            </Avatar>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">{row.user_id}</p>
                              <p className="text-[11px] opacity-70">{t("followers.follows_you", "Follows you")}</p>
                            </div>
                          </div>
                        ))
                      )
                    ) : following.length === 0 ? (
                      <div className="px-4 py-3 text-sm opacity-80">{emptyText}</div>
                    ) : (
                      following.map((row) => (
                        <div key={row.id} className="px-4 py-3 flex items-center gap-3">
                          <Avatar className="h-9 w-9">
                            <AvatarImage src={undefined} alt="" />
                            <AvatarFallback>{row.following_id.slice(0, 2).toUpperCase()}</AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{row.following_id}</p>
                            <p className="text-[11px] opacity-70">{t("followers.you_follow", "You follow")}</p>
                          </div>
                        </div>
                      ))
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
