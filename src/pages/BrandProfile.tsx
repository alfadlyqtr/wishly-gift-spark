import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Camera, Globe, Instagram, Twitter, Facebook, Linkedin, Mail, Phone, MapPin, Save, Building2, ExternalLink } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface BrandData {
  id: string;
  brand_name: string;
  brand_website: string;
  brand_country: string;
  brand_category: string;
  manager_name: string;
  logo_url: string | null;
  tagline?: string;
  description?: string;
  email?: string;
  phone?: string;
  address?: string;
  instagram?: string;
  twitter?: string;
  facebook?: string;
  linkedin?: string;
  is_verified?: boolean;
  is_public?: boolean;
}

const BrandProfile = () => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [brand, setBrand] = useState<BrandData | null>(null);

  // Form state
  const [brandName, setBrandName] = useState("");
  const [tagline, setTagline] = useState("");
  const [description, setDescription] = useState("");
  const [website, setWebsite] = useState("");
  const [category, setCategory] = useState("");
  const [country, setCountry] = useState("");
  const [managerName, setManagerName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [instagram, setInstagram] = useState("");
  const [twitter, setTwitter] = useState("");
  const [facebook, setFacebook] = useState("");
  const [linkedin, setLinkedin] = useState("");
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [isPublic, setIsPublic] = useState(true);

  useEffect(() => {
    fetchBrandData();
  }, []);

  const fetchBrandData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await (supabase as any)
        .from("brands")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setBrand(data);
        setBrandName(data.brand_name || "");
        setTagline(data.tagline || "");
        setDescription(data.description || "");
        setWebsite(data.brand_website || "");
        setCategory(data.brand_category || "");
        setCountry(data.brand_country || "");
        setManagerName(data.manager_name || "");
        setEmail(data.email || "");
        setPhone(data.phone || "");
        setAddress(data.address || "");
        setInstagram(data.instagram || "");
        setTwitter(data.twitter || "");
        setFacebook(data.facebook || "");
        setLinkedin(data.linkedin || "");
        setLogoUrl(data.logo_url || null);
        setIsPublic(data.is_public !== false);
      }
    } catch (err: any) {
      toast.error(err.message || t("brand.profile_load_error", "Failed to load brand data"));
    } finally {
      setLoading(false);
    }
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setUploading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const fileExt = file.name.split(".").pop();
      const filePath = `brand-logos/${user.id}/${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("wishlist_images")
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from("wishlist_images")
        .getPublicUrl(filePath);

      setLogoUrl(urlData.publicUrl);
      toast.success(t("brand.logo_uploaded", "Logo uploaded successfully"));
    } catch (err: any) {
      toast.error(err.message || t("brand.logo_upload_error", "Failed to upload logo"));
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    if (!brand?.id) return;

    try {
      setSaving(true);

      const { error } = await (supabase as any)
        .from("brands")
        .update({
          brand_name: brandName,
          tagline,
          description,
          brand_website: website,
          brand_category: category,
          brand_country: country,
          manager_name: managerName,
          email,
          phone,
          address,
          instagram,
          twitter,
          facebook,
          linkedin,
          logo_url: logoUrl,
          is_public: isPublic,
          updated_at: new Date().toISOString(),
        })
        .eq("id", brand.id);

      if (error) throw error;

      toast.success(t("brand.profile_saved", "Brand profile saved successfully"));
    } catch (err: any) {
      toast.error(err.message || t("brand.profile_save_error", "Failed to save brand profile"));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-2xl mx-auto">
      {/* Header */}
      <div className="text-center space-y-2">
        <h1 className="text-2xl font-bold bg-gradient-to-r from-[hsl(var(--brand-cool-start))] via-[hsl(var(--brand-cool-end))] to-[hsl(var(--brand-warm-end))] bg-clip-text text-transparent">
          {t("brand.profile_title", "Brand Profile")}
        </h1>
        <p className="text-sm text-muted-foreground">
          {t("brand.profile_subtitle", "Manage your brand information and appearance")}
        </p>
      </div>

      {/* Logo Section */}
      <Card className="shadow-lg border border-white/40 bg-gradient-to-br from-white/95 via-white/90 to-white/80 overflow-hidden">
        <CardHeader className="bg-gradient-to-r from-brand-cool-start/10 via-brand-cool-end/5 to-brand-warm-start/10 pb-4">
          <CardTitle className="text-lg flex items-center gap-2">
            <Camera className="h-5 w-5 text-primary" />
            {t("brand.logo_section", "Brand Logo")}
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="flex flex-col items-center gap-4">
            <div className="relative">
              {logoUrl ? (
                <img
                  src={logoUrl}
                  alt={brandName}
                  className="w-28 h-28 rounded-2xl object-cover border-4 border-white shadow-lg"
                />
              ) : (
                <div className="w-28 h-28 rounded-2xl bg-gradient-to-br from-brand-cool-start/20 to-brand-warm-start/20 flex items-center justify-center border-4 border-white shadow-lg">
                  <Building2 className="h-12 w-12 text-primary/50" />
                </div>
              )}
              <label className="absolute -bottom-2 -right-2 p-2 bg-primary rounded-full cursor-pointer hover:bg-primary/90 transition-colors shadow-lg">
                <Camera className="h-4 w-4 text-white" />
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleLogoUpload}
                  disabled={uploading}
                />
              </label>
            </div>
            <p className="text-xs text-muted-foreground text-center">
              {t("brand.logo_hint", "Click the camera icon to upload your brand logo")}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Basic Info */}
      <Card className="shadow-lg border border-white/40 bg-gradient-to-br from-white/95 via-white/90 to-white/80">
        <CardHeader className="bg-gradient-to-r from-brand-cool-start/10 via-brand-cool-end/5 to-brand-warm-start/10 pb-4">
          <CardTitle className="text-lg flex items-center gap-2">
            <Building2 className="h-5 w-5 text-primary" />
            {t("brand.basic_info", "Basic Information")}
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-6 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="brandName">{t("brand.field_name", "Brand Name")}</Label>
            <Input
              id="brandName"
              value={brandName}
              onChange={(e) => setBrandName(e.target.value)}
              placeholder={t("brand.field_name_placeholder", "Your brand name")}
              className="border-slate-200 focus:border-primary"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="tagline">{t("brand.field_tagline", "Tagline")}</Label>
            <Input
              id="tagline"
              value={tagline}
              onChange={(e) => setTagline(e.target.value)}
              placeholder={t("brand.field_tagline_placeholder", "A short catchy phrase")}
              className="border-slate-200 focus:border-primary"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">{t("brand.field_description", "Description")}</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t("brand.field_description_placeholder", "Tell customers about your brand...")}
              className="border-slate-200 focus:border-primary min-h-[100px]"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="category">{t("brand.field_category", "Category")}</Label>
              <Input
                id="category"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                placeholder={t("brand.field_category_placeholder", "e.g. Fashion")}
                className="border-slate-200 focus:border-primary"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="country">{t("brand.field_country", "Country")}</Label>
              <Input
                id="country"
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                placeholder={t("brand.field_country_placeholder", "e.g. Qatar")}
                className="border-slate-200 focus:border-primary"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="managerName">{t("brand.field_manager", "Manager Name")}</Label>
            <Input
              id="managerName"
              value={managerName}
              onChange={(e) => setManagerName(e.target.value)}
              placeholder={t("brand.field_manager_placeholder", "Account manager name")}
              className="border-slate-200 focus:border-primary"
            />
          </div>
        </CardContent>
      </Card>

      {/* Contact & Links */}
      <Card className="shadow-lg border border-white/40 bg-gradient-to-br from-white/95 via-white/90 to-white/80">
        <CardHeader className="bg-gradient-to-r from-brand-cool-start/10 via-brand-cool-end/5 to-brand-warm-start/10 pb-4">
          <CardTitle className="text-lg flex items-center gap-2">
            <Globe className="h-5 w-5 text-primary" />
            {t("brand.contact_links", "Contact & Links")}
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-6 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="website" className="flex items-center gap-2">
              <ExternalLink className="h-4 w-4 text-muted-foreground" />
              {t("brand.field_website", "Website")}
            </Label>
            <Input
              id="website"
              type="url"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              placeholder="https://yourstore.com"
              className="border-slate-200 focus:border-primary"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="email" className="flex items-center gap-2">
              <Mail className="h-4 w-4 text-muted-foreground" />
              {t("brand.field_email", "Email")}
            </Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="contact@yourbrand.com"
              className="border-slate-200 focus:border-primary"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone" className="flex items-center gap-2">
              <Phone className="h-4 w-4 text-muted-foreground" />
              {t("brand.field_phone", "Phone")}
            </Label>
            <Input
              id="phone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+974 1234 5678"
              className="border-slate-200 focus:border-primary"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="address" className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-muted-foreground" />
              {t("brand.field_address", "Address")}
            </Label>
            <Input
              id="address"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder={t("brand.field_address_placeholder", "Store or office address")}
              className="border-slate-200 focus:border-primary"
            />
          </div>
        </CardContent>
      </Card>

      {/* Social Media */}
      <Card className="shadow-lg border border-white/40 bg-gradient-to-br from-white/95 via-white/90 to-white/80">
        <CardHeader className="bg-gradient-to-r from-brand-cool-start/10 via-brand-cool-end/5 to-brand-warm-start/10 pb-4">
          <CardTitle className="text-lg flex items-center gap-2">
            <Instagram className="h-5 w-5 text-primary" />
            {t("brand.social_media", "Social Media")}
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-6 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="instagram" className="flex items-center gap-2">
              <Instagram className="h-4 w-4 text-pink-500" />
              Instagram
            </Label>
            <Input
              id="instagram"
              value={instagram}
              onChange={(e) => setInstagram(e.target.value)}
              placeholder="@yourbrand"
              className="border-slate-200 focus:border-primary"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="twitter" className="flex items-center gap-2">
              <Twitter className="h-4 w-4 text-sky-500" />
              Twitter / X
            </Label>
            <Input
              id="twitter"
              value={twitter}
              onChange={(e) => setTwitter(e.target.value)}
              placeholder="@yourbrand"
              className="border-slate-200 focus:border-primary"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="facebook" className="flex items-center gap-2">
              <Facebook className="h-4 w-4 text-blue-600" />
              Facebook
            </Label>
            <Input
              id="facebook"
              value={facebook}
              onChange={(e) => setFacebook(e.target.value)}
              placeholder="facebook.com/yourbrand"
              className="border-slate-200 focus:border-primary"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="linkedin" className="flex items-center gap-2">
              <Linkedin className="h-4 w-4 text-blue-700" />
              LinkedIn
            </Label>
            <Input
              id="linkedin"
              value={linkedin}
              onChange={(e) => setLinkedin(e.target.value)}
              placeholder="linkedin.com/company/yourbrand"
              className="border-slate-200 focus:border-primary"
            />
          </div>
        </CardContent>
      </Card>

      {/* Visibility Settings */}
      <Card className="shadow-lg border border-white/40 bg-gradient-to-br from-white/95 via-white/90 to-white/80">
        <CardHeader className="bg-gradient-to-r from-brand-cool-start/10 via-brand-cool-end/5 to-brand-warm-start/10 pb-4">
          <CardTitle className="text-lg">
            {t("brand.visibility_settings", "Visibility Settings")}
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Label htmlFor="isPublic" className="text-base font-medium">
                {t("brand.field_public", "Public Profile")}
              </Label>
              <p className="text-sm text-muted-foreground">
                {t("brand.field_public_hint", "Allow users to discover and view your brand")}
              </p>
            </div>
            <Switch
              id="isPublic"
              checked={isPublic}
              onCheckedChange={setIsPublic}
            />
          </div>
        </CardContent>
      </Card>

      {/* Save Button */}
      <Button
        onClick={handleSave}
        disabled={saving}
        className="w-full bg-gradient-to-r from-brand-warm-start to-brand-warm-end text-white shadow-lg hover:brightness-110 transition-all py-6 text-lg font-semibold"
      >
        {saving ? (
          <span className="flex items-center gap-2">
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
            {t("brand.saving", "Saving...")}
          </span>
        ) : (
          <span className="flex items-center gap-2">
            <Save className="h-5 w-5" />
            {t("brand.save_profile", "Save Profile")}
          </span>
        )}
      </Button>
    </div>
  );
};

export default BrandProfile;
