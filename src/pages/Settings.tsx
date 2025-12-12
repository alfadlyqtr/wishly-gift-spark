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
import { ArrowLeft, Shield, Trash2, Smartphone, Globe2, Bell, Mail, Send, Loader2, CheckCircle, ChevronDown } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
  const [country, setCountry] = useState<string>("");
  const [savingCountry, setSavingCountry] = useState<boolean>(false);
  const [visibilitySupported, setVisibilitySupported] = useState<boolean>(true);
  const [followMode, setFollowMode] = useState<"open" | "approval">("open");
  const [followSupported, setFollowSupported] = useState<boolean>(true);
  const [loadingFollow, setLoadingFollow] = useState<boolean>(false);

  // Contact form state
  const [contactName, setContactName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactTopic, setContactTopic] = useState('');
  const [contactMessage, setContactMessage] = useState('');
  const [contactSubmitting, setContactSubmitting] = useState(false);
  const [contactSubmitted, setContactSubmitted] = useState(false);
  const [contactCooldownMs, setContactCooldownMs] = useState<number | null>(null);
  const [contactOpen, setContactOpen] = useState(false);

  const handleContactSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!contactTopic || !contactMessage) {
      toast.error(t('contact.fill_required', 'Please fill in all required fields'));
      return;
    }
    
    setContactSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();

      const finalName = contactName || (user?.user_metadata as any)?.full_name || user?.email || 'Wishly user';
      const finalEmail = (contactEmail || user?.email || '').toLowerCase();

      if (!finalEmail) {
        toast.error(t('contact.email_missing', 'We could not determine your email. Please contact support.'));
        return;
      }

      const lockKey = `wishly_contact_last_sent_${finalEmail}`;

      // DB-backed rate limit: max 1 message per 24h per email, reset when
      // all messages for that email are deleted or 24h has passed.
      let canSend = true;
      try {
        const { data: canSendData, error: canSendError } = await (supabase as any)
          .rpc('can_send_contact', { p_email: finalEmail });
        if (canSendError) {
          console.warn('Error calling can_send_contact (settings):', canSendError);
        } else if (typeof canSendData === 'boolean') {
          canSend = canSendData;
        }
      } catch (rpcErr) {
        console.warn('RPC can_send_contact failed (settings):', rpcErr);
      }

      if (!canSend) {
        toast.error(t('contact.rate_limited', 'You already sent us a message today. Please wait before sending another.'));
        if (typeof window !== 'undefined') {
          window.localStorage.setItem(lockKey, Date.now().toString());
        }
        setContactCooldownMs(24 * 60 * 60 * 1000);
        setContactSubmitting(false);
        return;
      }

      const { error } = await (supabase as any)
        .from('contact_messages')
        .insert({
          user_id: user?.id || null,
          name: finalName,
          email: finalEmail,
          topic: contactTopic,
          message: contactMessage,
          status: 'new',
        });
      
      if (error) throw error;
      
      setContactSubmitted(true);
      toast.success(t('contact.sent_success', 'Your message has been sent successfully!'));
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(lockKey, Date.now().toString());
      }
      setContactCooldownMs(24 * 60 * 60 * 1000);
      setContactTopic('');
      setContactMessage('');
      // Reset submitted state after 3 seconds
      setTimeout(() => setContactSubmitted(false), 3000);
    } catch (err: any) {
      console.error('Error submitting contact form:', err);
      toast.error(t('contact.send_failed', 'Failed to send message. Please try again.'));
    } finally {
      setContactSubmitting(false);
    }
  };

  // Prefill contact name/email from auth + profile
  useEffect(() => {
    (async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        setContactEmail((prev) => prev || user.email || '');

        const { data: profile } = await (supabase as any)
          .from('user_profiles')
          .select('full_name, username')
          .eq('id', user.id)
          .maybeSingle();

        const derivedName = (profile as any)?.full_name || (profile as any)?.username || user.email || '';
        setContactName((prev) => prev || derivedName);
      } catch (e) {
        console.warn('Failed to prefill contact name/email from profile', e);
      }
    })();
  }, []);

  // Keep a live countdown for the contact cooldown based on localStorage
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const updateCooldown = () => {
      const emailKey = (contactEmail || '').toLowerCase() || ("anonymous" as string);
      const lockKey = `wishly_contact_last_sent_${emailKey}`;
      const raw = window.localStorage.getItem(lockKey);
      if (!raw) {
        setContactCooldownMs(null);
        return;
      }
      const last = parseInt(raw, 10);
      if (Number.isNaN(last)) {
        setContactCooldownMs(null);
        return;
      }
      const remaining = last + 24 * 60 * 60 * 1000 - Date.now();
      setContactCooldownMs(remaining > 0 ? remaining : null);
    };

    updateCooldown();
    const id = window.setInterval(updateCooldown, 1000);
    return () => window.clearInterval(id);
  }, [contactEmail]);

  // Sync the local cooldown/timer with the DB-based rule so that when the admin
  // deletes all messages (or 24h passes in the DB), the timer clears and the
  // form becomes available again.
  useEffect(() => {
    const syncWithDatabase = async () => {
      try {
        const emailKey = (contactEmail || '').toLowerCase();
        if (!emailKey) return;

        const { data: canSendData, error } = await (supabase as any)
          .rpc('can_send_contact', { p_email: emailKey });
        if (error) {
          console.warn('Error syncing contact cooldown with DB (settings):', error);
          return;
        }

        if (typeof window === 'undefined') return;

        const lockKey = `wishly_contact_last_sent_${emailKey}`;
        if (canSendData === true) {
          window.localStorage.removeItem(lockKey);
          setContactCooldownMs(null);
        } else if (canSendData === false) {
          const existing = window.localStorage.getItem(lockKey);
          if (!existing) {
            window.localStorage.setItem(lockKey, Date.now().toString());
          }
        }
      } catch (e) {
        console.warn('Failed to sync contact cooldown with DB (settings):', e);
      }
    };

    syncWithDatabase();
  }, [contactEmail]);

  // Wishlist preferences
  const [allowSharing, setAllowSharing] = useState<boolean>(true);
  const [allowFriendsClaim, setAllowFriendsClaim] = useState<boolean>(true);
  const [autoApproveClaims, setAutoApproveClaims] = useState<boolean>(false);
  const [autoApproveUnclaims, setAutoApproveUnclaims] = useState<boolean>(false);
  const [showCountdown, setShowCountdown] = useState<boolean>(true);
  const [allowLikes, setAllowLikes] = useState<boolean>(true);
  const [allowComments, setAllowComments] = useState<boolean>(true);
  const [allowFollowersView, setAllowFollowersView] = useState<boolean>(false);
  const [respectPerWishlistPrivacy, setRespectPerWishlistPrivacy] = useState<boolean>(true);
  const [savingWishlistPrefs, setSavingWishlistPrefs] = useState<boolean>(false);
  const [adminMasterControl, setAdminMasterControl] = useState<boolean>(false);

  const handleAllowFollowersChange = (value: boolean) => {
    setAllowFollowersView(value);
    if (value) {
      setRespectPerWishlistPrivacy(false);
    } else {
      setRespectPerWishlistPrivacy(true);
    }
  };

  const handleRespectPrivacyChange = (value: boolean) => {
    setRespectPerWishlistPrivacy(value);
    if (value) {
      setAllowFollowersView(false);
    } else {
      setAllowFollowersView(true);
    }
  };

  // Helper to render toggle with admin control
  const renderToggle = (label: string, checked: boolean, onChange: (value: boolean) => void, disabled: boolean = false) => (
    <div className="flex flex-col">
      <div className="flex items-center justify-between rounded-2xl bg-white/70 backdrop-blur ring-1 ring-white/70 p-3 shadow-[0_10px_24px_rgba(0,0,0,0.04)]">
        <span className="text-sm text-muted-foreground">{label}</span>
        <Switch 
          checked={checked} 
          onCheckedChange={onChange} 
          disabled={disabled || adminMasterControl}
        />
      </div>
      {adminMasterControl && (
        <div className="ml-3 mt-1">
          <span className="text-xs text-amber-600 font-medium">Disabled by admin</span>
        </div>
      )}
    </div>
  );

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPassword || newPassword.length < 6) {
      toast.error(t("settings.password_min_length", "Password must be at least 6 characters"));
      return;
    }
    try {
      setChangingPassword(true);
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      toast.success(t("settings.password_updated", "Password updated"));
      setNewPassword("");
    } catch (err: any) {
      toast.error(err?.message || "Failed to change password");
    } finally {
      setChangingPassword(false);
    }
  };

  const saveCountrySetting = async () => {
    try {
      setSavingCountry(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error(t("common.not_authenticated", "Not authenticated"));
        return;
      }
      const normalized = country.trim();
      const { error } = await (supabase as any)
        .from("user_profiles")
        .update({ country: normalized || null })
        .eq("id", user.id);
      if (error) throw error;
      try {
        await supabase.auth.updateUser({
          data: { ...(user.user_metadata || {}), country: normalized || null },
        } as any);
      } catch {
        // non-fatal if metadata update fails
      }
      toast.success(t("settings.country_saved", "Country updated"));
    } catch (err: any) {
      toast.error(err?.message || "Failed to save country");
    } finally {
      setSavingCountry(false);
    }
  };

  const saveWishlistPrefs = async (changes?: Partial<{ allow_wishlist_sharing: boolean; allow_friends_claim: boolean; auto_approve_claims: boolean; auto_approve_unclaims: boolean; show_countdown_timer: boolean; allow_followers_view: boolean; enforce_wishlist_privacy: boolean; allow_likes: boolean; allow_comments: boolean }>) => {
    try {
      setSavingWishlistPrefs(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error(t("common.not_authenticated", "Not authenticated"));
        return;
      }
      const payload: any = {
        allow_wishlist_sharing: allowSharing,
        allow_friends_claim: allowFriendsClaim,
        auto_approve_claims: autoApproveClaims,
        auto_approve_unclaims: autoApproveUnclaims,
        show_countdown_timer: showCountdown,
        allow_likes: allowLikes,
        allow_comments: allowComments,
        allow_followers_view: allowFollowersView,
        enforce_wishlist_privacy: respectPerWishlistPrivacy,
        ...changes,
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
          .select("is_searchable, require_follow_approval, allow_wishlist_sharing, allow_friends_claim, auto_approve_claims, auto_approve_unclaims, show_countdown_timer, allow_likes, allow_comments, allow_followers_view, enforce_wishlist_privacy, country, admin_master_control")
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
          if (typeof (data as any).auto_approve_claims === 'boolean') setAutoApproveClaims((data as any).auto_approve_claims);
          if (typeof (data as any).auto_approve_unclaims === 'boolean') setAutoApproveUnclaims((data as any).auto_approve_unclaims);
          if (typeof (data as any).show_countdown_timer === 'boolean') setShowCountdown((data as any).show_countdown_timer);
          if (typeof (data as any).allow_likes === 'boolean') setAllowLikes((data as any).allow_likes);
          if (typeof (data as any).allow_comments === 'boolean') setAllowComments((data as any).allow_comments);

          const allowFollowersPref = typeof (data as any).allow_followers_view === 'boolean' ? (data as any).allow_followers_view : false;
          const enforcePrivacyPref = typeof (data as any).enforce_wishlist_privacy === 'boolean' ? (data as any).enforce_wishlist_privacy : !allowFollowersPref;

          if (allowFollowersPref) {
            setAllowFollowersView(true);
            setRespectPerWishlistPrivacy(false);
          } else {
            setAllowFollowersView(false);
            setRespectPerWishlistPrivacy(enforcePrivacyPref !== undefined ? enforcePrivacyPref : true);
          }
          setCountry(((data as any).country || (user.user_metadata as any)?.country || "") as string);
          setAdminMasterControl((data as any).admin_master_control === true);
        } else if (error) {
          setVisibilitySupported(false);
          setFollowSupported(false);
        }
      } finally {
        setLoadingVisibility(false);
      }
    })();
  }, []);

  // Listen for admin master control changes
  useEffect(() => {
    let adminChannel: ReturnType<typeof supabase.channel> | null = null;

    const setupAdminListener = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      adminChannel = supabase
        .channel(`admin-master-control-${user.id}`)
        .on(
          'broadcast',
          { event: 'refresh' },
          async () => {
            // Admin triggered a refresh - refetch profile data
            const { data, error } = await (supabase as any)
              .from("user_profiles")
              .select("is_searchable, require_follow_approval, allow_wishlist_sharing, allow_friends_claim, auto_approve_claims, auto_approve_unclaims, show_countdown_timer, allow_likes, allow_comments, allow_followers_view, enforce_wishlist_privacy, country, admin_master_control, receive_notifications")
              .eq("id", user.id)
              .single();
            if (!error && data) {
              // Update all states
              setVisibility(data.is_searchable ? "public" : "private");
              if (typeof data.require_follow_approval === 'boolean') {
                setFollowMode(data.require_follow_approval ? "approval" : "open");
              }
              if (typeof (data as any).allow_wishlist_sharing === 'boolean') setAllowSharing((data as any).allow_wishlist_sharing);
              if (typeof (data as any).allow_friends_claim === 'boolean') setAllowFriendsClaim((data as any).allow_friends_claim);
              if (typeof (data as any).auto_approve_claims === 'boolean') setAutoApproveClaims((data as any).auto_approve_claims);
              if (typeof (data as any).auto_approve_unclaims === 'boolean') setAutoApproveUnclaims((data as any).auto_approve_unclaims);
              if (typeof (data as any).show_countdown_timer === 'boolean') setShowCountdown((data as any).show_countdown_timer);
              if (typeof (data as any).allow_likes === 'boolean') setAllowLikes((data as any).allow_likes);
              if (typeof (data as any).allow_comments === 'boolean') setAllowComments((data as any).allow_comments);
              if (typeof (data as any).receive_notifications === 'boolean') setNotifications((data as any).receive_notifications);
              
              const allowFollowersPref = typeof (data as any).allow_followers_view === 'boolean' ? (data as any).allow_followers_view : false;
              const enforcePrivacyPref = typeof (data as any).enforce_wishlist_privacy === 'boolean' ? (data as any).enforce_wishlist_privacy : !allowFollowersPref;
              
              if (allowFollowersPref) {
                setAllowFollowersView(true);
                setRespectPerWishlistPrivacy(false);
              } else {
                setAllowFollowersView(false);
                setRespectPerWishlistPrivacy(enforcePrivacyPref !== undefined ? enforcePrivacyPref : true);
              }
              
              setAdminMasterControl((data as any).admin_master_control === true);
              setCountry(((data as any).country || (user.user_metadata as any)?.country || "") as string);
            }
          }
        )
        .subscribe();
    };

    setupAdminListener();

    return () => {
      if (adminChannel) {
        supabase.removeChannel(adminChannel);
      }
    };
  }, []);

  // Persist visibility on change
  const saveVisibility = async (next: "public" | "private") => {
    try {
      setVisibility(next);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error(t("common.not_authenticated", "Not authenticated"));
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
        toast.error(t("common.not_authenticated", "Not authenticated"));
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
      toast.error(t("settings.enter_valid_email", "Enter a valid email"));
      return;
    }
    try {
      setChangingEmail(true);
      const { error } = await supabase.auth.updateUser({ email: newEmail });
      if (error) throw error;
      toast.success(t("settings.email_update_requested", "Email update requested. Check your inbox to confirm."));
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
      toast.success(t("settings.sessions_revoked", "Other sessions revoked"));
    } catch (err: any) {
      toast.error(err?.message || "Failed to revoke sessions");
    }
  };

  const [deleteOpen, setDeleteOpen] = useState(false);

  const doDeleteAccount = async () => {
    try {
      setDeleteOpen(false);
      await supabase.functions.invoke("delete-account", {
        body: { reason: "user_requested" },
      } as any);
      // Sign out silently and redirect to goodbye screen
      await supabase.auth.signOut({ scope: "global" as any }).catch(() => {});
      navigate("/goodbye");
    } catch {
      // Even if the function call fails, sign out and show goodbye
      await supabase.auth.signOut({ scope: "global" as any }).catch(() => {});
      navigate("/goodbye");
    }
  };

  const savePreferences = async () => {
    try {
      setSavingPrefs(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error(t("common.not_authenticated", "Not authenticated"));
        return;
      }
      const { error } = await supabase
        .from("user_profiles")
        .update({ receive_notifications: notifications } as any)
        .eq("id", user.id);
      if (error) throw error;
      toast.success(t("settings.preferences_saved", "Preferences saved"));
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

          <div className="space-y-4 pt-4">
            <Label className="flex items-center gap-2"><Globe2 className="h-4 w-4" /> {t("settings.country", "Country/Region")}</Label>
            <div className="flex gap-2 items-center max-w-md">
              <Input
                id="settings-country"
                type="text"
                placeholder={t("settings.country_placeholder", "e.g. Canada")}
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                className="rounded-xl"
              />
              <Button variant="gradient" type="button" disabled={savingCountry} onClick={saveCountrySetting}>
                {savingCountry ? t("common.saving", "Saving...") : t("common.save", "Save")}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground max-w-md">
              {t("settings.country_help", "Used to show public holidays and experiences for your region.")}
            </p>
          </div>

          <div className="space-y-2">
            <Label className="flex items-center gap-2"><Bell className="h-4 w-4" /> {t("settings.notifications", "Notifications")}</Label>
            {renderToggle(t("settings.notifications_desc", "Receive general updates"), notifications, setNotifications)}
            <div className="pt-2">
              <Button variant="gradient" onClick={savePreferences} disabled={savingPrefs || adminMasterControl}>{savingPrefs ? t("common.saving", "Saving...") : t("common.save", "Save")}</Button>
            </div>
          </div>

          {/* Wishlist Sharing (moved under Preferences) */}
          <div className="space-y-2 pt-2">
            <Label className="flex items-center gap-2"><Globe2 className="h-4 w-4" /> {t('settings.wishlist_sharing','Wishlist & Sharing')}</Label>
            <div className="space-y-2">
              {renderToggle(t('settings.allow_followers_view','Let followers see all my wishlists'), allowFollowersView, handleAllowFollowersChange)}
              {renderToggle(t('settings.respect_per_wishlist','Respect each wishlist\'s privacy setting'), respectPerWishlistPrivacy, handleRespectPrivacyChange)}
              {renderToggle(t('settings.allow_sharing','Show share icon on my wishlist cards'), allowSharing, (v)=>{ setAllowSharing(v); })}
              {renderToggle(t('settings.allow_friends_claim','Allow friends to claim items'), allowFriendsClaim, (v)=>{ setAllowFriendsClaim(v); })}
              {renderToggle(t('settings.auto_approve_claims','Auto-approve claim requests'), autoApproveClaims, (v)=>{ setAutoApproveClaims(v); })}
              {renderToggle(t('settings.auto_approve_unclaims','Auto-approve unclaim requests'), autoApproveUnclaims, (v)=>{ setAutoApproveUnclaims(v); })}
              {renderToggle(t('settings.allow_likes','Allow likes on my wishlists'), allowLikes, (v)=>{ setAllowLikes(v); })}
              {renderToggle(t('settings.allow_comments','Allow comments on my wishlists'), allowComments, (v)=>{ setAllowComments(v); })}
              {renderToggle(t('settings.show_countdown','Show countdown timer on shared page'), showCountdown, (v)=>{ setShowCountdown(v); })}
            </div>
            <div className="pt-2">
              <Button variant="gradient" onClick={()=>saveWishlistPrefs()} disabled={savingWishlistPrefs || adminMasterControl}>{savingWishlistPrefs ? t('common.saving','Saving...') : t('common.save','Save')}</Button>
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
                  disabled={loadingVisibility || adminMasterControl}
                  className={`relative z-10 flex-1 rounded-full px-4 py-2 text-xs font-semibold ${visibility === 'private' ? 'text-foreground' : 'text-muted-foreground'}`}
                >
                  {t("settings.private", "Private")}
                </button>
                <button
                  type="button"
                  onClick={() => saveVisibility("public")}
                  disabled={loadingVisibility || adminMasterControl}
                  className={`relative z-10 flex-1 rounded-full px-4 py-2 text-xs font-semibold ${visibility === 'public' ? 'text-foreground' : 'text-muted-foreground'}`}
                >
                  {t("settings.public", "Public")}
                </button>
              </div>
              {adminMasterControl && (
                <div className="ml-3 mt-2">
                  <span className="text-xs text-amber-600 font-medium">Disabled by admin</span>
                </div>
              )}
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
                    disabled={loadingFollow || adminMasterControl}
                    className={`relative z-10 flex-1 rounded-full px-4 py-2 text-xs font-semibold ${followMode === 'approval' ? 'text-foreground' : 'text-muted-foreground'}`}
                  >
                    {t("settings.approval_required", "Approval required")}
                  </button>
                  <button
                    type="button"
                    onClick={() => saveFollowMode('open')}
                    disabled={loadingFollow || adminMasterControl}
                    className={`relative z-10 flex-1 rounded-full px-4 py-2 text-xs font-semibold ${followMode === 'open' ? 'text-foreground' : 'text-muted-foreground'}`}
                  >
                    {t("settings.anyone_can_follow", "Anyone can follow")}
                  </button>
                </div>
                {adminMasterControl && (
                  <div className="ml-3 mt-2">
                    <span className="text-xs text-amber-600 font-medium">Disabled by admin</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Contact Us */}
      <Card className="rounded-2xl bg-white/80 backdrop-blur ring-1 ring-white/70 border-none shadow-[0_18px_40px_rgba(0,0,0,0.06)]">
        <CardHeader className="pb-3 flex items-center justify-between">
          <div className="flex items-center gap-2 text-base">
            <Mail className="h-4 w-4" />
            <CardTitle className="text-base">
              {t('settings.contact_us', 'Contact Us')}
            </CardTitle>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setContactOpen((open) => !open)}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            {contactOpen ? t('common.hide', 'Hide') : t('common.show', 'Show')}
            <ChevronDown
              className={`h-3 w-3 transition-transform ${contactOpen ? 'rotate-180' : ''}`}
            />
          </Button>
        </CardHeader>
        {contactOpen && (
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              {t('settings.contact_desc', 'Have a question, feedback, or need help? Send us a message and we\'ll get back to you.')}
            </p>
            <div className="rounded-xl bg-muted/40 px-3 py-2 text-xs text-muted-foreground flex flex-wrap gap-1">
              <span>{t('contact.sending_as', 'Sending as')}:</span>
              <span className="font-medium text-foreground">
                {contactName || t('contact.unknown_user', 'Your account')}
              </span>
              {contactEmail && (
                <span className="text-muted-foreground">&lt;{contactEmail}&gt;</span>
              )}
            </div>

            {contactCooldownMs && contactCooldownMs > 0 && (
              <div className="text-[11px] text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                {t('contact.cooldown_message', 'You recently sent us a message. You can send another in')}{' '}
                <span className="font-semibold">
                  {new Date(contactCooldownMs).toISOString().substring(11, 19)}
                </span>
              </div>
            )}

            <form
              onSubmit={handleContactSubmit}
              className={`space-y-3 transition-opacity ${contactCooldownMs && contactCooldownMs > 0 ? 'opacity-60 pointer-events-none' : ''}`}
            >
            <div className="space-y-1.5">
              <Label htmlFor="contact-topic" className="text-xs">
                {t('contact.topic', 'Topic')} <span className="text-red-500">*</span>
              </Label>
              <Select value={contactTopic} onValueChange={setContactTopic} disabled={contactSubmitting || !!(contactCooldownMs && contactCooldownMs > 0)}>
                <SelectTrigger id="contact-topic" className="rounded-xl">
                  <SelectValue placeholder={t('contact.topic_placeholder', 'Select a topic')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="abuse">{t('contact.topic_abuse', 'Report abuse or violation')}</SelectItem>
                  <SelectItem value="feedback">{t('contact.topic_feedback', 'General feedback')}</SelectItem>
                  <SelectItem value="question">{t('contact.topic_question', 'Question')}</SelectItem>
                  <SelectItem value="tech_issue">{t('contact.topic_tech', 'Technical issue')}</SelectItem>
                  <SelectItem value="feature_request">{t('contact.topic_feature', 'Feature request')}</SelectItem>
                  <SelectItem value="other">{t('contact.topic_other', 'Other')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="contact-message" className="text-xs">
                {t('contact.message', 'Message')} <span className="text-red-500">*</span>
              </Label>
              <Textarea
                id="contact-message"
                value={contactMessage}
                onChange={(e) => setContactMessage(e.target.value)}
                placeholder={t('contact.message_placeholder', 'Write your message here...')}
                className="rounded-xl resize-none"
                rows={4}
                disabled={contactSubmitting || !!(contactCooldownMs && contactCooldownMs > 0)}
                required
              />
            </div>
            <Button
              type="submit"
              variant="gradient"
              disabled={contactSubmitting || !!(contactCooldownMs && contactCooldownMs > 0)}
              className="w-full sm:w-auto"
            >
              {contactSubmitting ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> {t('contact.sending', 'Sending...')}</>
              ) : contactSubmitted ? (
                <><CheckCircle className="w-4 h-4 mr-2" /> {t('contact.sent', 'Sent!')}</>
              ) : (
                <><Send className="w-4 h-4 mr-2" /> {t('contact.send', 'Send Message')}</>
              )}
            </Button>
          </form>
          </CardContent>
        )}
      </Card>
    </div>
  );
};

export default Settings;
