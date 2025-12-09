import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Camera, Globe, Instagram, Twitter, Facebook, Linkedin, Mail, Phone, MapPin, Save, Building2, ExternalLink, Bell, MessageSquare, Users, Shield, TrendingUp, Settings as SettingsIcon, Youtube, UserPlus, UserCheck, MessageCircle, Plus, X, LogOut, Send, Loader2, CheckCircle, BadgeCheck } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { LanguageToggle } from "@/components/LanguageToggle";
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
  whatsapp?: string;
  address?: string;
  store_locations?: string[];
  instagram?: string;
  twitter?: string;
  facebook?: string;
  linkedin?: string;
  tiktok?: string;
  youtube?: string;
  is_verified?: boolean;
  is_public?: boolean;
  allow_messages?: boolean;
  allow_product_requests?: boolean;
  auto_approve_followers?: boolean;
  notify_new_follower?: boolean;
  notify_product_mention?: boolean;
  notify_review?: boolean;
  show_analytics_publicly?: boolean;
  products_find_mode?: 'all_off' | 'all_on' | 'per_product';
  products_add_mode?: 'all_off' | 'all_on' | 'per_product';
}

const BrandProfile = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [brand, setBrand] = useState<BrandData | null>(null);

  // Use React Query for follower counts
  const { data: followerCounts } = useQuery({
    queryKey: ["brand-followers-count"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return { followers: 0, following: 0 };

      const { data: brandData } = await (supabase as any)
        .from("brands")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (!brandData) return { followers: 0, following: 0 };

      const [followersRes, followingRes] = await Promise.all([
        (supabase as any)
          .from("brand_followers")
          .select("id", { count: "exact", head: true })
          .eq("brand_id", brandData.id)
          .eq("status", "accepted"),
        (supabase as any)
          .from("brand_following")
          .select("id", { count: "exact", head: true })
          .eq("brand_id", brandData.id)
          .eq("status", "accepted"),
      ]);

      return {
        followers: followersRes.count || 0,
        following: followingRes.count || 0,
      };
    },
  });

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
  const [whatsapp, setWhatsapp] = useState("");
  const [address, setAddress] = useState("");
  const [storeLocations, setStoreLocations] = useState<string[]>([]);
  const [instagram, setInstagram] = useState("");
  const [twitter, setTwitter] = useState("");
  const [facebook, setFacebook] = useState("");
  const [linkedin, setLinkedin] = useState("");
  const [tiktok, setTiktok] = useState("");
  const [youtube, setYoutube] = useState("");
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [isPublic, setIsPublic] = useState(true);
  const [allowMessages, setAllowMessages] = useState(true);
  const [allowProductRequests, setAllowProductRequests] = useState(true);
  const [autoApproveFollowers, setAutoApproveFollowers] = useState(false);
  const [notifyNewFollower, setNotifyNewFollower] = useState(true);
  const [notifyProductMention, setNotifyProductMention] = useState(true);
  const [notifyReview, setNotifyReview] = useState(true);
  const [showAnalyticsPublicly, setShowAnalyticsPublicly] = useState(false);
  const [productsFindMode, setProductsFindMode] = useState<'all_off' | 'all_on' | 'per_product'>('per_product');
  const [productsAddMode, setProductsAddMode] = useState<'all_off' | 'all_on' | 'per_product'>('per_product');
  const [allowQuestions, setAllowQuestions] = useState(true);
  const [allowLikes, setAllowLikes] = useState(true);
  const [showStoreLink, setShowStoreLink] = useState(true);
  
  // Admin master control - fetched once on load, no polling
  const [adminMasterControl, setAdminMasterControl] = useState(false);

  // Contact form state
  const [contactName, setContactName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactTopic, setContactTopic] = useState('');
  const [contactMessage, setContactMessage] = useState('');
  const [contactSubmitting, setContactSubmitting] = useState(false);
  const [contactSubmitted, setContactSubmitted] = useState(false);

  const handleContactSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!contactTopic || !contactMessage) {
      toast.error(t('contact.fill_required', 'Please fill in all required fields'));
      return;
    }
    
    setContactSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();

      const finalEmail = (contactEmail || user?.email || '').toLowerCase();
      const finalName = contactName || brandName || (user?.email || 'Wishly brand');

      if (!finalEmail) {
        toast.error(t('contact.email_missing', 'We could not determine your email. Please contact support.'));
        return;
      }

      // Rate limit: max 1 message per 24h per email
      const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const lockKey = `wishly_contact_last_sent_${finalEmail}`;
      const lastSentRaw = typeof window !== 'undefined' ? window.localStorage.getItem(lockKey) : null;
      if (lastSentRaw) {
        const lastSent = parseInt(lastSentRaw, 10);
        if (!Number.isNaN(lastSent) && Date.now() - lastSent < 24 * 60 * 60 * 1000) {
          toast.error(t('contact.rate_limited', 'You already sent us a message today. Please wait before sending another.'));
          setContactSubmitting(false);
          return;
        }
      }

      const { count: recentCount, error: recentError } = await (supabase as any)
        .from('contact_messages')
        .select('id', { count: 'exact', head: true })
        .ilike('email', finalEmail)
        .gte('created_at', twentyFourHoursAgo);

      if (recentError) {
        console.error('Error checking contact rate limit (brand):', recentError);
      } else if ((recentCount ?? 0) > 0) {
        toast.error(t('contact.rate_limited', 'You already sent us a message today. Please wait before sending another.'));
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
      setContactTopic('');
      setContactMessage('');
      setTimeout(() => setContactSubmitted(false), 3000);
    } catch (err: any) {
      console.error('Error submitting contact form:', err);
      toast.error(t('contact.send_failed', 'Failed to send message. Please try again.'));
    } finally {
      setContactSubmitting(false);
    }
  };

  // Prefill brand contact name/email once brand data is loaded
  useEffect(() => {
    if (brandName && !contactName) {
      setContactName(brandName);
    }
    if (email && !contactEmail) {
      setContactEmail(email);
    }
  }, [brandName, email, contactName, contactEmail]);

  useEffect(() => {
    fetchBrandData();
  }, []);

  // Realtime listener: keep adminMasterControl in sync when admin toggles Master Control
  useEffect(() => {
    let channel: any;

    const setupRealtime = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      channel = (supabase as any)
        .channel(`admin-master-control-${user.id}`)
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'user_profiles',
            filter: `id=eq.${user.id}`,
          },
          (payload: any) => {
            const next = payload?.new?.admin_master_control === true;
            setAdminMasterControl(next);
            // Any update on this profile row still updates local adminMasterControl
          }
        )
        .on(
          'broadcast',
          { event: 'refresh' },
          () => {
            // Admin explicitly requested a remote refresh for this brand
            fetchBrandData();
          }
        )
        .subscribe();
    };

    setupRealtime();

    return () => {
      if (channel) {
        (supabase as any).removeChannel(channel);
      }
    };
  }, []);

  const fetchBrandData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Fetch admin_master_control once on load
      const { data: profileData } = await (supabase as any)
        .from("user_profiles")
        .select("admin_master_control")
        .eq("id", user.id)
        .maybeSingle();
      
      setAdminMasterControl(profileData?.admin_master_control === true);

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
        setWhatsapp(data.whatsapp || "");
        setAddress(data.address || "");
        setStoreLocations(data.store_locations || []);
        setInstagram(data.instagram || "");
        setTwitter(data.twitter || "");
        setFacebook(data.facebook || "");
        setLinkedin(data.linkedin || "");
        setTiktok(data.tiktok || "");
        setYoutube(data.youtube || "");
        setLogoUrl(data.logo_url || null);
        setIsPublic(data.is_public !== false);
        setAllowMessages(data.allow_messages !== false);
        setAllowProductRequests(data.allow_product_requests !== false);
        setAutoApproveFollowers(data.auto_approve_followers === true);
        setNotifyNewFollower(data.notify_new_follower !== false);
        setNotifyProductMention(data.notify_product_mention !== false);
        setNotifyReview(data.notify_review !== false);
        setShowAnalyticsPublicly(data.show_analytics_publicly === true);
        setProductsFindMode((data.products_find_mode as any) || 'per_product');
        setProductsAddMode((data.products_add_mode as any) || 'per_product');
        setAllowQuestions(data.allow_questions !== false);
        setAllowLikes(data.allow_likes !== false);
        setShowStoreLink(data.show_store_link !== false);
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
          whatsapp,
          address,
          store_locations: storeLocations,
          instagram,
          twitter,
          facebook,
          linkedin,
          tiktok,
          youtube,
          logo_url: logoUrl,
          is_public: isPublic,
          allow_messages: allowMessages,
          allow_product_requests: allowProductRequests,
          auto_approve_followers: autoApproveFollowers,
          notify_new_follower: notifyNewFollower,
          notify_product_mention: notifyProductMention,
          notify_review: notifyReview,
          show_analytics_publicly: showAnalyticsPublicly,
          products_find_mode: productsFindMode,
          products_add_mode: productsAddMode,
          allow_questions: allowQuestions,
          allow_likes: allowLikes,
          show_store_link: showStoreLink,
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
        <div className="flex items-center justify-center gap-2">
          <h1 className="text-2xl font-bold bg-gradient-to-r from-[hsl(var(--brand-cool-start))] via-[hsl(var(--brand-cool-end))] to-[hsl(var(--brand-warm-end))] bg-clip-text text-transparent">
            {t("brand.profile_title", "Brand Profile")}
          </h1>
          {brand?.is_verified === true && (
            <span className="verified-chip">
              <BadgeCheck className="h-3.5 w-3.5" />
              Verified
            </span>
          )}
        </div>
        <p className="text-sm text-muted-foreground">
          {t("brand.profile_subtitle", "Manage your brand information and appearance")}
        </p>
      </div>

      {/* Followers & Following Stats */}
      <Card className="shadow-lg border border-white/40 bg-gradient-to-br from-white/95 via-white/90 to-white/80">
        <CardContent className="pt-6">
          <div className="grid grid-cols-2 gap-4">
            <button
              onClick={() => navigate("/brand/followers")}
              className="flex flex-col items-center gap-2 p-4 rounded-xl bg-gradient-to-br from-brand-cool-start/10 to-brand-cool-end/10 hover:from-brand-cool-start/20 hover:to-brand-cool-end/20 transition-all"
            >
              <div className="flex items-center gap-2">
                <UserCheck className="h-5 w-5 text-primary" />
                <span className="text-2xl font-bold bg-gradient-to-r from-[hsl(var(--brand-cool-start))] to-[hsl(var(--brand-cool-end))] bg-clip-text text-transparent">
                  {followerCounts?.followers ?? 0}
                </span>
              </div>
              <span className="text-sm font-semibold text-muted-foreground">
                {t("brand.followers", "Followers")}
              </span>
            </button>

            <button
              onClick={() => navigate("/brand/following")}
              className="flex flex-col items-center gap-2 p-4 rounded-xl bg-gradient-to-br from-brand-warm-start/10 to-brand-warm-end/10 hover:from-brand-warm-start/20 hover:to-brand-warm-end/20 transition-all"
            >
              <div className="flex items-center gap-2">
                <UserPlus className="h-5 w-5 text-primary" />
                <span className="text-2xl font-bold bg-gradient-to-r from-[hsl(var(--brand-warm-start))] to-[hsl(var(--brand-warm-end))] bg-clip-text text-transparent">
                  {followerCounts?.following ?? 0}
                </span>
              </div>
              <span className="text-sm font-semibold text-muted-foreground">
                {t("brand.following", "Following")}
              </span>
            </button>
          </div>
        </CardContent>
      </Card>

      {/* Products Settings */}
      <Card className="shadow-lg border border-white/40 bg-gradient-to-br from-white/95 via-white/90 to-white/80">
        <CardHeader className="bg-gradient-to-r from-brand-cool-start/10 via-brand-cool-end/5 to-brand-warm-start/10 pb-4">
          <CardTitle className="text-lg flex items-center gap-2">
            <SettingsIcon className="h-5 w-5 text-primary" />
            {t("brand.products_settings", "Products")}
          </CardTitle>
          <CardDescription>
            {t("brand.products_settings_desc", "Control how users can see and use your products")}
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-6 space-y-6">
          <div className={`space-y-2 ${adminMasterControl ? 'opacity-50' : ''}`}>
            <Label className="text-base font-medium">
              {t("brand.products_find_mode", "Users can find your products")}
            </Label>
            <p className="text-sm text-muted-foreground">
              {t("brand.products_find_mode_hint", "Choose whether products are findable for everyone or per product.")}
            </p>
            {adminMasterControl && (
              <p className="text-xs text-amber-600">{t("brand.disabled_by_admin", "Disabled by administrator")}</p>
            )}
            <div className="inline-flex rounded-full border bg-muted px-1 py-0.5 text-xs mt-2">
              <button
                type="button"
                className={`px-3 py-1 rounded-full ${productsFindMode === 'all_off' ? 'bg-white shadow-sm' : 'text-muted-foreground'}`}
                onClick={async () => {
                  if (adminMasterControl) return;
                  if (!brand?.id) return;
                  const previous = productsFindMode;
                  setProductsFindMode('all_off');
                  try {
                    const { error } = await (supabase as any)
                      .from("brands")
                      .update({ products_find_mode: 'all_off' })
                      .eq("id", brand.id);
                    if (error) throw error;
                    toast.success(t("brand.toggle_update_success", "Setting updated"));
                  } catch (err: any) {
                    setProductsFindMode(previous);
                    toast.error(err.message || t("brand.toggle_update_error", "Failed to update setting"));
                  }
                }}
              >
                {t('brand.mode_all_off', 'All off')}
              </button>
              <button
                type="button"
                className={`px-3 py-1 rounded-full ${productsFindMode === 'all_on' ? 'bg-white shadow-sm' : 'text-muted-foreground'}`}
                onClick={async () => {
                  if (adminMasterControl) return;
                  if (!brand?.id) return;
                  const previous = productsFindMode;
                  setProductsFindMode('all_on');
                  try {
                    const { error } = await (supabase as any)
                      .from("brands")
                      .update({ products_find_mode: 'all_on' })
                      .eq("id", brand.id);
                    if (error) throw error;
                    toast.success(t("brand.toggle_update_success", "Setting updated"));
                  } catch (err: any) {
                    setProductsFindMode(previous);
                    toast.error(err.message || t("brand.toggle_update_error", "Failed to update setting"));
                  }
                }}
              >
                {t('brand.mode_all_on', 'All on')}
              </button>
              <button
                type="button"
                className={`px-3 py-1 rounded-full ${productsFindMode === 'per_product' ? 'bg-white shadow-sm' : 'text-muted-foreground'}`}
                onClick={async () => {
                  if (adminMasterControl) return;
                  if (!brand?.id) return;
                  const previous = productsFindMode;
                  setProductsFindMode('per_product');
                  try {
                    const { error } = await (supabase as any)
                      .from("brands")
                      .update({ products_find_mode: 'per_product' })
                      .eq("id", brand.id);
                    if (error) throw error;
                    toast.success(t("brand.toggle_update_success", "Setting updated"));
                  } catch (err: any) {
                    setProductsFindMode(previous);
                    toast.error(err.message || t("brand.toggle_update_error", "Failed to update setting"));
                  }
                }}
              >
                {t('brand.mode_per_product', 'Per product')}
              </button>
            </div>
          </div>

          <Separator />

          <div className={`space-y-2 ${adminMasterControl ? 'opacity-50' : ''}`}>
            <Label className="text-base font-medium">
              {t("brand.products_add_mode", "Users can add products as an item")}
            </Label>
            <p className="text-sm text-muted-foreground">
              {t("brand.products_add_mode_hint", "Control if products can be added to wishlists or items list.")}
            </p>
            {adminMasterControl && (
              <p className="text-xs text-amber-600">{t("brand.disabled_by_admin", "Disabled by administrator")}</p>
            )}
            <div className="inline-flex rounded-full border bg-muted px-1 py-0.5 text-xs mt-2">
              <button
                type="button"
                className={`px-3 py-1 rounded-full ${productsAddMode === 'all_off' ? 'bg-white shadow-sm' : 'text-muted-foreground'}`}
                onClick={async () => {
                  if (adminMasterControl) return;
                  if (!brand?.id) return;
                  const previous = productsAddMode;
                  setProductsAddMode('all_off');
                  try {
                    const { error } = await (supabase as any)
                      .from("brands")
                      .update({ products_add_mode: 'all_off' })
                      .eq("id", brand.id);
                    if (error) throw error;
                    toast.success(t("brand.toggle_update_success", "Setting updated"));
                  } catch (err: any) {
                    setProductsAddMode(previous);
                    toast.error(err.message || t("brand.toggle_update_error", "Failed to update setting"));
                  }
                }}
              >
                {t('brand.mode_all_off', 'All off')}
              </button>
              <button
                type="button"
                className={`px-3 py-1 rounded-full ${productsAddMode === 'all_on' ? 'bg-white shadow-sm' : 'text-muted-foreground'}`}
                onClick={async () => {
                  if (adminMasterControl) return;
                  if (!brand?.id) return;
                  const previous = productsAddMode;
                  setProductsAddMode('all_on');
                  try {
                    const { error } = await (supabase as any)
                      .from("brands")
                      .update({ products_add_mode: 'all_on' })
                      .eq("id", brand.id);
                    if (error) throw error;
                    toast.success(t("brand.toggle_update_success", "Setting updated"));
                  } catch (err: any) {
                    setProductsAddMode(previous);
                    toast.error(err.message || t("brand.toggle_update_error", "Failed to update setting"));
                  }
                }}
              >
                {t('brand.mode_all_on', 'All on')}
              </button>
              <button
                type="button"
                className={`px-3 py-1 rounded-full ${productsAddMode === 'per_product' ? 'bg-white shadow-sm' : 'text-muted-foreground'}`}
                onClick={async () => {
                  if (adminMasterControl) return;
                  if (!brand?.id) return;
                  const previous = productsAddMode;
                  setProductsAddMode('per_product');
                  try {
                    const { error } = await (supabase as any)
                      .from("brands")
                      .update({ products_add_mode: 'per_product' })
                      .eq("id", brand.id);
                    if (error) throw error;
                    toast.success(t("brand.toggle_update_success", "Setting updated"));
                  } catch (err: any) {
                    setProductsAddMode(previous);
                    toast.error(err.message || t("brand.toggle_update_error", "Failed to update setting"));
                  }
                }}
              >
                {t('brand.mode_per_product', 'Per product')}
              </button>
            </div>
          </div>

          <Separator />

          <div className={`flex items-center justify-between ${adminMasterControl ? 'opacity-50' : ''}`}>
            <div className="space-y-1">
              <Label htmlFor="allowProductRequests" className="text-base font-medium">
                {t("brand.allow_product_requests", "Allow Product Requests")}
              </Label>
              <p className="text-sm text-muted-foreground">
                {t("brand.allow_product_requests_hint", "Users can request products not in your catalog")}
              </p>
              {adminMasterControl && (
                <p className="text-xs text-amber-600">{t("brand.disabled_by_admin", "Disabled by administrator")}</p>
              )}
            </div>
            <Switch
              id="allowProductRequests"
              checked={allowProductRequests}
              onCheckedChange={async (checked) => {
                if (adminMasterControl) return;
                const previous = allowProductRequests;
                setAllowProductRequests(checked);
                try {
                  if (!brand?.id) return;
                  const { error } = await (supabase as any)
                    .from("brands")
                    .update({ allow_product_requests: checked })
                    .eq("id", brand.id);
                  if (error) throw error;
                  toast.success(t("brand.toggle_update_success", "Setting updated"));
                } catch (err: any) {
                  setAllowProductRequests(previous);
                  toast.error(err.message || t("brand.toggle_update_error", "Failed to update setting"));
                }
              }}
              disabled={adminMasterControl}
            />
          </div>

          <Separator />

          <div className={`flex items-center justify-between ${adminMasterControl ? 'opacity-50' : ''}`}>
            <div className="space-y-1">
              <Label htmlFor="allowQuestions" className="text-base font-medium">
                {t("brand.allow_questions", "Allow Questions")}
              </Label>
              <p className="text-sm text-muted-foreground">
                {t("brand.allow_questions_hint", "Users can ask questions on your product cards")}
              </p>
              {adminMasterControl && (
                <p className="text-xs text-amber-600">{t("brand.disabled_by_admin", "Disabled by administrator")}</p>
              )}
            </div>
            <Switch
              id="allowQuestions"
              checked={allowQuestions}
              onCheckedChange={async (checked) => {
                if (adminMasterControl) return;
                const previous = allowQuestions;
                setAllowQuestions(checked);
                try {
                  if (!brand?.id) return;
                  const { error } = await (supabase as any)
                    .from("brands")
                    .update({ allow_questions: checked })
                    .eq("id", brand.id);
                  if (error) throw error;
                  toast.success(t("brand.toggle_update_success", "Setting updated"));
                } catch (err: any) {
                  setAllowQuestions(previous);
                  toast.error(err.message || t("brand.toggle_update_error", "Failed to update setting"));
                }
              }}
              disabled={adminMasterControl}
            />
          </div>

          <Separator />

          <div className={`flex items-center justify-between ${adminMasterControl ? 'opacity-50' : ''}`}>
            <div className="space-y-1">
              <Label htmlFor="allowLikes" className="text-base font-medium">
                {t("brand.allow_likes", "Allow Likes")}
              </Label>
              <p className="text-sm text-muted-foreground">
                {t("brand.allow_likes_hint", "Users can like your products")}
              </p>
              {adminMasterControl && (
                <p className="text-xs text-amber-600">{t("brand.disabled_by_admin", "Disabled by administrator")}</p>
              )}
            </div>
            <Switch
              id="allowLikes"
              checked={allowLikes}
              onCheckedChange={async (checked) => {
                if (adminMasterControl) return;
                const previous = allowLikes;
                setAllowLikes(checked);
                try {
                  if (!brand?.id) return;
                  const { error } = await (supabase as any)
                    .from("brands")
                    .update({ allow_likes: checked })
                    .eq("id", brand.id);
                  if (error) throw error;
                  toast.success(t("brand.toggle_update_success", "Setting updated"));
                } catch (err: any) {
                  setAllowLikes(previous);
                  toast.error(err.message || t("brand.toggle_update_error", "Failed to update setting"));
                }
              }}
              disabled={adminMasterControl}
            />
          </div>

          <Separator />

          <div className={`flex items-center justify-between ${adminMasterControl ? 'opacity-50' : ''}`}>
            <div className="space-y-1">
              <Label htmlFor="showStoreLink" className="text-base font-medium">
                {t("brand.show_store_link", "Show Store Link")}
              </Label>
              <p className="text-sm text-muted-foreground">
                {t("brand.show_store_link_hint", "Show store icon on product cards")}
              </p>
              {adminMasterControl && (
                <p className="text-xs text-amber-600">{t("brand.disabled_by_admin", "Disabled by administrator")}</p>
              )}
            </div>
            <Switch
              id="showStoreLink"
              checked={showStoreLink}
              onCheckedChange={async (checked) => {
                if (adminMasterControl) return;
                const previous = showStoreLink;
                setShowStoreLink(checked);
                try {
                  if (!brand?.id) return;
                  const { error } = await (supabase as any)
                    .from("brands")
                    .update({ show_store_link: checked })
                    .eq("id", brand.id);
                  if (error) throw error;
                  toast.success(t("brand.toggle_update_success", "Setting updated"));
                } catch (err: any) {
                  setShowStoreLink(previous);
                  toast.error(err.message || t("brand.toggle_update_error", "Failed to update setting"));
                }
              }}
              disabled={adminMasterControl}
            />
          </div>
        </CardContent>
      </Card>

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
              className="border-slate-200 focus:border-primary"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="tiktok" className="flex items-center gap-2">
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z"/>
              </svg>
              TikTok
            </Label>
            <Input
              id="tiktok"
              value={tiktok}
              onChange={(e) => setTiktok(e.target.value)}
              className="border-slate-200 focus:border-primary"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="youtube" className="flex items-center gap-2">
              <Youtube className="h-4 w-4 text-red-600" />
              YouTube
            </Label>
            <Input
              id="youtube"
              value={youtube}
              onChange={(e) => setYoutube(e.target.value)}
              className="border-slate-200 focus:border-primary"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="whatsapp" className="flex items-center gap-2">
              <MessageCircle className="h-4 w-4 text-green-600" />
              WhatsApp
            </Label>
            <Input
              id="whatsapp"
              value={whatsapp}
              onChange={(e) => setWhatsapp(e.target.value)}
              className="border-slate-200 focus:border-primary"
            />
          </div>
        </CardContent>
      </Card>

      {/* Store Locations */}
      <Card className="shadow-lg border border-white/40 bg-gradient-to-br from-white/95 via-white/90 to-white/80">
        <CardHeader className="bg-gradient-to-r from-brand-cool-start/10 via-brand-cool-end/5 to-brand-warm-start/10 pb-4">
          <CardTitle className="text-lg flex items-center gap-2">
            <MapPin className="h-5 w-5 text-primary" />
            {t("brand.store_locations", "Store Locations")}
          </CardTitle>
          <CardDescription>
            {t("brand.store_locations_desc", "Add Google Maps links for your physical store locations")}
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-6 space-y-4">
          {storeLocations.map((location, index) => (
            <div key={index} className="flex gap-2">
              <Input
                value={location}
                onChange={(e) => {
                  const newLocations = [...storeLocations];
                  newLocations[index] = e.target.value;
                  setStoreLocations(newLocations);
                }}
                placeholder="https://maps.google.com/..."
                className="border-slate-200 focus:border-primary flex-1"
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => {
                  const newLocations = storeLocations.filter((_, i) => i !== index);
                  setStoreLocations(newLocations);
                }}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ))}
          <Button
            type="button"
            variant="outline"
            onClick={() => setStoreLocations([...storeLocations, ""])}
            className="w-full"
          >
            <Plus className="h-4 w-4 mr-2" />
            {t("brand.add_location", "Add Location")}
          </Button>
        </CardContent>
      </Card>

      {/* Privacy & Interaction Settings */}
      <Card className="shadow-lg border border-white/40 bg-gradient-to-br from-white/95 via-white/90 to-white/80">
        <CardHeader className="bg-gradient-to-r from-brand-cool-start/10 via-brand-cool-end/5 to-brand-warm-start/10 pb-4">
          <CardTitle className="text-lg flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            {t("brand.privacy_interaction", "Privacy & Interaction")}
          </CardTitle>
          <CardDescription>
            {t("brand.privacy_interaction_desc", "Control how users interact with your brand")}
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-6 space-y-6">
          <div className={`flex items-center justify-between ${adminMasterControl ? 'opacity-50' : ''}`}>
            <div className="space-y-1">
              <Label htmlFor="allowMessages" className="text-base font-medium flex items-center gap-2">
                <MessageSquare className="h-4 w-4 text-muted-foreground" />
                {t("brand.allow_messages", "Allow Messages")}
              </Label>
              <p className="text-sm text-muted-foreground">
                {t("brand.allow_messages_hint", "Let users send you direct messages")}
              </p>
              {adminMasterControl && (
                <p className="text-xs text-amber-600">{t("brand.disabled_by_admin", "Disabled by administrator")}</p>
              )}
            </div>
            <Switch
              id="allowMessages"
              checked={allowMessages}
              onCheckedChange={async (checked) => {
                if (adminMasterControl) return;
                const previous = allowMessages;
                setAllowMessages(checked);
                try {
                  if (!brand?.id) return;
                  const { error } = await (supabase as any)
                    .from("brands")
                    .update({ allow_messages: checked })
                    .eq("id", brand.id);
                  if (error) throw error;
                  toast.success(t("brand.toggle_update_success", "Setting updated"));
                } catch (err: any) {
                  setAllowMessages(previous);
                  toast.error(err.message || t("brand.toggle_update_error", "Failed to update setting"));
                }
              }}
              disabled={adminMasterControl}
            />
          </div>

          <Separator />

          <div className={`flex items-center justify-between ${adminMasterControl ? 'opacity-50' : ''}`}>
            <div className="space-y-1">
              <Label htmlFor="autoApproveFollowers" className="text-base font-medium flex items-center gap-2">
                <Users className="h-4 w-4 text-muted-foreground" />
                {t("brand.auto_approve_followers", "Auto-Approve Followers")}
              </Label>
              <p className="text-sm text-muted-foreground">
                {t("brand.auto_approve_followers_hint", "Automatically accept all follow requests")}
              </p>
              {adminMasterControl && (
                <p className="text-xs text-amber-600">{t("brand.disabled_by_admin", "Disabled by administrator")}</p>
              )}
            </div>
            <Switch
              id="autoApproveFollowers"
              checked={autoApproveFollowers}
              onCheckedChange={async (checked) => {
                if (adminMasterControl) return;
                const previous = autoApproveFollowers;
                setAutoApproveFollowers(checked);
                try {
                  if (!brand?.id) return;
                  const { error } = await (supabase as any)
                    .from("brands")
                    .update({ auto_approve_followers: checked })
                    .eq("id", brand.id);
                  if (error) throw error;
                  toast.success(t("brand.toggle_update_success", "Setting updated"));
                } catch (err: any) {
                  setAutoApproveFollowers(previous);
                  toast.error(err.message || t("brand.toggle_update_error", "Failed to update setting"));
                }
              }}
              disabled={adminMasterControl}
            />
          </div>
        </CardContent>
      </Card>

      {/* Notification Settings */}
      <Card className="shadow-lg border border-white/40 bg-gradient-to-br from-white/95 via-white/90 to-white/80">
        <CardHeader className="bg-gradient-to-r from-brand-cool-start/10 via-brand-cool-end/5 to-brand-warm-start/10 pb-4">
          <CardTitle className="text-lg flex items-center gap-2">
            <Bell className="h-5 w-5 text-primary" />
            {t("brand.notifications", "Notifications")}
          </CardTitle>
          <CardDescription>
            {t("brand.notifications_desc", "Choose what notifications you want to receive")}
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-6 space-y-6">
          <div className={`flex items-center justify-between ${adminMasterControl ? 'opacity-50' : ''}`}>
            <div className="space-y-1">
              <Label htmlFor="notifyNewFollower" className="text-base font-medium">
                {t("brand.notify_new_follower", "New Followers")}
              </Label>
              <p className="text-sm text-muted-foreground">
                {t("brand.notify_new_follower_hint", "Get notified when someone follows your brand")}
              </p>
              {adminMasterControl && (
                <p className="text-xs text-amber-600">{t("brand.disabled_by_admin", "Disabled by administrator")}</p>
              )}
            </div>
            <Switch
              id="notifyNewFollower"
              checked={notifyNewFollower}
              onCheckedChange={async (checked) => {
                if (adminMasterControl) return;
                const previous = notifyNewFollower;
                setNotifyNewFollower(checked);
                try {
                  if (!brand?.id) return;
                  const { error } = await (supabase as any)
                    .from("brands")
                    .update({ notify_new_follower: checked })
                    .eq("id", brand.id);
                  if (error) throw error;
                  toast.success(t("brand.toggle_update_success", "Setting updated"));
                } catch (err: any) {
                  setNotifyNewFollower(previous);
                  toast.error(err.message || t("brand.toggle_update_error", "Failed to update setting"));
                }
              }}
              disabled={adminMasterControl}
            />
          </div>

          <Separator />

          <div className={`flex items-center justify-between ${adminMasterControl ? 'opacity-50' : ''}`}>
            <div className="space-y-1">
              <Label htmlFor="notifyProductMention" className="text-base font-medium">
                {t("brand.notify_product_mention", "Product Mentions")}
              </Label>
              <p className="text-sm text-muted-foreground">
                {t("brand.notify_product_mention_hint", "When users add your products to wishlists")}
              </p>
              {adminMasterControl && (
                <p className="text-xs text-amber-600">{t("brand.disabled_by_admin", "Disabled by administrator")}</p>
              )}
            </div>
            <Switch
              id="notifyProductMention"
              checked={notifyProductMention}
              onCheckedChange={async (checked) => {
                if (adminMasterControl) return;
                const previous = notifyProductMention;
                setNotifyProductMention(checked);
                try {
                  if (!brand?.id) return;
                  const { error } = await (supabase as any)
                    .from("brands")
                    .update({ notify_product_mention: checked })
                    .eq("id", brand.id);
                  if (error) throw error;
                  toast.success(t("brand.toggle_update_success", "Setting updated"));
                } catch (err: any) {
                  setNotifyProductMention(previous);
                  toast.error(err.message || t("brand.toggle_update_error", "Failed to update setting"));
                }
              }}
              disabled={adminMasterControl}
            />
          </div>

          <Separator />

          <div className={`flex items-center justify-between ${adminMasterControl ? 'opacity-50' : ''}`}>
            <div className="space-y-1">
              <Label htmlFor="notifyReview" className="text-base font-medium">
                {t("brand.notify_review", "Reviews & Feedback")}
              </Label>
              <p className="text-sm text-muted-foreground">
                {t("brand.notify_review_hint", "Get notified about new reviews")}
              </p>
              {adminMasterControl && (
                <p className="text-xs text-amber-600">{t("brand.disabled_by_admin", "Disabled by administrator")}</p>
              )}
            </div>
            <Switch
              id="notifyReview"
              checked={notifyReview}
              onCheckedChange={async (checked) => {
                if (adminMasterControl) return;
                const previous = notifyReview;
                setNotifyReview(checked);
                try {
                  if (!brand?.id) return;
                  const { error } = await (supabase as any)
                    .from("brands")
                    .update({ notify_review: checked })
                    .eq("id", brand.id);
                  if (error) throw error;
                  toast.success(t("brand.toggle_update_success", "Setting updated"));
                } catch (err: any) {
                  setNotifyReview(previous);
                  toast.error(err.message || t("brand.toggle_update_error", "Failed to update setting"));
                }
              }}
              disabled={adminMasterControl}
            />
          </div>
        </CardContent>
      </Card>

      {/* Analytics Settings */}
      <Card className="shadow-lg border border-white/40 bg-gradient-to-br from-white/95 via-white/90 to-white/80">
        <CardHeader className="bg-gradient-to-r from-brand-cool-start/10 via-brand-cool-end/5 to-brand-warm-start/10 pb-4">
          <CardTitle className="text-lg flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            {t("brand.analytics_settings", "Analytics & Insights")}
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-6">
          <div className={`flex items-center justify-between ${adminMasterControl ? 'opacity-50' : ''}`}>
            <div className="space-y-1">
              <Label htmlFor="showAnalyticsPublicly" className="text-base font-medium">
                {t("brand.show_analytics_publicly", "Public Analytics")}
              </Label>
              <p className="text-sm text-muted-foreground">
                {t("brand.show_analytics_publicly_hint", "Display basic stats on your public profile")}
              </p>
              {adminMasterControl && (
                <p className="text-xs text-amber-600">{t("brand.disabled_by_admin", "Disabled by administrator")}</p>
              )}
            </div>
            <Switch
              id="showAnalyticsPublicly"
              checked={showAnalyticsPublicly}
              onCheckedChange={async (checked) => {
                if (adminMasterControl) return;
                const previous = showAnalyticsPublicly;
                setShowAnalyticsPublicly(checked);
                try {
                  if (!brand?.id) return;
                  const { error } = await (supabase as any)
                    .from("brands")
                    .update({ show_analytics_publicly: checked })
                    .eq("id", brand.id);
                  if (error) throw error;
                  toast.success(t("brand.toggle_update_success", "Setting updated"));
                } catch (err: any) {
                  setShowAnalyticsPublicly(previous);
                  toast.error(err.message || t("brand.toggle_update_error", "Failed to update setting"));
                }
              }}
              disabled={adminMasterControl}
            />
          </div>
        </CardContent>
      </Card>

      {/* Visibility & Language Settings */}
      <Card className="shadow-lg border border-white/40 bg-gradient-to-br from-white/95 via-white/90 to-white/80">
        <CardHeader className="bg-gradient-to-r from-brand-cool-start/10 via-brand-cool-end/5 to-brand-warm-start/10 pb-4">
          <CardTitle className="text-lg">
            {t("brand.visibility_settings", "Visibility & Language")}
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-6 space-y-6">
          <div className={`flex items-center justify-between ${adminMasterControl ? 'opacity-50' : ''}`}>
            <div className="space-y-1">
              <Label htmlFor="isPublic" className="text-base font-medium">
                {t("brand.field_public", "Public Profile")}
              </Label>
              <p className="text-sm text-muted-foreground">
                {t("brand.field_public_hint", "Allow users to discover and view your brand")}
              </p>
              {adminMasterControl && (
                <p className="text-xs text-amber-600">{t("brand.disabled_by_admin", "Disabled by administrator")}</p>
              )}
            </div>
            <Switch
              id="isPublic"
              checked={isPublic}
              onCheckedChange={async (checked) => {
                if (adminMasterControl) return;
                const previous = isPublic;
                setIsPublic(checked);
                try {
                  if (!brand?.id) return;
                  const { error } = await (supabase as any)
                    .from("brands")
                    .update({ is_public: checked })
                    .eq("id", brand.id);
                  if (error) throw error;
                  toast.success(t("brand.toggle_update_success", "Setting updated"));
                } catch (err: any) {
                  setIsPublic(previous);
                  toast.error(err.message || t("brand.toggle_update_error", "Failed to update setting"));
                }
              }}
              disabled={adminMasterControl}
            />
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Label className="text-base font-medium">
                {t("brand.language", "Language")}
              </Label>
              <p className="text-sm text-muted-foreground">
                {t("brand.language_hint", "Switch between English and Arabic")}
              </p>
            </div>
            <LanguageToggle />
          </div>
        </CardContent>
      </Card>

      {/* Contact Us */}
      <Card className="shadow-lg border border-white/40 bg-gradient-to-br from-white/95 via-white/90 to-white/80">
        <CardHeader className="bg-gradient-to-r from-brand-cool-start/10 via-brand-cool-end/5 to-brand-warm-start/10 pb-4">
          <CardTitle className="text-lg flex items-center gap-2">
            <Mail className="h-5 w-5 text-primary" />
            {t('settings.contact_us', 'Contact Us')}
          </CardTitle>
          <CardDescription>
            {t('settings.contact_desc', 'Have a question, feedback, or need help? Send us a message.')}
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-6 space-y-4">
          <form onSubmit={handleContactSubmit} className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="contact-name" className="text-xs">
                {t('contact.name', 'Name')} <span className="text-red-500">*</span>
              </Label>
              <Input
                id="contact-name"
                value={contactName}
                onChange={(e) => setContactName(e.target.value)}
                placeholder={t('contact.name_placeholder', 'Your name')}
                className="border-slate-200 focus:border-primary"
                disabled={contactSubmitting}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="contact-email" className="text-xs">
                {t('contact.email', 'Email')} <span className="text-red-500">*</span>
              </Label>
              <Input
                id="contact-email"
                type="email"
                value={contactEmail}
                onChange={(e) => setContactEmail(e.target.value)}
                placeholder={t('contact.email_placeholder', 'Your email')}
                className="border-slate-200 focus:border-primary"
                disabled={contactSubmitting}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="contact-topic" className="text-xs">
                {t('contact.topic', 'Topic')} <span className="text-red-500">*</span>
              </Label>
              <Select value={contactTopic} onValueChange={setContactTopic} disabled={contactSubmitting}>
                <SelectTrigger id="contact-topic" className="border-slate-200">
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
                className="border-slate-200 focus:border-primary resize-none"
                rows={4}
                disabled={contactSubmitting}
                required
              />
            </div>
            <Button type="submit" disabled={contactSubmitting} className="w-full sm:w-auto bg-gradient-to-r from-brand-cool-start to-brand-cool-end text-white">
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

      {/* Sign Out Button */}
      <Button
        variant="outline"
        onClick={async () => {
          await supabase.auth.signOut();
          toast.success(t("auth.logout_success", "Logged out successfully"));
          navigate("/login");
        }}
        className="w-full border-rose-200 text-rose-600 hover:bg-rose-50 hover:text-rose-700 py-6 text-lg font-semibold"
      >
        <span className="flex items-center gap-2">
          <LogOut className="h-5 w-5" />
          {t("auth.sign_out", "Sign Out")}
        </span>
      </Button>
    </div>
  );
};

export default BrandProfile;
