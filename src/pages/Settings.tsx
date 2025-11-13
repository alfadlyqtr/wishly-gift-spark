import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { ArrowLeft, Shield, Trash2, Smartphone, Globe2, Bell } from "lucide-react";
import BackButton from "@/components/BackButton";
import { toast } from "sonner";

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

  // Load initial visibility from profile
  useEffect(() => {
    (async () => {
      try {
        setLoadingVisibility(true);
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        const { data, error } = await (supabase as any)
          .from("user_profiles")
          .select("is_searchable")
          .eq("id", user.id)
          .single();
        if (!error && data) {
          setVisibility(data.is_searchable ? "public" : "private");
          setVisibilitySupported(true);
        } else if (error) {
          setVisibilitySupported(false);
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

  // Keep dir attribute in sync with language
  useEffect(() => {
    const dir = i18n.language === "ar" ? "rtl" : "ltr";
    document.documentElement.setAttribute("dir", dir);
  }, [i18n.language]);

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

  const handleDeleteAccount = async () => {
    if (!confirm("Are you sure? This cannot be undone.")) return;
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
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Shield className="h-4 w-4" /> {t("settings.security", "Account Security")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <form onSubmit={handleChangePassword} className="space-y-2">
            <Label htmlFor="new-pass">{t("settings.change_password", "Change Password")}</Label>
            <div className="flex gap-2">
              <Input id="new-pass" type="password" placeholder="••••••••" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
              <Button type="submit" disabled={changingPassword}>{changingPassword ? t("common.saving", "Saving...") : t("common.save", "Save")}</Button>
            </div>
          </form>

          <form onSubmit={handleChangeEmail} className="space-y-2">
            <Label htmlFor="new-email">{t("settings.change_email", "Change Email")}</Label>
            <div className="flex gap-2">
              <Input id="new-email" type="email" placeholder="you@example.com" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} />
              <Button type="submit" disabled={changingEmail}>{changingEmail ? t("common.saving", "Saving...") : t("common.save", "Save")}</Button>
            </div>
          </form>

          <div className="pt-2">
            <Button variant="destructive" className="w-full" onClick={handleDeleteAccount}>
              <Trash2 className="h-4 w-4 mr-2" /> {t("settings.delete_account", "Delete Account")}
            </Button>
            <p className="mt-2 text-xs text-muted-foreground">
              {t("settings.delete_account_note", "Deletion is processed via a secure Edge Function and cascades related data.")}
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
          <Button variant="outline" onClick={revokeOtherSessions}>{t("settings.revoke_others", "Sign out of other sessions")}</Button>
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
            <div className="relative rounded-full p-[2px] bg-gradient-to-r from-[hsl(var(--brand-cool-start))] via-[hsl(var(--brand-cool-end))] to-[hsl(var(--brand-warm-end))] w-full max-w-md" dir="ltr">
              <div className="relative flex items-center rounded-full bg-white/70 backdrop-blur px-1 py-1 ring-1 ring-white/70 overflow-hidden" dir="ltr">
                <span
                  className="pointer-events-none absolute top-1 bottom-1 w-1/2 rounded-full p-[1px] bg-gradient-to-r from-[hsl(var(--brand-cool-start))]/40 via-[hsl(var(--brand-cool-end))]/35 to-[hsl(var(--brand-warm-end))]/40 transition-all duration-300 ease-out"
                  style={{ left: i18n.language === 'ar' ? '0px' : 'calc(50% + 0px)' }}
                >
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
          </div>
          <div className="space-y-2">
            <Label className="flex items-center gap-2"><Bell className="h-4 w-4" /> {t("settings.notifications", "Notifications")}</Label>
            <div className="flex items-center justify-between rounded-md border p-3">
              <span className="text-sm text-muted-foreground">{t("settings.notifications_desc", "Receive general updates")}</span>
              <Switch checked={notifications} onCheckedChange={setNotifications} />
            </div>
            <div className="pt-2">
              <Button onClick={savePreferences} disabled={savingPrefs}>{savingPrefs ? t("common.saving", "Saving...") : t("common.save", "Save")}</Button>
            </div>
          </div>

          {/* Profile visibility */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2"><Shield className="h-4 w-4" /> {t("settings.profile_visibility", "Profile Visibility")}</Label>
            <p className="text-xs text-muted-foreground">{t("settings.profile_visibility_desc", "If public, people can find your profile in Explore search.")}</p>
            <div className="relative rounded-full p-[2px] bg-gradient-to-r from-[hsl(var(--brand-cool-start))] via-[hsl(var(--brand-cool-end))] to-[hsl(var(--brand-warm-end))] w-full max-w-md">
              <div className="relative flex items-center rounded-full bg-white/70 backdrop-blur px-1 py-1 ring-1 ring-white/70 overflow-hidden">
                <span
                  className="pointer-events-none absolute top-1 bottom-1 w-1/2 rounded-full p-[1px] bg-gradient-to-r from-[hsl(var(--brand-cool-start))]/40 via-[hsl(var(--brand-cool-end))]/35 to-[hsl(var(--brand-warm-end))]/40 transition-all duration-300 ease-out"
                  style={{ left: visibility === 'private' ? '0px' : 'calc(50% + 0px)' }}
                >
                  <span className="relative block h-full w-full rounded-full bg-white/20 backdrop-blur-[2px]" />
                </span>
                <button
                  type="button"
                  onClick={() => visibilitySupported && saveVisibility("private")}
                  disabled={loadingVisibility || !visibilitySupported}
                  className={`relative z-10 flex-1 rounded-full px-4 py-2 text-xs font-semibold ${visibility === 'private' ? 'text-foreground' : 'text-muted-foreground'}`}
                >
                  {t("settings.private", "Private")}
                </button>
                <button
                  type="button"
                  onClick={() => visibilitySupported && saveVisibility("public")}
                  disabled={loadingVisibility || !visibilitySupported}
                  className={`relative z-10 flex-1 rounded-full px-4 py-2 text-xs font-semibold ${visibility === 'public' ? 'text-foreground' : 'text-muted-foreground'}`}
                >
                  {t("settings.public", "Public")}
                </button>
              </div>
            </div>
            
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Settings;
