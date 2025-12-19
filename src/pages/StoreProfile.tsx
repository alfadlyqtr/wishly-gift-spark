import { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  Store,
  Instagram,
  Twitter,
  Facebook,
  Linkedin,
  Globe,
  UserPlus,
  UserCheck,
  Mail,
  Phone,
  MapPin,
  Youtube,
  MessageCircle,
  Plus,
  BadgeCheck,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import BackButton from "@/components/BackButton";
import WishAddDialog from "@/components/wishes/WishAddDialog";
import { useWishlists } from "@/hooks/use-wishlists";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";

// Custom TikTok Icon since it's not in Lucide v1
const TikTokIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor" stroke="none">
    <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z" />
  </svg>
);

const getSocialUrl = (platform: string, value: string | undefined): string => {
  if (!value) return "";
  const url = value.trim();

  if (url.startsWith("http://") || url.startsWith("https://")) {
    return url;
  }

  if (url.includes(".") && !url.startsWith("@")) {
    return `https://${url}`;
  }

  const cleanValue = url.replace(/^@/, "");

  const baseUrls: Record<string, string> = {
    instagram: "https://instagram.com/",
    twitter: "https://twitter.com/",
    facebook: "https://facebook.com/",
    linkedin: "https://linkedin.com/company/",
    tiktok: "https://tiktok.com/@",
    youtube: "https://youtube.com/@",
    whatsapp: "https://wa.me/",
    website: "https://",
  };

  const baseUrl = baseUrls[platform];
  if (baseUrl) {
    if (platform === "whatsapp") {
      const number = cleanValue.replace(/[^0-9]/g, "");
      return `${baseUrl}${number}`;
    }
    if (platform === "website") return `https://${cleanValue}`;
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

const StoreProfile = () => {
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
  const [productWishlistIds, setProductWishlistIds] = useState<Record<string, string[]>>({});
  const [wishlistTitlesById, setWishlistTitlesById] = useState<Record<string, string>>({});

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

  const refreshAddedFlags = async (nextProducts?: any[]) => {
    try {
      const list = nextProducts ?? products;
      if (!list || list.length === 0) {
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
      if (wishlistIds.length === 0) {
        setProductWishlistIds({});
        setWishlistTitlesById({});
        return;
      }

      const titlesById: Record<string, string> = {};
      for (const w of (userWishlists || []) as any[]) {
        if (w?.id) titlesById[String(w.id)] = String(w.title || "");
      }
      setWishlistTitlesById(titlesById);

      const { data: allItems, error } = await (supabase as any)
        .from("wishlist_items")
        .select("wishlist_id, brand_product_id, title")
        .in("wishlist_id", wishlistIds);

      if (error) throw error;

      const map: Record<string, Set<string>> = {};
      const productTitles = new Map<string, string>();
      for (const p of list) {
        if (p?.name) productTitles.set(p.name.toLowerCase().trim(), p.id);
      }

      const push = (productId: string, wishlistId: string) => {
        const pid = String(productId);
        const wid = String(wishlistId);
        if (!map[pid]) map[pid] = new Set();
        map[pid].add(wid);
      };

      for (const row of (allItems || []) as any[]) {
        if (!row?.wishlist_id) continue;

        if (row?.brand_product_id) {
          const matchedProduct = list.find((p: any) => p.id === row.brand_product_id);
          if (matchedProduct) push(String(row.brand_product_id), String(row.wishlist_id));
        }
        if (row?.title) {
          const titleKey = row.title.toLowerCase().trim();
          const matchedProductId = productTitles.get(titleKey);
          if (matchedProductId) push(String(matchedProductId), String(row.wishlist_id));
        }
      }

      const normalized: Record<string, string[]> = {};
      for (const [pid, set] of Object.entries(map)) {
        normalized[pid] = Array.from(set);
      }
      setProductWishlistIds(normalized);
    } catch (e) {
      console.warn("StoreProfile: failed to refresh added flags", e);
    }
  };

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
        const { error } = await (supabase as any)
          .from("brand_followers")
          .delete()
          .eq("brand_id", id)
          .eq("follower_id", user.id);

        if (error) throw error;
        setIsFollowing(false);
        toast.success(t("brand.unfollowed", "Unfollowed brand"));
      } else {
        const { error } = await (supabase as any)
          .from("brand_followers")
          .insert({
            brand_id: id,
            follower_id: user.id,
            follower_type: "user",
            status: "accepted",
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

  useEffect(() => {
    fetchBrandProfile();
    checkFollowStatus();
    fetchBrandProducts();
  }, [id]);

  useEffect(() => {
    refreshAddedFlags();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [products]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
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
    <div className="container max-w-2xl mx-auto px-4 py-6 space-y-6">
      <div className="flex items-center justify-start">
        <BackButton onClick={() => navigate(-1)}>{t("common.back", "Back")}</BackButton>
      </div>

      {/* Colorful Store Header - Wishly Style */}
      <div className="relative rounded-3xl overflow-hidden bg-gradient-to-br from-[#5b42f3] via-[#af40ff] to-[#00ddeb] p-6 shadow-xl">
        {/* Animated waves background */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute w-[540px] h-[700px] opacity-60 -left-1/2 -top-[70%] bg-gradient-to-br from-[#af40ff] via-[#5b42f3] to-[#00ddeb] rounded-[40%] animate-[spin_55s_linear_infinite]" />
          <div className="absolute w-[540px] h-[700px] opacity-60 -left-1/2 top-[210px] bg-gradient-to-br from-[#af40ff] via-[#5b42f3] to-[#00ddeb] rounded-[40%] animate-[spin_50s_linear_infinite]" />
        </div>

        <div className="relative z-10 flex flex-col items-center text-center space-y-4">
          {brand.is_verified && (
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/20 backdrop-blur text-white text-xs font-medium">
              <BadgeCheck className="h-3.5 w-3.5" />
              {t("brand.verified", "Verified")}
            </div>
          )}

          <Avatar className="h-24 w-24 ring-4 ring-white/30 shadow-lg">
            <AvatarImage src={brand.logo_url || undefined} alt={brand.brand_name} />
            <AvatarFallback className="bg-white text-slate-600 text-2xl">
              <Store className="h-10 w-10" />
            </AvatarFallback>
          </Avatar>

          <div className="space-y-1">
            <h1 className="text-2xl font-bold text-white">{brand.brand_name}</h1>
            {brand.tagline && (
              <p className="text-sm text-white/80 italic">{brand.tagline}</p>
            )}
          </div>

          {brand.description && (
            <p className="text-sm text-white/70 max-w-md">{brand.description}</p>
          )}

          {/* Social Links - Pill Style */}
          {socialLinks.length > 0 && (
            <div className="flex flex-wrap justify-center gap-2 pt-2">
              {socialLinks.map((link) => {
                const Icon = link.icon;
                return (
                  <a
                    key={link.id}
                    href={link.url || "#"}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-white/20 backdrop-blur hover:bg-white/30 transition-colors text-white"
                    title={link.id}
                  >
                    <Icon className="h-5 w-5" />
                  </a>
                );
              })}
            </div>
          )}

          <Button
            variant={isFollowing ? "outline" : "default"}
            onClick={handleFollow}
            disabled={followLoading}
            className={`rounded-full px-6 ${isFollowing ? "bg-white/20 border-white/30 text-white hover:bg-white/30" : "bg-white text-slate-800 hover:bg-white/90"}`}
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
          </Button>
        </div>
      </div>

      {/* Products Section - Colorful Style */}
      <div className="rounded-3xl overflow-hidden bg-gradient-to-br from-[#5b42f3]/90 via-[#af40ff]/90 to-[#00ddeb]/90 p-4 shadow-xl">
        <div className="flex items-center justify-between mb-3 px-1">
          <span className="text-xs font-semibold uppercase tracking-wide text-white/95">
            {t("brand.products", "Products")}
          </span>
          {products.length > 0 && (
            <span className="inline-flex items-center justify-center min-w-[20px] h-5 rounded-full bg-white/20 text-[11px] text-white/90 px-2">
              {products.length}
            </span>
          )}
        </div>

        <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
          {productsLoading ? (
            <div className="flex items-center justify-center py-6 text-sm text-white/80">
              {t("brand.loading_products", "Loading products...")}
            </div>
          ) : products.length === 0 ? (
            <div className="rounded-full bg-white/10 px-4 py-2 text-sm text-white/90 text-center">
              {t("brand.no_products", "This brand has no public products yet.")}
            </div>
          ) : (
            products.map((p) => (
              <div
                key={p.id}
                className="flex items-center gap-3 rounded-full bg-white/95 px-3 py-2 border border-white/80 shadow-sm hover:bg-white transition-colors"
              >
                <Avatar className="h-10 w-10 rounded-full ring-2 ring-slate-200">
                  <AvatarImage src={p.image_url || undefined} alt={p.name || "product"} className="object-cover" />
                  <AvatarFallback className="bg-gradient-to-br from-purple-500 to-sky-400 text-white">
                    <Store className="h-4 w-4" />
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold text-slate-900 truncate">
                    {p.name || t("brand.untitled_product", "Untitled product")}
                  </div>
                  {p.description && (
                    <div className="text-xs text-slate-600 truncate">{p.description}</div>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {(() => {
                    const wishlistIds = productWishlistIds[String(p.id)] || [];
                    if (wishlistIds.length === 0) return null;
                    if (wishlistIds.length === 1) {
                      const name = wishlistTitlesById[wishlistIds[0]] || "";
                      return (
                        <span className="inline-flex items-center rounded-full bg-emerald-50/80 text-emerald-800 text-[10px] px-2 py-1 font-semibold ring-1 ring-emerald-200/70 whitespace-nowrap">
                          {t("explore.added_to_name", "Added to: {{name}}", {
                            name: name || t("wish_item.wishlist_label", "Wishlist"),
                          })}
                        </span>
                      );
                    }
                    return (
                      <span className="inline-flex items-center rounded-full bg-emerald-50/80 text-emerald-800 text-[10px] px-2 py-1 font-semibold ring-1 ring-emerald-200/70 whitespace-nowrap">
                        {t("explore.added_to_count", { count: wishlistIds.length })}
                      </span>
                    );
                  })()}

                  <button
                    type="button"
                    className={`flex-shrink-0 h-8 w-8 rounded-full flex items-center justify-center transition-all ${
                      p.allow_add_as_item === false
                        ? "bg-slate-200 text-slate-400 cursor-not-allowed"
                        : "bg-gradient-to-br from-purple-500 to-violet-600 text-white hover:shadow-md"
                    }`}
                    onClick={() => {
                      if (p.allow_add_as_item !== false) {
                        setProductForWishAdd(p);
                      }
                    }}
                    disabled={p.allow_add_as_item === false}
                    aria-label={t("explore.add_as_item", "Add as item")}
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

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
              if (error) {
                if ((error as any).code === "23505") {
                  const wlName = wishlistOptions.find((w) => String(w.id) === String(wishlistId))?.name;
                  toast.info(
                    wlName
                      ? `${t("explore.already_in", "Already in")} ${wlName}`
                      : t("explore.already_in_wishlist", "Already in this wishlist"),
                  );
                  setProductForWishAdd(null);
                  return;
                }
                throw error;
              }

              toast.success(t("explore.item_added", "Item added to wishlist"));
              refreshAddedFlags();
              setProductForWishAdd(null);
            } catch (err: any) {
              toast.error(err.message || t("common.error", "Something went wrong"));
            }
          }}
        />
      )}
    </div>
  );
};

export default StoreProfile;
