import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Store, Instagram, Twitter, Facebook, Linkedin, Globe, ArrowLeft, UserPlus, UserCheck, Mail, Phone, MapPin, Youtube, MessageCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import BackButton from "@/components/BackButton";
import "@/styles/brand-profile-card.css";

// Custom TikTok Icon since it's not in Lucide v1
const TikTokIcon = ({ className }: { className?: string }) => (
  <svg 
    className={className} 
    viewBox="0 0 24 24" 
    fill="currentColor"
    stroke="none"
  >
    <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z"/>
  </svg>
);

/**
 * Convert a social media handle/username to a full URL.
 * Handles cases where user enters:
 * - Full URL (https://instagram.com/user)
 * - Partial URL (instagram.com/user)
 * - Username with @ (@username)
 * - Plain username (username)
 */
const getSocialUrl = (platform: string, value: string | undefined): string => {
  if (!value) return "";
  const url = value.trim();
  
  // If it's already a URL, return it
  if (url.startsWith("http://") || url.startsWith("https://")) {
    return url;
  }

  // If it looks like a domain (e.g. instagram.com/foo), prepend https://
  if (url.includes(".") && !url.startsWith("@")) {
    return `https://${url}`;
  }

  // Clean up value (remove @ if present)
  const cleanValue = url.replace(/^@/, "");

  // Map platforms to their base URLs
  const baseUrls: Record<string, string> = {
    instagram: "https://instagram.com/",
    twitter: "https://twitter.com/",
    facebook: "https://facebook.com/",
    linkedin: "https://linkedin.com/company/",
    tiktok: "https://tiktok.com/@",
    youtube: "https://youtube.com/@",
    whatsapp: "https://wa.me/",
    website: "https://"
  };

  const baseUrl = baseUrls[platform];
  if (baseUrl) {
    // Special handling for WhatsApp: remove non-digit characters (except + if needed, but wa.me prefers clean numbers)
    if (platform === 'whatsapp') {
      const number = cleanValue.replace(/[^0-9]/g, '');
      return `${baseUrl}${number}`;
    }
    if (platform === 'website') return `https://${cleanValue}`;
    return `${baseUrl}${cleanValue}`;
  }

  return `https://${cleanValue}`;
};

interface BrandProfile {
  id: string;
  brand_name: string;
  tagline?: string;
  description?: string;
  logo_url?: string;
  instagram?: string;
  twitter?: string;
  facebook?: string;
  linkedin?: string;
  tiktok?: string;
  youtube?: string;
  whatsapp?: string;
  brand_website?: string;
  is_public: boolean;
}

const PublicBrandProfile = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [brand, setBrand] = useState<BrandProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [isFollowing, setIsFollowing] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);

  useEffect(() => {
    fetchBrandProfile();
    checkFollowStatus();
  }, [id]);

  const fetchBrandProfile = async () => {
    try {
      const { data, error } = await (supabase as any)
        .from("brands")
        .select("*")
        .eq("id", id)
        .eq("is_public", true)
        .single();

      if (error) throw error;
      setBrand(data);
    } catch (err: any) {
      toast.error(t("brand.profile_not_found", "Brand profile not found"));
      navigate("/explore");
    } finally {
      setLoading(false);
    }
  };

  const checkFollowStatus = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data } = await (supabase as any)
        .from("brand_followers")
        .select("status")
        .eq("brand_id", id)
        .eq("follower_id", user.id)
        .maybeSingle();

      setIsFollowing(data?.status === "accepted");
    } catch (err) {
      console.error("Error checking follow status:", err);
    }
  };

  const handleFollow = async () => {
    try {
      setFollowLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error(t("common.login_required", "Please login to follow"));
        return;
      }

      if (isFollowing) {
        // Unfollow
        const { error } = await (supabase as any)
          .from("brand_followers")
          .delete()
          .eq("brand_id", id)
          .eq("follower_id", user.id);

        if (error) throw error;
        setIsFollowing(false);
        toast.success(t("brand.unfollowed", "Unfollowed brand"));
      } else {
        // Follow
        const { error } = await (supabase as any)
          .from("brand_followers")
          .insert({
            brand_id: id,
            follower_id: user.id,
            follower_type: "user",
            status: "accepted"
          });

        if (error) throw error;
        setIsFollowing(true);
        toast.success(t("brand.followed", "Following brand"));
      }
    } catch (err: any) {
      toast.error(err.message || t("common.error", "Something went wrong"));
    } finally {
      setFollowLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!brand) return null;

  const socialLinks = [
    { icon: Instagram, url: getSocialUrl("instagram", brand.instagram), id: "instagram", color: "#d62976", original: brand.instagram },
    { icon: Twitter, url: getSocialUrl("twitter", brand.twitter), id: "twitter", color: "#00acee", original: brand.twitter },
    { icon: Facebook, url: getSocialUrl("facebook", brand.facebook), id: "facebook", color: "#3b5998", original: brand.facebook },
    { icon: Linkedin, url: getSocialUrl("linkedin", brand.linkedin), id: "linkedin", color: "#0077b5", original: brand.linkedin },
    { icon: TikTokIcon, url: getSocialUrl("tiktok", brand.tiktok), id: "tiktok", color: "#000000", original: brand.tiktok },
    { icon: Youtube, url: getSocialUrl("youtube", brand.youtube), id: "youtube", color: "#FF0000", original: brand.youtube },
    { icon: MessageCircle, url: getSocialUrl("whatsapp", brand.whatsapp), id: "whatsapp", color: "#25D366", original: brand.whatsapp },
  ].filter(link => link.original);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 py-8 px-4">
      <div className="container max-w-2xl mx-auto">
        <div className="mb-6">
          <BackButton onClick={() => navigate(-1)}>{t("common.back", "Back")}</BackButton>
        </div>

        {/* Neumorphic Dark Card */}
        <div className="flex justify-center">
          <div className="brand-profile-card">
            {/* Logo */}
            <div className="brand-profile-image">
              {brand.logo_url ? (
                <img src={brand.logo_url} alt={brand.brand_name} className="brand-pfp" />
              ) : (
                <div className="brand-pfp-placeholder">
                  <Store className="h-12 w-12 text-white" />
                </div>
              )}
            </div>

            {/* Brand Name */}
            <div className="brand-name">{brand.brand_name}</div>

            {/* Social Bar */}
            <div className="brand-socialbar">
              {socialLinks.map((link) => {
                const Icon = link.icon;
                return (
                  <a
                    key={link.id}
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="brand-social-link"
                    data-social={link.id}
                    title={link.id}
                  >
                    <Icon className="h-5 w-5" />
                  </a>
                );
              })}
              {brand.brand_website && (
                <a
                  href={getSocialUrl("website", brand.brand_website)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="brand-social-link"
                  data-social="website"
                  title="website"
                >
                  <Globe className="h-5 w-5" />
                </a>
              )}
            </div>

            {/* Follow Button */}
            <button
              onClick={handleFollow}
              disabled={followLoading}
              className="brand-follow-btn"
            >
              {isFollowing ? (
                <>
                  <UserCheck className="h-4 w-4 mr-2" />
                  {t("brand.following", "Following")}
                </>
              ) : (
                <>
                  <UserPlus className="h-4 w-4 mr-2" />
                  {t("brand.follow", "Follow")}
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PublicBrandProfile;
