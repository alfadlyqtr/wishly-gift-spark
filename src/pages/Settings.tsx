import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { ArrowLeft, Shield, Trash2, Smartphone, Globe2, Bell } from "lucide-react";
import { toast } from "sonner";

const Settings = () => {
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();

  const [newPassword, setNewPassword] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);

  const [newEmail, setNewEmail] = useState("");
  const [changingEmail, setChangingEmail] = useState(false);

  const [notifications, setNotifications] = useState<boolean>(true);
  const [savingPrefs, setSavingPrefs] = useState(false);

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
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-4 w-4 mr-1" /> {t("settings.title", "Settings")}
        </Button>
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
            <div className="flex items-center gap-2 rounded-md border p-2">
              <Button
                variant={i18n.language === "ar" ? "default" : "outline"}
                size="sm"
                onClick={() => i18n.changeLanguage("ar")}
              >
                العربية
              </Button>
              <Button
                variant={i18n.language === "en" ? "default" : "outline"}
                size="sm"
                onClick={() => i18n.changeLanguage("en")}
              >
                English
              </Button>
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
        </CardContent>
      </Card>
    </div>
  );
};

export default Settings;
