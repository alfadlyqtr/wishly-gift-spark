import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { ArrowLeft, Shield, Trash2, Smartphone, Globe2, Bell } from "lucide-react";
import BackButton from "@/components/BackButton";
import { toast } from "sonner";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { acceptFollowRequest, declineFollowRequest } from "@/lib/follow";

const Settings = () => {
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();

  const [newPassword, setNewPassword] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);

  const [newEmail, setNewEmail] = useState("");
  const [changingEmail, setChangingEmail] = useState(false);

  const [notifications, setNotifications] = useState<boolean>(true);
  const [visibility, setVisibility] = useState<"public" | "private">("public");
  const [loadingVisibility, setLoadingVisibility] = useState<boolean>(false);
  const [savingPrefs, setSavingPrefs] = useState(false);
  const [visibilitySupported, setVisibilitySupported] = useState<boolean>(true);
  const [followMode, setFollowMode] = useState<"open" | "approval">("open");
  const [followSupported, setFollowSupported] = useState<boolean>(true);
  const [loadingFollow, setLoadingFollow] = useState<boolean>(false);

  // Wishlist preferences
  const [allowSharing, setAllowSharing] = useState<boolean>(true);
  const [allowFriendsClaim, setAllowFriendsClaim] = useState<boolean>(true);
  const [showCountdown, setShowCountdown] = useState<boolean>(true);
  const [savingWishlistPrefs, setSavingWishlistPrefs] = useState<boolean>(false);

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPassword || newPassword.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }
    try {
      setChangingPassword(true);
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      toast.success("Password updated");
      setNewPassword("");
    } catch (err: any) {
      toast.error(err?.message || "Failed to change password");
    } finally {
      setChangingPassword(false);
    }
  };

  const saveWishlistPrefs = async (changes?: Partial<{ allow_wishlist_sharing: boolean; allow_friends_claim: boolean; show_countdown_timer: boolean }>) => {
    try {
      setSavingWishlistPrefs(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error("Not authenticated");
        return;
      }
      const payload: any = {
        allow_wishlist_sharing: allowSharing,
        allow_friends_claim: allowFriendsClaim,
        show_countdown_timer: showCountdown,
        ...(changes || {})
      };
      const { error } = await (supabase as any)
        .from('user_profiles')
        .update(payload)
        .eq('id', user.id);
      if (error) throw error;
      toast.success(t('settings.wishlist_prefs_saved','Wishlist preferences saved'));
    } catch (e: any) {
      toast.error(e?.message || 'Failed to save wishlist preferences (ask to add columns: allow_wishlist_sharing:boolean, allow_friends_claim:boolean, show_countdown_timer:boolean)');
    } finally {
      setSavingWishlistPrefs(false);
    }
  };

  // Pending follow requests addressed to current user
  const queryClient = useQueryClient();
  const pendingRequests = useQuery({
    queryKey: ["settings", "pending_follows"],
    queryFn: async () => {
      const { data: auth } = await supabase.auth.getUser();
      const me = auth.user?.id;
      if (!me) return [] as any[];
      const { data, error } = await (supabase as any)
        .from("followers")
        .select(
          "user_id, created_at, user_profiles!followers_user_id_fkey(id, username, full_name, avatar_url)"
        )
        .eq("following_id", me)
        .eq("status", "pending")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const approveMutation = useMutation({
    mutationFn: async (fromUserId: string) => acceptFollowRequest(fromUserId),
    onSuccess: () => {
      toast.success(t("settings.follow_request_approved", "Request approved"));
      queryClient.invalidateQueries({ queryKey: ["settings", "pending_follows"] });
      queryClient.invalidateQueries({ queryKey: ["profile", "social"] });
    },
    onError: (e: any) => toast.error(e?.message || "Failed to approve"),
  });

  const declineMutation = useMutation({
    mutationFn: async (fromUserId: string) => declineFollowRequest(fromUserId),
    onSuccess: () => {
      toast.success(t("settings.follow_request_declined", "Request declined"));
      queryClient.invalidateQueries({ queryKey: ["settings", "pending_follows"] });
    },
    onError: (e: any) => toast.error(e?.message || "Failed to decline"),
  });

  // Load initial visibility from profile
  useEffect(() => {
    (async () => {
      try {
        setLoadingVisibility(true);
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        const { data, error } = await (supabase as any)
          .from("user_profiles")
          .select("is_searchable, require_follow_approval, allow_wishlist_sharing, allow_friends_claim, show_countdown_timer")
          .eq("id", user.id)
          .single();
        if (!error && data) {
          setVisibility(data.is_searchable ? "public" : "private");
          setVisibilitySupported(true);
          if (typeof data.require_follow_approval === 'boolean') {
            setFollowMode(data.require_follow_approval ? "approval" : "open");
            setFollowSupported(true);
          } else {
            setFollowSupported(false);
          }
          if (typeof (data as any).allow_wishlist_sharing === 'boolean') setAllowSharing((data as any).allow_wishlist_sharing);
          if (typeof (data as any).allow_friends_claim === 'boolean') setAllowFriendsClaim((data as any).allow_friends_claim);
          if (typeof (data as any).show_countdown_timer === 'boolean') setShowCountdown((data as any).show_countdown_timer);
        } else if (error) {
          setVisibilitySupported(false);
          setFollowSupported(false);
        }
      } finally {
        setLoadingVisibility(false);
      }
    })();
  }, []);

  // Persist visibility on change
  const saveVisibility = async (next: "public" | "private") => {
    try {
      setVisibility(next);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error("Not authenticated");
        return;
      }
      const { error } = await (supabase as any)
        .from("user_profiles")
        .update({ is_searchable: next === "public" })
        .eq("id", user.id);
      if (error) throw error;
      toast.success(next === "public" ? t("settings.profile_public", "Profile set to public") : t("settings.profile_private", "Profile set to private"));
    } catch (e: any) {
      toast.error(e?.message || "Failed to save visibility (ask to add column is_searchable:boolean)");
      setVisibilitySupported(false);
    }
  };

  const saveFollowMode = async (next: "open" | "approval") => {
    try {
      setLoadingFollow(true);
      setFollowMode(next);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error("Not authenticated");
        return;
      }
      const { error } = await (supabase as any)
        .from("user_profiles")
        .update({ require_follow_approval: next === "approval" })
        .eq("id", user.id);
      if (error) throw error;
      toast.success(next === "approval" ? t("settings.follow_approval_on", "Follow requests now require approval") : t("settings.follow_approval_off", "Anyone can follow you"));
    } catch (e: any) {
      toast.error(e?.message || "Failed to save follow setting (ask to add column require_follow_approval:boolean)");
      setFollowSupported(false);
    } finally {
      setLoadingFollow(false);
    }
  };

  const handleChangeEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmail || !newEmail.includes("@")) {
      toast.error("Enter a valid email");
      return;
    }
    try {
      setChangingEmail(true);
      const { error } = await supabase.auth.updateUser({ email: newEmail });
      if (error) throw error;
      toast.success("Email update requested. Check your inbox to confirm.");
      setNewEmail("");
    } catch (err: any) {
      toast.error(err?.message || "Failed to change email");
    } finally {
      setChangingEmail(false);
    }
  };

  const revokeOtherSessions = async () => {
    try {
      const { error } = await supabase.auth.signOut({ scope: "others" as any });
      if (error) throw error;
      toast.success("Other sessions revoked");
    } catch (err: any) {
      toast.error(err?.message || "Failed to revoke sessions");
    }
  };

  const [deleteOpen, setDeleteOpen] = useState(false);

  const doDeleteAccount = async () => {
    try {
      const { data: session } = await supabase.auth.getSession();
      const accessToken = session.session?.access_token;
      if (!accessToken) {
        toast.error("Not authenticated");
        return;
      }
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/delete-account`;
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ reason: "user_requested" }),
      });
      if (!res.ok) throw new Error(await res.text());
      toast.success("Account deletion requested. You'll be signed out.");
      await supabase.auth.signOut({ scope: "global" as any });
      navigate("/");
    } catch (err: any) {
      toast.error(err?.message || "Failed to delete account");
    } finally {
      setDeleteOpen(false);
    }
  };

  const savePreferences = async () => {
    try {
      setSavingPrefs(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error("Not authenticated");
        return;
      }
      const { error } = await supabase
        .from("user_profiles")
        .update({ receive_notifications: notifications } as any)
        .eq("id", user.id);
      if (error) throw error;
      toast.success("Preferences saved");
    } catch (err: any) {
      toast.error(err?.message || "Failed to save preferences");
    } finally {
      setSavingPrefs(false);
    }
  };

  return (
    <div className="container max-w-2xl mx-auto px-4 py-6 space-y-6">
      {/* Header with Back and Page Title */}
      <div className="flex items-center justify-start">
        <BackButton onClick={() => navigate(-1)}>{t("settings.title", "Settings")}</BackButton>
      </div>

      {/* Account Security */}
      <Card className="rounded-2xl bg-white/80 backdrop-blur ring-1 ring-white/70 border-none shadow-[0_18px_40px_rgba(0,0,0,0.06)]">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Shield className="h-4 w-4" /> {t("settings.security", "Account Security")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <form onSubmit={handleChangePassword} className="space-y-2">
            <Label htmlFor="new-pass">{t("settings.change_password", "Change Password")}</Label>
            <div className="flex gap-2">
              <Input id="new-pass" type="password" placeholder="••••••••" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="rounded-xl" />
              <Button variant="gradient" type="submit" disabled={changingPassword}>{changingPassword ? t("common.saving", "Saving...") : t("common.save", "Save")}</Button>
            </div>

          </form>

          <form onSubmit={handleChangeEmail} className="space-y-2">
            <Label htmlFor="new-email">{t("settings.change_email", "Change Email")}</Label>
            <div className="flex gap-2">
              <Input id="new-email" type="email" placeholder="you@example.com" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} className="rounded-xl" />
              <Button variant="gradient" type="submit" disabled={changingEmail}>{changingEmail ? t("common.saving", "Saving...") : t("common.save", "Save")}</Button>
            </div>
          </form>

          <div className="pt-2">
            <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
              <Button variant="destructive" className="w-full" onClick={() => setDeleteOpen(true)}>
                <Trash2 className="h-4 w-4 mr-2" /> {t("settings.delete_account", "Delete Account")}
              </Button>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{t("settings.delete_confirm_title", "Delete account?")}</DialogTitle>
                  <DialogDescription>{t("settings.delete_confirm_desc", "This action cannot be undone. All your data will be removed.")}</DialogDescription>
                </DialogHeader>
                <DialogFooter className="flex gap-2">
                  <Button variant="ghost" onClick={() => setDeleteOpen(false)}>{t("common.cancel", "Cancel")}</Button>
                  <Button variant="gradient" onClick={doDeleteAccount}>
                    <Trash2 className="h-4 w-4 mr-2" /> {t("settings.delete_account", "Delete Account")}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
            <p className="mt-2 text-xs text-muted-foreground">
              {t("settings.delete_account_note", "We’ll guide you through deleting your account safely. This action is permanent and cannot be undone.")}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Active Sessions */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Smartphone className="h-4 w-4" /> {t("settings.sessions", "Active Sessions")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">{t("settings.sessions_note", "For privacy, you can revoke other devices.")}</p>
          <Button variant="outline" onClick={revokeOtherSessions} className="rounded-xl bg-white/80 backdrop-blur ring-1 ring-white/70 border-none shadow-[0_10px_24px_rgba(0,0,0,0.04)]">
            {t("settings.revoke_others", "Sign out of other sessions")}
          </Button>
        </CardContent>
      </Card>

      {/* Preferences */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Globe2 className="h-4 w-4" /> {t("settings.preferences", "Preferences")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label className="flex items-center gap-2"><Globe2 className="h-4 w-4" /> {t("settings.language", "Language")}</Label>
            {/* Segmented control like Explore */}
            <div className="relative rounded-full p-[2px] bg-gradient-to-r from-[hsl(var(--brand-cool-start))] via-[hsl(var(--brand-cool-end))] to/[hsl(var(--brand-warm-end))] w-full max-w-md shadow-[0_12px_28px_rgba(0,0,0,0.10)]" dir="ltr">
              <div className="relative flex items-center rounded-full bg-white/70 backdrop-blur px-1 py-1 ring-1 ring-white/70 shadow-[inset_0_1px_3px_rgba(255,255,255,0.55),_0_6px_14px_rgba(0,0,0,0.06)] overflow-hidden" dir="ltr">
                <span
                  className="pointer-events-none absolute top-1 bottom-1 w-1/2 rounded-full p-[1px] bg-gradient-to-r from-[hsl(var(--brand-cool-start))]/40 via/[hsl(var(--brand-cool-end))]/35 to/[hsl(var(--brand-warm-end))]/40 transition-all duration-300 ease-out z-0"
                  style={{ left: i18n.language === 'ar' ? '0px' : 'calc(50% + 0px)' }}
                >
                  <span className="absolute inset-0 rounded-full ring-1 ring-white/60" />
                  <span className="relative block h-full w-full rounded-full bg-white/20 backdrop-blur-[2px]" />
                </span>
                <button
                  type="button"
                  onClick={() => i18n.changeLanguage("ar")}
                  className={`relative z-10 flex-1 rounded-full px-4 py-2 text-xs font-semibold ${i18n.language === 'ar' ? 'text-foreground' : 'text-muted-foreground'}`}
                >
                  العربية
                </button>
                <button
                  type="button"
                  onClick={() => i18n.changeLanguage("en")}
                  className={`relative z-10 flex-1 rounded-full px-4 py-2 text-xs font-semibold ${i18n.language === 'en' ? 'text-foreground' : 'text-muted-foreground'}`}
                >
                  English
                </button>
              </div>
            </div>
            {/* Pending approvals list */}
            <div className="mt-4 space-y-3">
              {pendingRequests.isLoading ? (
                <div className="text-sm text-muted-foreground">{t("common.loading", "Loading...")}</div>
              ) : pendingRequests.data && pendingRequests.data.length > 0 ? (
                pendingRequests.data.map((r: any) => (
                  <div key={`${r.user_id}-${r.created_at}`} className="flex items-center justify-between rounded-2xl bg-white/70 backdrop-blur ring-1 ring-white/70 p-3 shadow-[0_10px_24px_rgba(0,0,0,0.04)]">
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="relative flex shrink-0 overflow-hidden rounded-full h-10 w-10 ring-2 ring-white/80">
                        <img className="h-full w-full object-cover" src={r.user_profiles?.avatar_url || "/avatar.svg"} alt={r.user_profiles?.full_name || r.user_profiles?.username || "user"} />
                      </span>
                      <div className="leading-tight min-w-0">
                        <div className="font-semibold truncate max-w-[160px]">{r.user_profiles?.full_name || r.user_profiles?.username || r.user_id}</div>
                        <div className="text-xs text-muted-foreground truncate max-w-[200px]">{t("settings.requested_to_follow", "Requested to follow you")}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button size="sm" variant="gradient" onClick={() => approveMutation.mutate(r.user_id)} disabled={approveMutation.isPending}>
                        {t("common.approve", "Approve")}
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => declineMutation.mutate(r.user_id)} disabled={declineMutation.isPending}>
                        {t("common.decline", "Decline")}
                      </Button>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-xs text-muted-foreground">{t("settings.no_pending_requests", "No pending requests")}</div>
              )}
            </div>
          </div>
          <div className="space-y-2">
            <Label className="flex items-center gap-2"><Bell className="h-4 w-4" /> {t("settings.notifications", "Notifications")}</Label>
            <div className="flex items-center justify-between rounded-2xl bg-white/70 backdrop-blur ring-1 ring-white/70 p-3 shadow-[0_10px_24px_rgba(0,0,0,0.04)]">
              <span className="text-sm text-muted-foreground">{t("settings.notifications_desc", "Receive general updates")}</span>
              <Switch checked={notifications} onCheckedChange={setNotifications} />
            </div>
            <div className="pt-2">
              <Button variant="gradient" onClick={savePreferences} disabled={savingPrefs}>{savingPrefs ? t("common.saving", "Saving...") : t("common.save", "Save")}</Button>
            </div>
          </div>

          {/* Wishlist Sharing (moved under Preferences) */}
          <div className="space-y-2 pt-2">
            <Label className="flex items-center gap-2"><Globe2 className="h-4 w-4" /> {t('settings.wishlist_sharing','Wishlist & Sharing')}</Label>
            <div className="space-y-2">
              <div className="flex items-center justify-between rounded-2xl bg-white/70 backdrop-blur ring-1 ring-white/70 p-3 shadow-[0_10px_24px_rgba(0,0,0,0.04)]">
                <span className="text-sm text-muted-foreground">{t('settings.allow_sharing','Show share icon on my wishlist cards')}</span>
                <Switch checked={allowSharing} onCheckedChange={(v)=>{ setAllowSharing(v); }} />
              </div>
              <div className="flex items-center justify-between rounded-2xl bg-white/70 backdrop-blur ring-1 ring-white/70 p-3 shadow-[0_10px_24px_rgba(0,0,0,0.04)]">
                <span className="text-sm text-muted-foreground">{t('settings.allow_friends_claim','Allow friends to claim items')}</span>
                <Switch checked={allowFriendsClaim} onCheckedChange={(v)=>{ setAllowFriendsClaim(v); }} />
              </div>
              <div className="flex items-center justify-between rounded-2xl bg-white/70 backdrop-blur ring-1 ring-white/70 p-3 shadow-[0_10px_24px_rgba(0,0,0,0.04)]">
                <span className="text-sm text-muted-foreground">{t('settings.show_countdown','Show countdown timer on shared page')}</span>
                <Switch checked={showCountdown} onCheckedChange={(v)=>{ setShowCountdown(v); }} />
              </div>
            </div>
            <div className="pt-2">
              <Button variant="gradient" onClick={()=>saveWishlistPrefs()} disabled={savingWishlistPrefs}>{savingWishlistPrefs ? t('common.saving','Saving...') : t('common.save','Save')}</Button>
            </div>
          </div>

          {/* Profile visibility */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2"><Shield className="h-4 w-4" /> {t("settings.profile_visibility", "Profile Visibility")}</Label>
            <p className="text-xs text-muted-foreground">{t("settings.profile_visibility_desc", "If public, people can find your profile in Explore search.")}</p>
            <div className="relative rounded-full p-[2px] bg-gradient-to-r from-[hsl(var(--brand-cool-start))] via-[hsl(var(--brand-cool-end))] to-[hsl(var(--brand-warm-end))] w-full max-w-md shadow-[0_12px_28px_rgba(0,0,0,0.10)]">
              <div className="relative flex items-center rounded-full bg-white/70 backdrop-blur px-1 py-1 ring-1 ring-white/70 shadow-[inset_0_1px_3px_rgba(255,255,255,0.55),_0_6px_14px_rgba(0,0,0,0.06)] overflow-hidden">
                <span
                  className="pointer-events-none absolute top-1 bottom-1 w-1/2 rounded-full p-[1px] bg-gradient-to-r from-[hsl(var(--brand-cool-start))]/40 via-[hsl(var(--brand-cool-end))]/35 to-[hsl(var(--brand-warm-end))]/40 transition-all duration-300 ease-out z-0"
                  style={{ left: visibility === 'private' ? '0px' : 'calc(50% + 0px)' }}
                >
                  <span className="absolute inset-0 rounded-full ring-1 ring-white/60" />
                  <span className="relative block h-full w-full rounded-full bg-white/20 backdrop-blur-[2px]" />
                </span>
                <button
                  type="button"
                  onClick={() => saveVisibility("private")}
                  disabled={loadingVisibility}
                  className={`relative z-10 flex-1 rounded-full px-4 py-2 text-xs font-semibold ${visibility === 'private' ? 'text-foreground' : 'text-muted-foreground'}`}
                >
                  {t("settings.private", "Private")}
                </button>
                <button
                  type="button"
                  onClick={() => saveVisibility("public")}
                  disabled={loadingVisibility}
                  className={`relative z-10 flex-1 rounded-full px-4 py-2 text-xs font-semibold ${visibility === 'public' ? 'text-foreground' : 'text-muted-foreground'}`}
                >
                  {t("settings.public", "Public")}
                </button>
              </div>
            </div>
            <div className="space-y-2 pt-4">
              <Label className="flex items-center gap-2"><Shield className="h-4 w-4" /> {t("settings.follow_requests", "Follow Requests")}</Label>
              <p className="text-xs text-muted-foreground">{t("settings.follow_requests_desc", "Choose whether followers need your approval.")}</p>
              <div className="relative rounded-full p-[2px] bg-gradient-to-r from-[hsl(var(--brand-cool-start))] via-[hsl(var(--brand-cool-end))] to-[hsl(var(--brand-warm-end))] w-full max-w-md shadow-[0_12px_28px_rgba(0,0,0,0.10)]">
                <div className="relative flex items-center rounded-full bg-white/70 backdrop-blur px-1 py-1 ring-1 ring-white/70 shadow-[inset_0_1px_3px_rgba(255,255,255,0.55),_0_6px_14px_rgba(0,0,0,0.06)] overflow-hidden">
                  <span
                    className="pointer-events-none absolute top-1 bottom-1 w-1/2 rounded-full p-[1px] bg-gradient-to-r from-[hsl(var(--brand-cool-start))]/40 via-[hsl(var(--brand-cool-end))]/35 to-[hsl(var(--brand-warm-end))]/40 transition-all duration-300 ease-out z-0"
                    style={{ left: followMode === 'approval' ? '0px' : 'calc(50% + 0px)' }}
                  >
                    <span className="absolute inset-0 rounded-full ring-1 ring-white/60" />
                    <span className="relative block h-full w-full rounded-full bg-white/20 backdrop-blur-[2px]" />
                  </span>
                  <button
                    type="button"
                    onClick={() => saveFollowMode('approval')}
                    disabled={loadingFollow}
                    className={`relative z-10 flex-1 rounded-full px-4 py-2 text-xs font-semibold ${followMode === 'approval' ? 'text-foreground' : 'text-muted-foreground'}`}
                  >
                    {t("settings.approval_required", "Approval required")}
                  </button>
                  <button
                    type="button"
                    onClick={() => saveFollowMode('open')}
                    disabled={loadingFollow}
                    className={`relative z-10 flex-1 rounded-full px-4 py-2 text-xs font-semibold ${followMode === 'open' ? 'text-foreground' : 'text-muted-foreground'}`}
                  >
                    {t("settings.anyone_can_follow", "Anyone can follow")}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Settings;
