import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import BackButton from "@/components/BackButton";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { acceptFollowRequest, declineFollowRequest } from "@/lib/follow";
import { useTranslation } from "react-i18next";

const Notifications = () => {
  const [uid, setUid] = useState<string | null>(null);
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getUser().then(({ data }) => setUid(data.user?.id ?? null));
  }, []);

  const { data = [], isLoading } = useQuery({
    queryKey: ["activities", uid],
    enabled: !!supabase && !!uid,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("activities")
        .select("id, activity_type, target_id, created_at")
        .eq("user_id", uid as string)
        .order("created_at", { ascending: false })
        .limit(30);
      if (error) throw error;
      return data || [];
    },
  });

  const queryClient = useQueryClient();
  const { data: pendingFollowData = [], isLoading: pendingLoading } = useQuery({
    queryKey: ["notifications", "pending_follows", uid],
    enabled: !!supabase && !!uid,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("followers")
        .select("user_id, created_at, user_profiles!followers_user_id_fkey(id, username, full_name, avatar_url)")
        .eq("following_id", uid as string)
        .eq("status", "pending")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const approve = useMutation({
    mutationFn: (fromUserId: string) => acceptFollowRequest(fromUserId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications", "pending_follows"] });
      queryClient.invalidateQueries({ queryKey: ["profile", "social"] });
    },
  });
  const decline = useMutation({
    mutationFn: (fromUserId: string) => declineFollowRequest(fromUserId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications", "pending_follows"] });
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

      {/* Approvals Section */}
      <div className="space-y-2">
        <div className="rounded-2xl bg-white/80 backdrop-blur ring-1 ring-white/70 shadow-[0_18px_40px_rgba(0,0,0,0.06)] p-3">
          <div className="font-bold mb-2">{t('notifications.follow_requests_title', 'Follow Requests')}</div>
          {pendingLoading ? (
            <div className="text-sm text-muted-foreground">{t('common.loading', 'Loading...')}</div>
          ) : (pendingFollowData as any[]).length === 0 ? (
            <div className="text-xs text-muted-foreground">{t('notifications.no_pending_requests', 'No pending requests')}</div>
          ) : (
            (pendingFollowData as any[]).map((r: any) => (
              <div key={`${r.user_id}-${r.created_at}`} className="flex items-center justify-between rounded-xl bg-white/70 backdrop-blur ring-1 ring-white/70 p-2 mb-2">
                <div className="flex items-center gap-3 min-w-0">
                  <span className="relative flex shrink-0 overflow-hidden rounded-full h-9 w-9 ring-2 ring-white/80">
                    <img className="h-full w-full object-cover" src={r.user_profiles?.avatar_url || "/avatar.svg"} alt={r.user_profiles?.full_name || r.user_profiles?.username || "user"} />
                  </span>
                  <div className="leading-tight min-w-0">
                    <div className="font-semibold truncate max-w-[160px]">{r.user_profiles?.full_name || r.user_profiles?.username || r.user_id}</div>
                    <div className="text-xs text-muted-foreground truncate max-w-[200px]">{t('notifications.requested_to_follow_you', 'Requested to follow you')}</div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button size="sm" variant="gradient" onClick={() => approve.mutate(r.user_id)} disabled={approve.isPending}>{t('notifications.approve', 'Approve')}</Button>
                  <Button size="sm" variant="ghost" onClick={() => decline.mutate(r.user_id)} disabled={decline.isPending}>{t('notifications.decline', 'Decline')}</Button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Activity Feed */}
        {isLoading ? (
          <div className="rounded-2xl bg-white/70 backdrop-blur ring-1 ring-white/70 p-3 text-sm text-muted-foreground">{t('common.loading', 'Loading...')}</div>
        ) : (data as any[]).length === 0 ? (
          <div className="rounded-2xl bg-white/70 backdrop-blur ring-1 ring-white/70 p-3 text-sm text-muted-foreground">{t('notifications.all_caught_up', "You're all caught up.")}</div>
        ) : (
          (data as any[]).map((a: any) => (
            <div key={a.id} className="flex items-center justify-between rounded-2xl bg-white/80 backdrop-blur ring-1 ring-white/70 shadow-[0_18px_40px_rgba(0,0,0,0.06)] p-3">
              <div className="min-w-0">
                <div className="font-medium truncate">{a.activity_type?.replaceAll('_', ' ') || t('notifications.activity_update', 'Update')}</div>
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
          ))
        )}
      </div>
    </div>
  );
};

export default Notifications;
