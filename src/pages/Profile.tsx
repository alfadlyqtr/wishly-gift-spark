import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { Link, useNavigate } from "react-router-dom";
import { LogOut, Settings, Heart, Gift, Edit2, Save, X, Trash2, List } from "lucide-react";
import { MapPin } from "phosphor-react";
import ReactCountryFlag from "react-country-flag";
import { toast } from "sonner";
import { format } from "date-fns";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useProfileData } from "@/hooks/use-profile";
import CreateWishlistModal from "@/components/wishes/CreateWishlistModal";
import { useWishlists } from "@/hooks/use-wishlists";
import { useTranslation } from "react-i18next";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const Profile = () => {
  const navigate = useNavigate();
  const [isEditing, setIsEditing] = useState(false);
  const [editedDob, setEditedDob] = useState("");
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const { data, isLoading } = useProfileData();
  const { data: wishlists, isLoading: isWishlistsLoading } = useWishlists();
  const { t, i18n } = useTranslation();

  const followersFollowing = useQuery({
    queryKey: ["profile", "social"],
    queryFn: async () => {
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth.user?.id;
      if (!uid) return { followers: 0, following: 0 };
      try {
        const [r1, r2] = await Promise.all([
          supabase
            .from("followers")
            .select("id", { count: "exact", head: true })
            .eq("following_id", uid)
            .eq("status", "accepted"),
          supabase
            .from("followers")
            .select("id", { count: "exact", head: true })
            .eq("user_id", uid)
            .eq("status", "accepted"),
        ]);
        return {
          followers: (r1.count as number | null) ?? 0,
          following: (r2.count as number | null) ?? 0,
        };
      } catch {
        return { followers: 0, following: 0 };
      }
    },
  });

  const zodiacKey = useMemo(() => {
    const dobStr = data?.profile?.dob;
    if (!dobStr) return null;
    const d = new Date(dobStr);
    if (isNaN(d.getTime())) return null;
    const m = d.getUTCMonth() + 1; // 1-12
    const day = d.getUTCDate();
    // Determine zodiac by month/day
    // Returns key names: aries, taurus, gemini, cancer, leo, virgo, libra, scorpio, sagittarius, capricorn, aquarius, pisces
    if ((m === 3 && day >= 21) || (m === 4 && day <= 19)) return "aries";
    if ((m === 4 && day >= 20) || (m === 5 && day <= 20)) return "taurus";
    if ((m === 5 && day >= 21) || (m === 6 && day <= 20)) return "gemini";
    if ((m === 6 && day >= 21) || (m === 7 && day <= 22)) return "cancer";
    if ((m === 7 && day >= 23) || (m === 8 && day <= 22)) return "leo";
    if ((m === 8 && day >= 23) || (m === 9 && day <= 22)) return "virgo";
    if ((m === 9 && day >= 23) || (m === 10 && day <= 22)) return "libra";
    if ((m === 10 && day >= 23) || (m === 11 && day <= 21)) return "scorpio";
    if ((m === 11 && day >= 22) || (m === 12 && day <= 21)) return "sagittarius";
    if ((m === 12 && day >= 22) || (m === 1 && day <= 19)) return "capricorn";
    if ((m === 1 && day >= 20) || (m === 2 && day <= 18)) return "aquarius";
    if ((m === 2 && day >= 19) || (m === 3 && day <= 20)) return "pisces";
    return null;
  }, [data?.profile?.dob]);

  useEffect(() => {
    if (data?.profile) {
      setEditedDob(data.profile.dob || "");
    }
  }, [data?.profile]);

  const handleSaveDob = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) return;

      const { error } = await supabase
        .from("user_profiles")
        .update({ dob: editedDob || null })
        .eq("id", user.id);

      if (error) {
        toast.error("Error updating date of birth");
        console.error(error);
      } else {
        toast.success("Date of birth updated");
        await queryClient.invalidateQueries({ queryKey: ["profile"] });
        setIsEditing(false);
      }
    } catch (error) {
      console.error("Error:", error);
      toast.error("Error updating profile");
    }
  };

  const goToWishlists = () => {
    navigate('/wishlists');
  };

  const triggerAvatarUpload = () => {
    fileInputRef.current?.click();
  };

  const handleAvatarChange: React.ChangeEventHandler<HTMLInputElement> = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate("/login");
        return;
      }

      const filePath = `avatars/${user.id}/profile.png`;
      const { error: uploadError } = await supabase.storage.from("avatars").upload(filePath, file, {
        upsert: true,
        contentType: file.type || "image/png",
      });
      if (uploadError) throw uploadError;

      const { data: publicData } = supabase.storage.from("avatars").getPublicUrl(filePath);
      const publicUrl = publicData.publicUrl;

      const { error: updateError } = await supabase
        .from("user_profiles")
        .update({ avatar_url: publicUrl })
        .eq("id", user.id);
      if (updateError) throw updateError;

      toast.success("Profile photo updated");
      await queryClient.invalidateQueries({ queryKey: ["profile"] });
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message || "Failed to upload avatar");
    } finally {
      // reset input value to allow re-uploading same file
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      toast.error("Error signing out");
    } else {
      toast.success("Signed out successfully");
      navigate("/login");
    }
  };

  if (isLoading) {
    return (
      <div className="container max-w-2xl mx-auto px-4 py-6">
        <Card>
          <CardContent className="pt-6">
            <div className="flex justify-center">
              <p className="text-muted-foreground">Loading...</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container max-w-2xl mx-auto px-4 py-6 space-y-6">

      {/* Header + Personal Info (no tab) */}
      <div className="w-full">
        <div className="space-y-6 pt-0">
          <Card className="overflow-hidden rounded-2xl shadow-xl">
            {/* Gradient mesh header with avatar */}
            <div className="relative min-h-[28rem] md:h-[22rem] w-full overflow-hidden pb-5">
              {/* Radial mesh background (brand colors) */}
              <div
                className="absolute inset-0"
                style={{
                  ["--s" as any]: "110px",
                  ["--c1" as any]: "hsl(var(--brand-warm-start))",
                  ["--c2" as any]: "hsl(var(--brand-cool-end))",
                  ["--_g" as any]:
                    "var(--c2) 6% 14%, var(--c1) 16% 24%, var(--c2) 26% 34%, var(--c1) 36% 44%, var(--c2) 46% 54%, var(--c1) 56% 64%, var(--c2) 66% 74%, var(--c1) 76% 84%, var(--c2) 86% 94%",
                  background:
                    "radial-gradient(100% 100% at 100% 0, var(--c1) 4%, var(--_g), #0008 96%, #0000), radial-gradient(100% 100% at 0 100%, #0000, #0008 4%, var(--_g), var(--c1) 96%) var(--c1)",
                  backgroundSize: "var(--s) var(--s)",
                } as any}
              />

              {/* Overlay info with avatar (click to upload) */}
              <div className="absolute inset-x-0 top-0 flex flex-col md:flex-row items-start md:items-start justify-between text-white px-3 pt-3 pb-4 sm:px-4 sm:pt-4 gap-3">
                <div className="flex w-full md:w-auto flex-col">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-3 rounded-xl w-full md:w-auto bg-black/15 px-2.5 py-2 sm:px-3 shadow-[0_8px_24px_rgba(0,0,0,0.22)] ring-1 ring-white/70">
                  <button onClick={triggerAvatarUpload} className="rounded-full">
                    <Avatar className="h-14 w-14 sm:h-16 sm:w-16 md:h-20 md:w-20 ring-3 md:ring-4 ring-white/90 shadow-[0_12px_28px_rgba(0,0,0,0.35)]">
                      {data?.profile?.avatar_url ? (
                        <AvatarImage src={data.profile.avatar_url} alt={data?.profile?.full_name || 'avatar'} />
                      ) : (
                        <AvatarFallback className="bg-white/20 text-white text-xl sm:text-2xl md:text-3xl">
                          {(data?.profile?.full_name || data?.profile?.username || 'U').slice(0,1).toUpperCase()}
                        </AvatarFallback>
                      )}
                    </Avatar>
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleAvatarChange}
                  />
                  <div className="leading-tight">
                    <div className="text-xl sm:text-2xl md:text-3xl font-extrabold drop-shadow-[0_2px_3px_rgba(0,0,0,0.9)]">{data?.profile?.full_name || data?.profile?.username || "Profile"}</div>
                    <div className="text-xs sm:text-sm md:text-base opacity-95 drop-shadow-[0_2px_3px_rgba(0,0,0,0.85)]">@{data?.profile?.username}</div>
                  </div>
                  </div>
                  <div className="mt-2 w-full sm:w-auto">
                    <Button
                      variant="gradient"
                      size="sm"
                      className="w-full sm:w-auto h-10 rounded-xl border border-white/30 shadow-[0_6px_0_rgba(0,0,0,0.18)] hover:shadow-[0_4px_0_rgba(0,0,0,0.2)] active:translate-y-[1px] transition-all duration-150 relative overflow-hidden before:absolute before:inset-0 before:bg-white before:opacity-10 before:pointer-events-none before:blur-[2px]"
                      onClick={goToWishlists}
                    >
                      <List />
                      {t('profile.tab_wishlists', 'Wishlists')}
                    </Button>
                  </div>
                </div>
                <div className="w-full sm:w-auto text-right leading-tight rounded-xl bg-black/15 px-3 py-2 shadow-[0_8px_24px_rgba(0,0,0,0.22)] ring-1 ring-white/70 self-end md:self-auto mt-1 md:mt-0">
                  <div className="flex items-center justify-end gap-1 drop-shadow-[0_3px_6px_rgba(0,0,0,0.9)]">
                    <MapPin size={14} weight="bold" />
                    <span className="text-[11px] tracking-wide font-semibold">
                      {(() => {
                        const raw = (data?.country || "").toString();
                        if (!raw) return "";
                        if (i18n.language !== "ar") return raw.toUpperCase();
                        const m: Record<string, string> = {
                          qatar: "قطر",
                          "saudi arabia": "السعودية",
                          uae: "الإمارات",
                          "united arab emirates": "الإمارات",
                          bahrain: "البحرين",
                          kuwait: "الكويت",
                          oman: "عُمان",
                          egypt: "مصر",
                          jordan: "الأردن",
                          lebanon: "لبنان"
                        };
                        const n = raw.trim().toLowerCase();
                        return m[n] || raw;
                      })()}
                    </span>
                    {data?.country && (
                      <ReactCountryFlag svg countryCode={(() => {
                        const m: Record<string, string> = { qatar: 'QA', uae: 'AE', 'united arab emirates': 'AE', 'saudi arabia': 'SA', bahrain: 'BH', kuwait: 'KW', oman: 'OM', egypt: 'EG', jordan: 'JO', lebanon: 'LB', 'united states': 'US', usa: 'US', 'united kingdom': 'GB', uk: 'GB' };
                        const n = (data?.country || '').toString().trim().toLowerCase();
                        if (/^[A-Za-z]{2}$/.test(n)) return n.toUpperCase();
                        return m[n] ?? '';
                      })()} style={{ width: '16px', height: '12px' }} aria-label="country" />
                    )}
                  </div>
                  <div className="text-xs sm:text-sm opacity-95 drop-shadow-[0_3px_6px_rgba(0,0,0,0.9)]">
                    {(() => {
                      const dob = data?.profile?.dob ? new Date(data.profile.dob) : null;
                      if (!dob || isNaN(dob.getTime())) return '';
                      if (i18n.language === 'ar') {
                        return dob.toLocaleDateString('ar-EG', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });
                      }
                      const ord = (n: number) => (n % 10 === 1 && n % 100 !== 11 ? 'st' : n % 10 === 2 && n % 100 !== 12 ? 'nd' : n % 10 === 3 && n % 100 !== 13 ? 'rd' : 'th');
                      const weekday = dob.toLocaleDateString('en-GB', { weekday: 'long' });
                      const day = dob.getDate();
                      const month = dob.toLocaleDateString('en-GB', { month: 'long' });
                      return `${weekday}, ${day}${ord(day)} ${month} ${dob.getFullYear()}`;
                    })()}
                  </div>
                  <div className="text-3xl sm:text-4xl md:text-6xl font-extrabold drop-shadow-[0_4px_10px_rgba(0,0,0,0.9)]">
                    {(() => {
                      const dob = data?.profile?.dob ? new Date(data.profile.dob) : null;
                      if (!dob || isNaN(dob.getTime())) return '';
                      const now = new Date();
                      let age = now.getFullYear() - dob.getFullYear();
                      const m = now.getMonth() - dob.getMonth();
                      if (m < 0 || (m === 0 && now.getDate() < dob.getDate())) age--;
                      return i18n.language === 'ar' ? `${age} سنة` : `${age}y`;
                    })()}
                  </div>
                </div>
              </div>
              {/* Followers/Following glass bar at bottom of header */}
              <div className="absolute left-3 right-3 bottom-3">
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => navigate("/followers?tab=followers")}
                    className="rounded-2xl bg-black/15 text-white ring-1 ring-white/70 shadow-[0_8px_24px_rgba(0,0,0,0.22)] px-4 py-2 text-center w-full cursor-pointer active:scale-[0.99] transition-transform"
                  >
                    <div className="text-2xl font-extrabold drop-shadow-[0_3px_6px_rgba(0,0,0,0.7)]">{followersFollowing.data?.followers ?? 0}</div>
                    <div className="text-[11px] tracking-wide opacity-95">{t('profile.followers', 'Followers')}</div>
                  </button>
                  <button
                    type="button"
                    onClick={() => navigate("/followers?tab=following")}
                    className="rounded-2xl bg-black/15 text-white ring-1 ring-white/70 shadow-[0_8px_24px_rgba(0,0,0,0.22)] px-4 py-2 text-center w-full cursor-pointer active:scale-[0.99] transition-transform"
                  >
                    <div className="text-2xl font-extrabold drop-shadow-[0_3px_6px_rgba(0,0,0,0.7)]">{followersFollowing.data?.following ?? 0}</div>
                    <div className="text-[11px] tracking-wide opacity-95">{t('profile.following', 'Following')}</div>
                  </button>
                </div>
              </div>
            </div>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>{t('profile.tab_personal', 'Personal Information')}</span>
                {!isEditing ? (
                  <Button
                    variant="gradient"
                    size="sm"
                    onClick={() => setIsEditing(true)}
                  >
                    <Edit2 className="h-4 w-4" />
                  </Button>
                ) : (
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setIsEditing(false);
                        setEditedDob(data?.profile?.dob || "");
                      }}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="gradient"
                      size="sm"
                      onClick={handleSaveDob}
                    >
                      <Save className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {isEditing ? (
                <div className="space-y-2">
                  <Label className="text-sm text-muted-foreground">{t('profile.dob', 'Date of Birth')}</Label>
                  <Input
                    type="date"
                    value={editedDob}
                    onChange={(e) => setEditedDob(e.target.value)}
                    max={new Date().toISOString().split('T')[0]}
                  />
                  {editedDob && (
                    <p className="text-sm text-muted-foreground">
                      {t('profile.zodiac', 'Zodiac')}: {t(`zodiac.${(() => {
                        const d = new Date(editedDob);
                        if (isNaN(d.getTime())) return 'unknown';
                        const m = d.getUTCMonth() + 1; const day = d.getUTCDate();
                        if ((m === 3 && day >= 21) || (m === 4 && day <= 19)) return 'aries';
                        if ((m === 4 && day >= 20) || (m === 5 && day <= 20)) return 'taurus';
                        if ((m === 5 && day >= 21) || (m === 6 && day <= 20)) return 'gemini';
                        if ((m === 6 && day >= 21) || (m === 7 && day <= 22)) return 'cancer';
                        if ((m === 7 && day >= 23) || (m === 8 && day <= 22)) return 'leo';
                        if ((m === 8 && day >= 23) || (m === 9 && day <= 22)) return 'virgo';
                        if ((m === 9 && day >= 23) || (m === 10 && day <= 22)) return 'libra';
                        if ((m === 10 && day >= 23) || (m === 11 && day <= 21)) return 'scorpio';
                        if ((m === 11 && day >= 22) || (m === 12 && day <= 21)) return 'sagittarius';
                        if ((m === 12 && day >= 22) || (m === 1 && day <= 19)) return 'capricorn';
                        if ((m === 1 && day >= 20) || (m === 2 && day <= 18)) return 'aquarius';
                        if ((m === 2 && day >= 19) || (m === 3 && day <= 20)) return 'pisces';
                        return 'unknown';
                      })()}`, 'Unknown')}
                    </p>
                  )}
                </div>
              ) : (
                <div className="rounded-b-2xl bg-white text-foreground shadow-[0_8px_20px_-8px_rgba(0,0,0,0.15)] overflow-hidden">
                  <div className="flex items-center justify-between px-5 py-3 text-sm">
                    <p className="text-muted-foreground">{t('profile.dob', 'Date of Birth')}</p>
                    <p className="font-medium">{data?.profile?.dob ?
                      (i18n.language === 'ar'
                        ? new Date(data.profile.dob).toLocaleDateString('ar-EG', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })
                        : format(new Date(data.profile.dob), 'EEEE, dd MMMM yyyy')
                      ) : t('common.not_set', 'Not set')}
                    </p>
                  </div>
                  <div className="h-[2px] bg-muted" />
                  <div className="flex items-center justify-between px-5 py-3 text-sm">
                    <p className="text-muted-foreground">{t('auth.email', 'Email')}</p>
                    <p className="font-medium truncate max-w-[60%] text-right">{data?.authEmail || t('common.not_set', 'Not set')}</p>
                  </div>
                  <div className="h-[2px] bg-muted" />
                  <div className="flex items-center justify-between px-5 py-3 text-sm">
                    <p className="text-muted-foreground">{t('auth.country', 'Country/Region')}</p>
                    <p className="font-medium flex items-center gap-1">{(data?.country || '').toString()}</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <div className="space-y-3">
            <Button variant="outline" className="w-full justify-start" size="lg" onClick={() => navigate('/settings')}>
              <Settings className="mr-2 h-5 w-5" />
              {t('settings.title', 'Settings')}
            </Button>
            <Button 
              variant="outline" 
              className="w-full justify-start text-destructive hover:text-destructive" 
              size="lg"
              onClick={handleLogout}
            >
              <LogOut className="mr-2 h-5 w-5" />
              {t('profile.sign_out', 'Sign Out')}
            </Button>
          </div>
        </div>
      </div>

      {/* Wishlists button moved into header overlay */}
    </div>
  );
};

export default Profile;
