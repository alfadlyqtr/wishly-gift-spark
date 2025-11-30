import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Store, Instagram, Twitter, Facebook, Linkedin, Globe, ArrowLeft, UserPlus, UserCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import BackButton from "@/components/BackButton";
import "@/styles/brand-profile-card.css";

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
    { icon: Instagram, url: brand.instagram, id: "instagram", color: "#d62976" },
    { icon: Twitter, url: brand.twitter, id: "twitter", color: "#00acee" },
    { icon: Facebook, url: brand.facebook, id: "facebook", color: "#3b5998" },
    { icon: Linkedin, url: brand.linkedin, id: "linkedin", color: "#0077b5" },
  ].filter(link => link.url);

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
                  href={brand.brand_website}
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
