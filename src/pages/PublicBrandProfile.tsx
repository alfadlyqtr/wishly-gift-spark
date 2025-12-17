import { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Store, Instagram, Twitter, Facebook, Linkedin, Globe, UserPlus, UserCheck, Mail, Phone, MapPin, Youtube, MessageCircle, Plus, BadgeCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import BackButton from "@/components/BackButton";
import WishAddDialog from "@/components/wishes/WishAddDialog";
import { useWishlists } from "@/hooks/use-wishlists";
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
  is_verified?: boolean;
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
  const [products, setProducts] = useState<any[]>([]);
  const [productsLoading, setProductsLoading] = useState(false);
  const [productForWishAdd, setProductForWishAdd] = useState<any | null>(null);

  const wishlistsQuery = useWishlists();
  const wishlistOptions = useMemo(
    () => (wishlistsQuery.data || []).map((w) => ({ id: w.id, name: w.title })),
    [wishlistsQuery.data],
  );

  const fetchBrandProducts = async () => {
    try {
      if (!id) return;
      setProductsLoading(true);
      const { data, error } = await (supabase as any)
        .from("brand_products")
        .select("id,name,description,image_url,is_findable,allow_add_as_item,product_url")
        .eq("brand_id", id)
        .eq("is_findable", true)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setProducts(data ?? []);
    } catch (err) {
      console.error("Error loading brand products", err);
    } finally {
      setProductsLoading(false);
    }
  };

  useEffect(() => {
    fetchBrandProfile();
    checkFollowStatus();
    fetchBrandProducts();
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

  const socialLinks = brand ? [
    { icon: Mail, url: brand.email ? `mailto:${brand.email}` : null, id: "email", original: brand.email },
    { icon: Phone, url: brand.phone ? `tel:${brand.phone}` : null, id: "phone", original: brand.phone },
    { icon: MessageCircle, url: getSocialUrl("whatsapp", brand.whatsapp), id: "whatsapp", original: brand.whatsapp },
    { icon: MapPin, url: brand.store_locations?.[0] || null, id: "location", original: brand.store_locations?.[0] },
    { icon: Instagram, url: getSocialUrl("instagram", brand.instagram), id: "instagram", original: brand.instagram },
    { icon: Twitter, url: getSocialUrl("twitter", brand.twitter), id: "twitter", original: brand.twitter },
    { icon: Facebook, url: getSocialUrl("facebook", brand.facebook), id: "facebook", original: brand.facebook },
    { icon: Linkedin, url: getSocialUrl("linkedin", brand.linkedin), id: "linkedin", original: brand.linkedin },
    { icon: TikTokIcon, url: getSocialUrl("tiktok", brand.tiktok), id: "tiktok", original: brand.tiktok },
    { icon: Youtube, url: getSocialUrl("youtube", brand.youtube), id: "youtube", original: brand.youtube },
    { icon: Globe, url: getSocialUrl("website", brand.brand_website), id: "website", original: brand.brand_website },
  ].filter(link => link.original) : [];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 py-8 px-4">
      <div className="container max-w-2xl mx-auto">
        <div className="mb-6">
          <BackButton onClick={() => navigate(-1)}>{t("common.back", "Back")}</BackButton>
        </div>

        <div className="flex justify-center">
          <div className="brand-profile-card">
            <div className="wave"></div>
            <div className="wave"></div>
            <div className="wave"></div>

            {brand.is_verified === true && (
              <div className="verified-badge">
                <BadgeCheck />
                <span>{t("brand.verified", "Verified")}</span>
              </div>
            )}

            <div className={brand.is_verified ? "verified-avatar" : ""}>
              <div className="brand-profile-image">
                {brand.logo_url ? (
                  <img src={brand.logo_url} alt={brand.brand_name} className="brand-pfp" />
                ) : (
                  <div className="brand-pfp-placeholder">
                    <Store className="h-12 w-12 text-gray-600" />
                  </div>
                )}
              </div>
            </div>

            <div className="brand-name">{brand.brand_name}</div>

            {brand.tagline && (
              <div className="brand-tagline">{brand.tagline}</div>
            )}

            {brand.description && (
              <div className="brand-description">{brand.description}</div>
            )}

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

            <div className="mt-4 w-full rounded-2xl bg-black/20 border border-white/15 px-3 pt-3 pb-2 backdrop-blur-sm">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-white/95">
                  {t("brand.products", "Products")}
                </span>
                {products.length > 0 && (
                  <span className="inline-flex items-center justify-center min-w-[18px] h-4 rounded-full bg-white/20 text-[10px] text-white/90 px-1">
                    {products.length}
                  </span>
                )}
              </div>
              <div className="max-h-52 overflow-y-auto space-y-1.5 pr-1">
                {productsLoading ? (
                  <div className="flex items-center justify-center py-3 text-xs text-white/80">
                    {t("brand.loading_products", "Loading products...")}
                  </div>
                ) : products.length === 0 ? (
                  <div className="rounded-full bg-white/10 px-3 py-1.5 text-[11px] text-white/90">
                    {t("brand.no_products", "This brand has no public products yet.")}
                  </div>
                ) : (
                  products.map((p) => (
                    <div
                      key={p.id}
                      className="flex items-center gap-2 rounded-full bg-white/95 px-2.5 py-1 border border-white/80 shadow-sm hover:bg-white"
                    >
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        {p.image_url ? (
                          <div className="h-9 w-9 rounded-full overflow-hidden flex-shrink-0 ring-1 ring-slate-200">
                            <img
                              src={p.image_url}
                              alt={p.name || "product"}
                              className="h-full w-full object-cover"
                              onError={(e: any) => {
                                e.currentTarget.style.display = "none";
                              }}
                            />
                          </div>
                        ) : (
                          <div className="h-9 w-9 rounded-full bg-gradient-to-br from-purple-500 to-sky-400 flex items-center justify-center text-white text-xs flex-shrink-0">
                            <Store className="h-4 w-4" />
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <div className="text-[11px] font-semibold text-slate-900 truncate">
                            {p.name || t("brand.untitled_product", "Untitled product")}
                          </div>
                          {p.description && (
                            <div className="text-[10px] text-slate-600 truncate">
                              {p.description}
                            </div>
                          )}
                        </div>
                      </div>
                      <button
                        type="button"
                        className={`flex-shrink-0 h-6 w-6 rounded-full flex items-center justify-center transition-all ${
                          p.allow_add_as_item === false
                            ? "bg-slate-200 text-slate-400 cursor-not-allowed"
                            : "bg-gradient-to-br from-purple-500 to-violet-600 text-white hover:shadow-md"
                        }`}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (p.allow_add_as_item !== false) {
                            setProductForWishAdd(p);
                          }
                        }}
                        disabled={p.allow_add_as_item === false}
                        aria-label={t("explore.add_as_item", "Add as item")}
                      >
                        <Plus className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>

        {productForWishAdd && wishlistOptions.length > 0 && (
          <WishAddDialog
            open={!!productForWishAdd}
            onOpenChange={(open) => {
              if (!open) setProductForWishAdd(null);
            }}
            wishlists={wishlistOptions}
            initialTitle={productForWishAdd.name || ""}
            initialBrand={brand?.brand_name || ""}
            initialDescription={productForWishAdd.description || ""}
            initialImageUrl={productForWishAdd.image_url || null}
            onSubmit={async ({ wishlistId, title, brand: brandName, description, desire, imagePreviewUrl }) => {
              try {
                const effectiveTitle = title || productForWishAdd.name || "";
                const effectiveBrand = brandName || brand?.brand_name || "";
                const { data: { user } } = await supabase.auth.getUser();
                if (!user) {
                  toast.error(t("common.login_required", "Please login to add items"));
                  return;
                }
                const { error } = await supabase.from("wishlist_items").insert({
                  wishlist_id: wishlistId,
                  title: effectiveTitle,
                  brand: effectiveBrand,
                  description: description || "",
                  desire: desire,
                  image_url: imagePreviewUrl || productForWishAdd.image_url || null,
                  item_url: productForWishAdd.product_url || null,
                  brand_product_id: productForWishAdd.id || null,
                });
                if (error) throw error;
                toast.success(t("explore.item_added", "Item added to wishlist"));
                setProductForWishAdd(null);
              } catch (err: any) {
                toast.error(err.message || t("common.error", "Something went wrong"));
              }
            }}
          />
        )}
      </div>
    </div>
  );
};

export default PublicBrandProfile;
