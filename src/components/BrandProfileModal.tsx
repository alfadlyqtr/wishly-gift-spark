import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Store, Instagram, Twitter, Facebook, Linkedin, Globe, X, UserPlus, UserCheck, BadgeCheck, Mail, Phone, MessageCircle, MapPin, Youtube, Plus, Heart } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import WishAddDialog from "@/components/wishes/WishAddDialog";
import { useWishlists } from "@/hooks/use-wishlists";
import "@/styles/brand-profile-card.css";

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
  is_verified?: boolean;
}

export const BrandProfileModal = ({ brandId, isOpen, onClose }: BrandProfileModalProps) => {
  const { t } = useTranslation();
  const [brand, setBrand] = useState<BrandProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [isFollowing, setIsFollowing] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);
  const [products, setProducts] = useState<any[]>([]);
  const [productsLoading, setProductsLoading] = useState(false);
  const [selectedProductForModal, setSelectedProductForModal] = useState<any | null>(null);
  const [selectedProductLiked, setSelectedProductLiked] = useState(false);
  const [productForWishAdd, setProductForWishAdd] = useState<any | null>(null);
  const [productWishlistIds, setProductWishlistIds] = useState<Record<string, string[]>>({});
  const [wishlistTitlesById, setWishlistTitlesById] = useState<Record<string, string>>({});
  const wishlistsQuery = useWishlists();
  const wishlistOptions = (wishlistsQuery.data || []).map((w) => ({ id: w.id, name: w.title }));

  useEffect(() => {
    if (isOpen && brandId) {
      fetchBrandProfile();
      checkFollowStatus();
      fetchBrandProducts();
    }
  }, [isOpen, brandId]);

  useEffect(() => {
    const refreshAddedFlags = async () => {
      try {
        if (!isOpen) {
          setProductWishlistIds({});
          setWishlistTitlesById({});
          return;
        }
        if (!products.length) {
          setProductWishlistIds({});
          setWishlistTitlesById({});
          return;
        }

        const { data: auth } = await supabase.auth.getUser();
        const uid = auth.user?.id;
        if (!uid) {
          setProductWishlistIds({});
          setWishlistTitlesById({});
          return;
        }

        const { data: userWishlists, error: wlError } = await (supabase as any)
          .from("wishlists")
          .select("id,title")
          .eq("user_id", uid);

        if (wlError) throw wlError;

        const wishlistIds = (userWishlists || []).map((w: any) => w.id);
        const titlesById: Record<string, string> = {};
        for (const w of (userWishlists || []) as any[]) {
          if (w?.id) titlesById[String(w.id)] = String(w.title || "");
        }
        setWishlistTitlesById(titlesById);

        if (!wishlistIds.length) {
          setProductWishlistIds({});
          return;
        }

        const productIds = products.map((p) => p.id).filter(Boolean);
        if (!productIds.length) {
          setProductWishlistIds({});
          return;
        }

        const { data: items, error } = await (supabase as any)
          .from("wishlist_items")
          .select("wishlist_id, brand_product_id")
          .in("wishlist_id", wishlistIds)
          .in("brand_product_id", productIds);

        if (error) throw error;

        const map: Record<string, Set<string>> = {};
        for (const row of (items || []) as any[]) {
          if (!row?.brand_product_id || !row?.wishlist_id) continue;
          const pid = String(row.brand_product_id);
          const wid = String(row.wishlist_id);
          if (!map[pid]) map[pid] = new Set();
          map[pid].add(wid);
        }

        const normalized: Record<string, string[]> = {};
        for (const [pid, set] of Object.entries(map)) {
          normalized[pid] = Array.from(set);
        }
        setProductWishlistIds(normalized);
      } catch (e) {
        console.warn("BrandProfileModal: failed to refresh added flags", e);
      }
    };

    refreshAddedFlags();
  }, [isOpen, products]);

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

  const fetchBrandProducts = async () => {
    try {
      setProductsLoading(true);
      const { data, error } = await (supabase as any)
        .from("brand_products")
        .select("id,name,description,image_url,is_findable")
        .eq("brand_id", brandId)
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
    const loadSelectedProductLike = async () => {
      try {
        if (!selectedProductForModal?.id) {
          setSelectedProductLiked(false);
          return;
        }

        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          setSelectedProductLiked(false);
          return;
        }

        const { data, error } = await (supabase as any)
          .from("brand_product_likes")
          .select("id")
          .eq("user_id", user.id)
          .eq("product_id", selectedProductForModal.id)
          .maybeSingle();

        if (error) {
          console.warn("Failed to load product like state", error);
          setSelectedProductLiked(false);
          return;
        }

        setSelectedProductLiked(!!data);
      } catch (err) {
        console.warn("Error loading product like state", err);
        setSelectedProductLiked(false);
      }
    };

    if (selectedProductForModal) {
      loadSelectedProductLike();
    } else {
      setSelectedProductLiked(false);
    }
  }, [selectedProductForModal]);

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

  const handleToggleLikeSelectedProduct = async () => {
    if (!selectedProductForModal?.id) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.message(
          t("explore.login_required_title", "Log in to save items"),
          {
            description: t(
              "explore.login_required_desc",
              "Create an account or log in to save this product to a wishlist.",
            ),
          } as any,
        );
        return;
      }

      const productId = selectedProductForModal.id;
      const alreadyLiked = selectedProductLiked;

      if (alreadyLiked) {
        await (supabase as any)
          .from("brand_product_likes")
          .delete()
          .eq("product_id", productId)
          .eq("user_id", user.id);
      } else {
        await (supabase as any)
          .from("brand_product_likes")
          .insert({
            product_id: productId,
            user_id: user.id,
          });
      }

      setSelectedProductLiked(!alreadyLiked);
    } catch (err: any) {
      toast.error(err.message || t("common.error", "Something went wrong"));
    }
  };

  if (!isOpen) return null;

  // Prepare social and contact links
  const socialLinks = brand ? [
    { icon: Mail, url: brand.email ? `mailto:${brand.email}` : null, id: "email", original: brand.email },
    { icon: Phone, url: brand.phone ? `tel:${brand.phone}` : null, id: "phone", original: brand.phone },
    { icon: MessageCircle, url: getSocialUrl("whatsapp", brand.whatsapp), id: "whatsapp", original: brand.whatsapp },
    { icon: MapPin, url: brand.store_locations?.[0] || null, id: "location", original: brand.store_locations?.[0] },
    { icon: Instagram, url: getSocialUrl("instagram", brand.instagram), id: "instagram", original: brand.instagram },
    { icon: Twitter, url: getSocialUrl("twitter", brand.twitter), id: "twitter", original: brand.twitter },
    { icon: Facebook, url: getSocialUrl("facebook", brand.facebook), id: "facebook", original: brand.facebook },
    { icon: Linkedin, url: getSocialUrl("linkedin", brand.linkedin), id: "linkedin", original: brand.linkedin },
    { 
      icon: () => (
        <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
          <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z"/>
        </svg>
      ), 
      url: getSocialUrl("tiktok", brand.tiktok), 
      id: "tiktok",
      original: brand.tiktok
    },
    { icon: Youtube, url: getSocialUrl("youtube", brand.youtube), id: "youtube", original: brand.youtube },
    { icon: Globe, url: getSocialUrl("website", brand.brand_website), id: "website", original: brand.brand_website },
  ].filter(link => link.original) : [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="relative" onClick={(e) => e.stopPropagation()}>
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute -top-12 left-0 flex items-center gap-2 px-4 py-2 rounded-lg bg-black/80 text-white hover:bg-black transition-colors"
        >
          <X className="h-4 w-4" />
          <span className="text-sm font-medium">{t("common.back", "Back")}</span>
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
            
            {/* Verified Badge - only show if brand.is_verified is true */}
            {brand.is_verified === true && (
              <div className="verified-badge">
                <BadgeCheck />
                <span>{t("brand.verified", "Verified")}</span>
              </div>
            )}
            
            {/* Logo */}
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

            {/* Brand Products List */}
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
                      <div
                        className="flex items-center gap-2 min-w-0 flex-1 cursor-pointer"
                        onClick={() => setSelectedProductForModal(p)}
                      >
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
                      {(() => {
                        const wishlistIds = productWishlistIds[String(p.id)] || [];
                        if (wishlistIds.length === 0) return null;
                        if (wishlistIds.length === 1) {
                          const name = wishlistTitlesById[wishlistIds[0]] || "";
                          return (
                            <span className="ml-2 inline-flex items-center rounded-full bg-emerald-50/80 text-emerald-800 text-[10px] px-2 py-0.5 font-semibold ring-1 ring-emerald-200/70 whitespace-nowrap">
                              {t("explore.added_to_name", { name: name || t("wish_item.wishlist_label", "Wishlist") })}
                            </span>
                          );
                        }
                        return (
                          <span className="ml-2 inline-flex items-center rounded-full bg-emerald-50/80 text-emerald-800 text-[10px] px-2 py-0.5 font-semibold ring-1 ring-emerald-200/70 whitespace-nowrap">
                            {t("explore.added_to_count", { count: wishlistIds.length })}
                          </span>
                        );
                      })()}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        ) : null}

        {/* Product Detail Modal - Premium Card */}
        {selectedProductForModal && (
          <Dialog
            open={!!selectedProductForModal}
            onOpenChange={(open) => {
              if (!open) setSelectedProductForModal(null);
            }}
          >
            <DialogContent className="max-w-md sm:max-w-lg border-0 bg-transparent shadow-none p-0">
              <div className="flex justify-end px-2 pt-2">
                <button
                  type="button"
                  onClick={() => setSelectedProductForModal(null)}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-white/90 text-slate-700 shadow-md border border-slate-200 hover:bg-white"
                  aria-label={t("common.close", "Close")}
                >
                  <span className="text-lg leading-none">×</span>
                </button>
              </div>
              <div className="flex justify-center pb-2 px-1">
                <div className="explore-product-card w-full">
                  <div className="explore-product-card__shine" aria-hidden="true" />
                  <div className="explore-product-card__glow" aria-hidden="true" />
                  <div className="explore-product-card__content">
                    <div className="explore-product-card__image">
                      {selectedProductForModal.image_url ? (
                        <img
                          src={selectedProductForModal.image_url}
                          alt={selectedProductForModal.name || t("explore.untitled_product", "Untitled product")}
                          onError={(e: any) => {
                            e.currentTarget.style.display = "none";
                          }}
                        />
                      ) : null}
                    </div>

                    <div className="explore-product-card__text">
                      <p className="explore-product-card__title truncate">
                        {selectedProductForModal.name || t("explore.untitled_product", "Untitled product")}
                      </p>
                      <p className="explore-product-card__description line-clamp-2">
                        {selectedProductForModal.description || t("explore.no_description", "No description provided")}
                      </p>
                    </div>

                    <div className="explore-product-card__footer">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="explore-product-card__brand truncate">
                          {brand?.brand_name || t("explore.unknown_brand", "Brand / Store")}
                        </div>
                      </div>
                      <div className="explore-product-card__actions">
                        <button
                          type="button"
                          className="explore-product-card__button-text flex items-center gap-1"
                          onClick={() => {
                            setSelectedProductForModal(null);
                          }}
                        >
                          <Store className="h-3.5 w-3.5" />
                          <span>{t("explore.view_brand", "View store")}</span>
                        </button>
                        <button
                          type="button"
                          className={`explore-product-card__button-icon ${
                            selectedProductLiked ? "is-liked" : ""
                          }`}
                          onClick={handleToggleLikeSelectedProduct}
                          aria-pressed={selectedProductLiked ? "true" : "false"}
                          aria-label={
                            selectedProductLiked
                              ? t("explore.unlike_product", "Unlike product")
                              : t("explore.like_product", "Like product")
                          }
                        >
                          <Heart
                            className={`h-4 w-4 ${selectedProductLiked ? "fill-current" : ""}`}
                          />
                        </button>
                        <button
                          type="button"
                          className={`explore-product-card__button-icon ${
                            selectedProductForModal.allow_add_as_item === false ? "disabled" : ""
                          }`}
                          onClick={() => {
                            if (selectedProductForModal.allow_add_as_item !== false) {
                              setProductForWishAdd(selectedProductForModal);
                              setSelectedProductForModal(null);
                            }
                          }}
                          disabled={selectedProductForModal.allow_add_as_item === false}
                          aria-label={t("explore.add_as_item", "Add as item")}
                        >
                          <Plus className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        )}

        {/* Wish Add Dialog */}
        {productForWishAdd && wishlistOptions.length > 0 && (
          <WishAddDialog
            open={!!productForWishAdd}
            onOpenChange={(open) => {
              if (!open) setProductForWishAdd(null);
            }}
            wishlists={wishlistOptions}
            disabledWishlistIds={productWishlistIds[String(productForWishAdd?.id)] || []}
            initialTitle={productForWishAdd.name || ""}
            initialBrand={brand?.brand_name || ""}
            initialDescription={productForWishAdd.description || ""}
            initialImageUrl={productForWishAdd.image_url || null}
            onSubmit={async ({ wishlistId, title, brand: brandName, description, desire, imagePreviewUrl }) => {
              let shouldClose = false;
              try {
                const effectiveTitle = title || productForWishAdd.name || "";
                const effectiveBrand = brandName || brand?.brand_name || "";
                const { data: { user } } = await supabase.auth.getUser();
                if (!user) {
                  toast.error(t("common.login_required", "Please login to add items"));
                  return false;
                }
                const { error } = await supabase.from("wishlist_items").insert({
                  wishlist_id: wishlistId,
                  title: effectiveTitle,
                  brand: effectiveBrand,
                  description: description || "",
                  desire: desire,
                  image_url: imagePreviewUrl || productForWishAdd.image_url || null,
                  brand_product_id: productForWishAdd.id || null, // Link to brand product for analytics
                });
                if (error) {
                  if ((error as any).code === "23505") {
                    const wlName = wishlistOptions.find((w) => String(w.id) === String(wishlistId))?.name;
                    toast.info(
                      wlName
                        ? `${t("explore.already_in", "Already in")} ${wlName}`
                        : t("explore.already_in_wishlist", "Already in this wishlist"),
                    );
                    shouldClose = true;
                    return true;
                  }
                  throw error;
                }
                toast.success(t("explore.item_added", "Item added to wishlist"));
                setProductWishlistIds((prev) => {
                  const pid = String(productForWishAdd?.id || "");
                  if (!pid) return prev;
                  const next = { ...prev };
                  const existing = new Set(next[pid] || []);
                  existing.add(String(wishlistId));
                  next[pid] = Array.from(existing);
                  return next;
                });
                shouldClose = true;
                return true;
              } catch (err: any) {
                toast.error(err.message || t("common.error", "Something went wrong"));
                return false;
              } finally {
                if (shouldClose) setProductForWishAdd(null);
              }
            }}
          />
        )}
      </div>
    </div>
  );
};
