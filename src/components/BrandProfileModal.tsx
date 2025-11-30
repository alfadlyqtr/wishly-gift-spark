import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Store, Instagram, Twitter, Facebook, Linkedin, Globe, X, UserPlus, UserCheck, BadgeCheck, Mail, Phone, MessageCircle, MapPin, Youtube } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import "@/styles/brand-profile-card.css";

interface BrandProfileModalProps {
  brandId: string;
  isOpen: boolean;
  onClose: () => void;
}

interface BrandProfile {
  id: string;
  brand_name: string;
  tagline?: string;
  description?: string;
  logo_url?: string;
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
  brand_website?: string;
}

export const BrandProfileModal = ({ brandId, isOpen, onClose }: BrandProfileModalProps) => {
  const { t } = useTranslation();
  const [brand, setBrand] = useState<BrandProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [isFollowing, setIsFollowing] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);

  useEffect(() => {
    if (isOpen && brandId) {
      fetchBrandProfile();
      checkFollowStatus();
    }
  }, [isOpen, brandId]);

  const fetchBrandProfile = async () => {
    try {
      setLoading(true);
      const { data, error } = await (supabase as any)
        .from("brands")
        .select("*")
        .eq("id", brandId)
        .eq("is_public", true)
        .single();

      if (error) throw error;
      setBrand(data);
    } catch (err: any) {
      toast.error(t("brand.profile_not_found", "Brand profile not found"));
      onClose();
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
        .eq("brand_id", brandId)
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
        const { error } = await (supabase as any)
          .from("brand_followers")
          .delete()
          .eq("brand_id", brandId)
          .eq("follower_id", user.id);

        if (error) throw error;
        setIsFollowing(false);
        toast.success(t("brand.unfollowed", "Unfollowed brand"));
      } else {
        const { error } = await (supabase as any)
          .from("brand_followers")
          .insert({
            brand_id: brandId,
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

  if (!isOpen) return null;

  // Prepare social and contact links
  const socialLinks = brand ? [
    { icon: Mail, url: brand.email ? `mailto:${brand.email}` : null, id: "email" },
    { icon: Phone, url: brand.phone ? `tel:${brand.phone}` : null, id: "phone" },
    { icon: MessageCircle, url: brand.whatsapp ? `https://wa.me/${brand.whatsapp?.replace(/[^0-9]/g, '')}` : null, id: "whatsapp" },
    { icon: MapPin, url: brand.store_locations?.[0] || null, id: "location" },
    { icon: Instagram, url: brand.instagram, id: "instagram" },
    { icon: Twitter, url: brand.twitter, id: "twitter" },
    { icon: Facebook, url: brand.facebook, id: "facebook" },
    { icon: Linkedin, url: brand.linkedin, id: "linkedin" },
    { 
      icon: () => (
        <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
          <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z"/>
        </svg>
      ), 
      url: brand.tiktok, 
      id: "tiktok" 
    },
    { icon: Youtube, url: brand.youtube, id: "youtube" },
    { icon: Globe, url: brand.brand_website, id: "website" },
  ].filter(link => link.url) : [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="relative" onClick={(e) => e.stopPropagation()}>
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute -top-12 left-0 flex items-center gap-2 px-4 py-2 rounded-lg bg-black/80 text-white hover:bg-black transition-colors"
        >
          <X className="h-4 w-4" />
          <span className="text-sm font-medium">Back</span>
        </button>

        {loading ? (
          <div className="brand-profile-card">
            <div className="flex items-center justify-center h-full">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
            </div>
          </div>
        ) : brand ? (
          <div className="brand-profile-card">
            {/* Animated Wave Background */}
            <div className="wave"></div>
            <div className="wave"></div>
            <div className="wave"></div>
            
            {/* Verified Badge */}
            <div className="verified-badge">
              <BadgeCheck />
              <span>Verified</span>
            </div>
            
            {/* Logo */}
            <div className="brand-profile-image">
              {brand.logo_url ? (
                <img src={brand.logo_url} alt={brand.brand_name} className="brand-pfp" />
              ) : (
                <div className="brand-pfp-placeholder">
                  <Store className="h-12 w-12 text-gray-600" />
                </div>
              )}
            </div>

            {/* Brand Name */}
            <div className="brand-name">{brand.brand_name}</div>

            {/* Tagline */}
            {brand.tagline && (
              <div className="brand-tagline">{brand.tagline}</div>
            )}

            {/* Description */}
            {brand.description && (
              <div className="brand-description">{brand.description}</div>
            )}

            {/* Social Bar */}
            <div className="brand-socialbar">
              {socialLinks.map((link) => {
                const Icon = link.icon;
                return (
                  <a
                    key={link.id}
                    href={link.url || '#'}
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
        ) : null}
      </div>
    </div>
  );
};
