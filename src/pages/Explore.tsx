import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Store, Search, Filter, Users, Plus, Heart, MessageCircle, Send } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { requestFollow } from "@/lib/follow";
import { BrandProfileModal } from "@/components/BrandProfileModal";
import WishAddDialog from "@/components/wishes/WishAddDialog";
import { useWishlists } from "@/hooks/use-wishlists";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { ProductQuestions } from "@/components/products/ProductQuestions";
import { openOrCreateDirectThread } from "@/lib/messages";
import "./ExploreProductsCard.css";

const Explore = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"brands" | "products" | "users">("brands");
  const [q, setQ] = useState("");
  const debouncedQ = useMemo(() => q.trim(), [q]);
  const [requestedIds, setRequestedIds] = useState<string[]>([]);
  const [selectedBrandId, setSelectedBrandId] = useState<string | null>(null);
  const [isBrandModalOpen, setIsBrandModalOpen] = useState(false);
  const [productForAdd, setProductForAdd] = useState<any | null>(null);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [productsView, setProductsView] = useState<"card" | "list">("list");
  const [selectedProductForModal, setSelectedProductForModal] = useState<any | null>(null);
  const [cardGroupIndex, setCardGroupIndex] = useState<Record<string, number>>({});
  const [likedProductIds, setLikedProductIds] = useState<Set<string>>(new Set());
  const [messagingBrand, setMessagingBrand] = useState(false);

  const queryClient = useQueryClient();

  // Handler to message a brand (uses brand's user_id - the owner's account)
  const handleMessageBrand = async (brandOwnerId: string) => {
    try {
      setMessagingBrand(true);
      const { id: threadId, error } = await openOrCreateDirectThread(brandOwnerId);
      if (error) throw error;
      if (threadId) {
        setSelectedProductForModal(null);
        navigate(`/chat/${threadId}`);
      }
    } catch (err: any) {
      toast.error(err?.message || t("explore.message_brand_error", "Failed to start conversation"));
    } finally {
      setMessagingBrand(false);
    }
  };

  const { data: wishlistsData } = useWishlists();
  const wishlistOptions = useMemo(
    () => (wishlistsData ?? []).map((w) => ({ id: w.id, name: w.title || w.id })),
    [wishlistsData],
  );

  const usersQuery = useQuery({
    queryKey: ["explore", "users", debouncedQ],
    queryFn: async () => {
      const s = debouncedQ;
      if (!s) return [];
      // Search only public / searchable profiles (profile visibility toggle)
      const { data: auth } = await supabase.auth.getUser();
      const me = auth.user?.id as string | undefined;

      const { data: profiles } = await (supabase as any)
        .from("user_profiles")
        .select("id, username, full_name, avatar_url, email, require_follow_approval")
        .eq("is_searchable", true)
        .or(`username.ilike.%${s}%,full_name.ilike.%${s}%,email.ilike.%${s}%`)
        .limit(20);

      const base = (profiles ?? []) as any[];
      if (!me || base.length === 0) return base;

      // Fetch existing follow relationships for these users to hydrate button state
      const ids = base.map((p) => p.id);
      const { data: relations } = await (supabase as any)
        .from("followers")
        .select("following_id,status")
        .eq("user_id", me)
        .in("following_id", ids);

      const statusById: Record<string, string> = {};
      for (const row of (relations ?? []) as any[]) {
        statusById[String(row.following_id)] = String(row.status || "");
      }

      return base.map((p) => ({
        ...p,
        follow_status: statusById[p.id] ?? null,
      }));
    },
    enabled: mode === "users" && debouncedQ.length > 0,
  });

  const handleFollow = async (u: any) => {
    try {
      // First check if a follow relationship already exists
      const { data: auth } = await supabase.auth.getUser();
      const me = auth.user?.id;
      if (!me) {
        toast.error(t("common.error_generic", "Something went wrong. Please try again."));
        return;
      }

      const { data: existing, error: existingErr } = await (supabase as any)
        .from("followers")
        .select("status")
        .eq("user_id", me)
        .eq("following_id", u.id)
        .maybeSingle();

      if (!existingErr && existing) {
        const status = String((existing as any).status || "");
        setRequestedIds((prev) => (prev.includes(u.id) ? prev : [...prev, u.id]));
        if (status === "pending") {
          toast.success(
            t(
              "explore.follow_already_requested",
              "You already requested to follow this user.",
            ),
          );
        } else if (status === "accepted") {
          toast.success(
            t("explore.already_following", "You are already following this user."),
          );
        }
        return;
      }

      await requestFollow(u.id);
      setRequestedIds((prev) => (prev.includes(u.id) ? prev : [...prev, u.id]));
      if (u.require_follow_approval) {
        toast.success(
          t(
            "explore.follow_request_sent",
            "Follow request sent. You'll be notified when they approve.",
          ),
        );
      } else {
        toast.success(
          t("explore.follow_started", "You are now following this user."),
        );
      }
    } catch (e: any) {
      const msg = e?.message || "";
      if (msg.includes("Cannot follow yourself")) {
        toast.error(
          t("explore.cannot_follow_self", "You can't follow yourself."),
        );
      } else if (msg.toLowerCase().includes("duplicate")) {
        setRequestedIds((prev) => (prev.includes(u.id) ? prev : [...prev, u.id]));
        toast.success(
          t("explore.already_following", "You are already following this user."),
        );
      } else {
        toast.error(
          msg || t("common.error_generic", "Something went wrong. Please try again."),
        );
      }
    }
  };

  const brandsQuery = useQuery({
    queryKey: ["explore", "brands", debouncedQ],
    queryFn: async () => {
      const s = debouncedQ;
      if (!s) return [];
      const { data } = await (supabase as any)
        .from("brands")
        .select("id, brand_name, tagline, description, logo_url, is_public")
        .eq("is_public", true)
        .or(`brand_name.ilike.%${s}%,tagline.ilike.%${s}%,description.ilike.%${s}%`)
        .limit(20);
      return data ?? [];
    },
    enabled: mode === "brands" && debouncedQ.length > 0,
  });

  const productsQuery = useQuery({
    queryKey: ["explore", "products", debouncedQ],
    queryFn: async () => {
      const s = debouncedQ;
      if (!s) return [];
      const { data, error } = await (supabase as any)
        .from("brand_products")
        .select("id,name,description,image_url,product_url,is_findable,allow_add_as_item, brands!inner(id,brand_name,logo_url,user_id)")
        .eq("is_findable", true)
        .or(`name.ilike.%${s}%,description.ilike.%${s}%`)
        .limit(20);
      if (error) throw error;
      return data ?? [];
    },
    enabled: mode === "products" && debouncedQ.length > 0,
  });

  const products = (productsQuery.data as any[]) || [];

  // Stable list of product IDs for the useEffect dependency
  const productIdList = useMemo(
    () => products.map((p: any) => p.id).filter(Boolean).join(","),
    [products],
  );

  useEffect(() => {
    const loadLikedProducts = async () => {
      try {
        const ids = productIdList.split(",").filter(Boolean);
        if (!ids.length) {
          setLikedProductIds(new Set());
          return;
        }

        const { data: auth } = await supabase.auth.getUser();
        const me = auth.user?.id;
        if (!me) {
          setLikedProductIds(new Set());
          return;
        }

        const { data, error } = await (supabase as any)
          .from("brand_product_likes")
          .select("product_id")
          .eq("user_id", me)
          .in("product_id", ids);

        if (error) {
          console.warn("Failed to load liked products", error);
          return;
        }

        const next = new Set<string>();
        for (const row of (data ?? []) as any[]) {
          if (row.product_id) {
            next.add(String(row.product_id));
          }
        }
        setLikedProductIds(next);
      } catch (err) {
        console.warn("Error loading liked products", err);
      }
    };

    loadLikedProducts();
  }, [productIdList]);

  const productGroups = useMemo(() => {
    const groups: Record<string, { key: string; brand: any; items: any[] }> = {};
    for (const p of products) {
      const brandId = p.brands?.id || "unknown";
      const nameNorm = String(p.name || "").trim().toLowerCase();
      const key = `${brandId}::${nameNorm || p.id}`;
      if (!groups[key]) {
        groups[key] = {
          key,
          brand: p.brands,
          items: [],
        };
      }
      groups[key].items.push(p);
    }
    return Object.values(groups);
  }, [products]);

  const handleAddAsItemClick = async (product: any) => {
    if (product.allow_add_as_item === false) return;

    try {
      const { data: auth } = await supabase.auth.getUser();
      const me = auth.user?.id;
      if (!me) {
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

      // Record a view for this brand product when the user opens the add-dialog
      try {
        await (supabase as any)
          .from("brand_product_views")
          .insert({
            product_id: product.id,
            viewer_id: me,
            source: "explore_add", // track that this came from Explore > Add flow
          });
      } catch (viewErr) {
        console.warn("Failed to record product view", viewErr);
      }

      setProductForAdd(product);
      setIsAddDialogOpen(true);
    } catch (e: any) {
      toast.error(
        e?.message ||
          t("common.error_generic", "Something went wrong. Please try again."),
      );
    }
  };

  const handleToggleLike = async (product: any) => {
    try {
      const { data: auth } = await supabase.auth.getUser();
      const me = auth.user?.id;

      if (!me) {
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

      const productId = product.id;
      const alreadyLiked = likedProductIds.has(productId);

      if (alreadyLiked) {
        await (supabase as any)
          .from("brand_product_likes")
          .delete()
          .eq("product_id", productId)
          .eq("user_id", me);
      } else {
        await (supabase as any)
          .from("brand_product_likes")
          .insert({
            product_id: productId,
            user_id: me,
          });
      }

      setLikedProductIds((prev) => {
        const next = new Set(prev);
        if (alreadyLiked) {
          next.delete(productId);
        } else {
          next.add(productId);
        }
        return next;
      });

      try {
        queryClient.invalidateQueries();
      } catch (err) {
        console.warn("Failed to invalidate queries after like toggle", err);
      }
    } catch (e: any) {
      toast.error(
        e?.message ||
          t("common.error_generic", "Something went wrong. Please try again."),
      );
    }
  };

  return (
    <div className="container max-w-2xl mx-auto px-4 py-6 space-y-6">
      {/* Header like Events */}
      <div className="mt-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="relative inline-flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[hsl(var(--brand-cool-start))] via-[hsl(var(--brand-cool-end))] to-[hsl(var(--brand-warm-end))] shadow-[0_12px_30px_rgba(200,80,192,0.45)] ring-1 ring-white/40">
              <Store className="h-5 w-5 text-white drop-shadow" />
              <span className="absolute -inset-1 rounded-[14px] blur-md bg-gradient-to-br from-[#ffcc70]/20 to-[#c850c0]/10" aria-hidden="true" />
            </div>
            <h2 
              className="text-2xl font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-[hsl(var(--brand-cool-start))] via-[hsl(var(--brand-cool-end))] to-[hsl(var(--brand-warm-end))] drop-shadow-[0_1px_1px_rgba(0,0,0,0.6)]"
              style={{ WebkitTextStroke: '0.5px rgba(0,0,0,0.85)' }}
            >
              {t('explore.title', 'Explore')}
            </h2>
          </div>
          <p className="hidden sm:block text-muted-foreground max-w-xs text-right leading-snug">
            {t('explore.subtitle', 'Discover trending gifts, popular wishlists, and amazing products curated just for you.')}
          </p>
        </div>
        <p className="sm:hidden mt-2 text-muted-foreground">
          {t('explore.subtitle', 'Discover trending gifts, popular wishlists, and amazing products curated just for you.')}
        </p>
      </div>

      {/* Search bar */}
      <div className="mx-auto w-full max-w-md">
        <div className="rounded-[14px] p-[2px] bg-gradient-to-r from-[hsl(var(--brand-cool-start))] via-[hsl(var(--brand-cool-end))] to-[hsl(var(--brand-warm-end))] shadow-[0_12px_28px_rgba(200,80,192,0.18)]">
          <div className="relative rounded-[12px] bg-white shadow-sm">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 inline-flex h-8 w-8 items-center justify-center rounded-full bg-white text-[hsl(var(--brand-cool-start))] shadow-[0_3px_8px_rgba(65,88,208,0.18)]">
              <Search className="h-4.5 w-4.5" />
            </span>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={mode === "brands" ? t('explore.search_placeholder_brands', 'Search brands, stores, products') : t('explore.search_placeholder_users', 'Search users')}
              aria-label={t('explore.search_aria', 'Search')}
              className="h-12 w-full rounded-[12px] border-0 pl-12 pr-12 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
            />
            <button
              type="button"
              className="absolute right-2 top-1/2 -translate-y-1/2 inline-flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-[hsl(var(--brand-cool-start))] via-[hsl(var(--brand-cool-end))] to-[hsl(var(--brand-warm-end))] text-white shadow-[0_8px_18px_rgba(200,80,192,0.28)]"
              aria-label={t('explore.filters_aria', 'Filters')}
            >
              <Filter className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Toggle - clean segmented control */}
      <div className="mx-auto w-full max-w-md">
        <div className="relative mx-auto mt-2 rounded-full p-[2px] bg-gradient-to-r from-[hsl(var(--brand-cool-start))] via-[hsl(var(--brand-cool-end))] to-[hsl(var(--brand-warm-end))] shadow-[0_12px_28px_rgba(0,0,0,0.10)]">
          <div className="relative flex items-center rounded-full bg-white/70 backdrop-blur px-1 py-1 ring-1 ring-white/70 shadow-[inset_0_1px_3px_rgba(255,255,255,0.55),_0_6px_14px_rgba(0,0,0,0.06)] overflow-hidden">
            <span className="pointer-events-none absolute inset-x-6 -top-1 h-5 rounded-full bg-white/60 blur-md opacity-60" />
            {/* Sliding glass highlight */}
            <span
              className="pointer-events-none absolute top-1 bottom-1 rounded-full p-[1px] bg-gradient-to-r from-[hsl(var(--brand-cool-start))]/40 via-[hsl(var(--brand-cool-end))]/35 to-[hsl(var(--brand-warm-end))]/40 shadow-[0_6px_16px_rgba(200,80,192,0.14)] transition-all duration-300 ease-out z-0"
              style={{
                width: '33.3333%',
                left:
                  mode === 'brands'
                    ? '0%'
                    : mode === 'products'
                    ? '33.3333%'
                    : '66.6666%',
              }}
            >
              <span className="absolute inset-0 rounded-full ring-1 ring-white/60" />
              <span className="relative block h-full w-full rounded-full bg-white/20 backdrop-blur-[2px] shadow-[inset_0_1px_3px_rgba(255,255,255,0.6),_0_4px_10px_rgba(0,0,0,0.06)]" />
            </span>
          <button
            type="button"
            onClick={() => setMode('brands')}
            className={`relative z-10 flex-1 rounded-full px-3 py-2 text-[11px] font-semibold transition-colors duration-200 flex items-center justify-center gap-1 ${
              mode === 'brands' ? 'text-foreground' : 'text-muted-foreground'
            }`}
            aria-pressed={mode === 'brands'}
          >
            <Store className="h-4 w-4" />
            <span>{t('explore.segment_brands', 'Brands/Stores')}</span>
          </button>
          <button
            type="button"
            onClick={() => setMode('products')}
            className={`relative z-10 flex-1 rounded-full px-3 py-2 text-[11px] font-semibold transition-colors duration-200 flex items-center justify-center gap-1 ${
              mode === 'products' ? 'text-foreground' : 'text-muted-foreground'
            }`}
            aria-pressed={mode === 'products'}
          >
            <Store className="h-4 w-4" />
            <span>{t('explore.segment_products', 'Products')}</span>
          </button>
          <button
            type="button"
            onClick={() => setMode('users')}
            className={`relative z-10 flex-1 rounded-full px-3 py-2 text-[11px] font-semibold transition-colors duration-200 flex items-center justify-center gap-1 ${
              mode === 'users' ? 'text-foreground' : 'text-muted-foreground'
            }`}
            aria-pressed={mode === 'users'}
          >
            <Users className="h-4 w-4" />
            <span>{t('explore.segment_users', 'Users')}</span>
          </button>
          </div>
        </div>
      </div>

      {/* Results body */}
      <div className="mx-auto w-full max-w-md space-y-3">
        {mode === "brands" ? (
          debouncedQ.length === 0 ? (
            <div className="rounded-2xl bg-white/70 backdrop-blur ring-1 ring-white/70 shadow-[0_18px_40px_rgba(0,0,0,0.06)] p-4 text-sm text-muted-foreground">{t('explore.empty_brands', 'Search brands, stores, or products.')}</div>
          ) : brandsQuery.isLoading ? (
            <div className="flex items-center justify-center py-10"><div className="loader"><span className="text">{t('explore.loading', 'Loading')}</span></div></div>
          ) : (brandsQuery.data?.length ?? 0) === 0 ? (
            <div className="rounded-2xl bg-white/70 backdrop-blur ring-1 ring-white/70 shadow-[0_18px_40px_rgba(0,0,0,0.06)] p-4 text-sm text-muted-foreground">{t('explore.no_results', 'No results.')}</div>
          ) : (
            <div className="space-y-3">
              {brandsQuery.data!.map((brand: any) => (
                <div key={brand.id} className="flex items-center justify-between gap-3 rounded-2xl bg-white/80 backdrop-blur ring-1 ring-white/70 shadow-[0_18px_40px_rgba(0,0,0,0.06)] p-4">
                  <div className="flex items-center gap-3 min-w-0">
                    {brand.logo_url ? (
                      <span className="relative flex shrink-0 overflow-hidden rounded-full h-9 w-9 ring-2 ring-white/80">
                        <img
                          src={brand.logo_url}
                          alt={brand.brand_name || "brand logo"}
                          className="h-full w-full object-cover"
                          onError={(e: any) => {
                            e.currentTarget.style.display = "none";
                          }}
                        />
                      </span>
                    ) : (
                      <div className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-[hsl(var(--brand-cool-start))] via-[hsl(var(--brand-cool-end))] to-[hsl(var(--brand-warm-end))] text-white ring-1 ring-white/60 shadow-[0_6px_14px_rgba(200,80,192,0.28)]">
                        <Store className="h-4 w-4" />
                      </div>
                    )}
                    <div className="min-w-0">
                      <div className="font-medium truncate">{brand.brand_name || "Untitled"}</div>
                      {brand.tagline && <div className="text-sm text-muted-foreground truncate">{brand.tagline}</div>}
                    </div>
                  </div>
                  <button
                    type="button"
                    className="explore-follow-btn shrink-0"
                    onClick={() => {
                      setSelectedBrandId(brand.id);
                      setIsBrandModalOpen(true);
                    }}
                  >
                    <span className="explore-follow-btn-fold" aria-hidden="true" />
                    <span className="explore-follow-btn-points" aria-hidden="true">
                      {Array.from({ length: 10 }).map((_, i) => (
                        <span key={i} className="explore-follow-btn-point" />
                      ))}
                    </span>
                    <span className="explore-follow-btn-inner">
                      {t("explore.view", "View")}
                    </span>
                  </button>
                </div>
              ))}
            </div>
          )
        ) : mode === "products" ? (
          debouncedQ.length === 0 ? (
            <div className="rounded-2xl bg-white/70 backdrop-blur ring-1 ring-white/70 shadow-[0_18px_40px_rgba(0,0,0,0.06)] p-4 text-sm text-muted-foreground">
              {t('explore.empty_products', 'Search products by name or description.')}
            </div>
          ) : productsQuery.isLoading ? (
            <div className="flex items-center justify-center py-10">
              <div className="loader"><span className="text">{t('explore.loading', 'Loading')}</span></div>
            </div>
          ) : (productsQuery.data?.length ?? 0) === 0 ? (
            <div className="rounded-2xl bg-white/70 backdrop-blur ring-1 ring-white/70 shadow-[0_18px_40px_rgba(0,0,0,0.06)] p-4 text-sm text-muted-foreground">
              {t('explore.no_products', 'No products found.')}
            </div>
          ) : (
            <div className="space-y-2">
              <div className="flex items-center justify-end gap-2 pb-1 text-[11px] text-muted-foreground">
                <span className="rounded-full bg-white/70 px-1 py-0.5 border border-white/60 shadow-sm flex items-center gap-1">
                  <button
                    type="button"
                    className={`px-2 py-0.5 rounded-full font-semibold ${productsView === 'card' ? 'bg-gradient-to-r from-[hsl(var(--brand-cool-start))] to-[hsl(var(--brand-warm-end))] text-white shadow-sm' : 'text-muted-foreground'}`}
                    onClick={() => setProductsView('card')}
                  >
                    {t('explore.products_view_card', 'Card')}
                  </button>
                  <button
                    type="button"
                    className={`px-2 py-0.5 rounded-full font-semibold ${productsView === 'list' ? 'bg-gradient-to-r from-[hsl(var(--brand-cool-start))] to-[hsl(var(--brand-warm-end))] text-white shadow-sm' : 'text-muted-foreground'}`}
                    onClick={() => setProductsView('list')}
                  >
                    {t('explore.products_view_list', 'List')}
                  </button>
                </span>
              </div>

              {productsView === 'card' ? (
                <div className="space-y-3">
                  {productGroups.map((group) => {
                    const currentIndex = cardGroupIndex[group.key] ?? 0;
                    const clampedIndex = Math.min(Math.max(currentIndex, 0), group.items.length - 1);
                    const p = group.items[clampedIndex] || group.items[0];
                    const total = group.items.length;
                    const currentDisplay = (clampedIndex % total) + 1;
                    const isLiked = likedProductIds.has(p.id);
                    return (
                      <div key={group.key} className="flex justify-center">
                      <div className="explore-product-card w-full">
                        <div className="explore-product-card__shine" aria-hidden="true" />
                        <div className="explore-product-card__glow" aria-hidden="true" />
                        <div className="explore-product-card__content">
                          <div className="explore-product-card__image">
                            {p.image_url ? (
                              <img
                                src={p.image_url}
                                alt={p.name || t('explore.untitled_product', 'Untitled product')}
                                onError={(e: any) => {
                                  e.currentTarget.style.display = 'none';
                                }}
                              />
                            ) : null}
                          </div>

                          <div className="explore-product-card__text">
                            <p className="explore-product-card__title truncate">
                              {p.name || t('explore.untitled_product', 'Untitled product')}
                            </p>
                            <p className="explore-product-card__description line-clamp-2">
                              {p.description || t('explore.no_description', 'No description provided')}
                            </p>
                          </div>

                          <div className="explore-product-card__footer">
                            <div className="flex items-center gap-2 min-w-0">
                              {p.brands?.logo_url && (
                                <span className="explore-product-card__brand-avatar">
                                  <img
                                    src={p.brands.logo_url}
                                    alt={p.brands.brand_name || t('explore.unknown_brand', 'Brand / Store')}
                                    onError={(e: any) => {
                                      e.currentTarget.style.display = 'none';
                                    }}
                                  />
                                </span>
                              )}
                              <div className="explore-product-card__brand truncate">
                                {p.brands?.brand_name || t('explore.unknown_brand', 'Brand / Store')}
                              </div>
                              {total > 1 && (
                                <button
                                  type="button"
                                  className="text-[10px] px-2 py-0.5 rounded-full bg-white/80 border border-slate-200 text-slate-600 hover:bg-white"
                                  onClick={() =>
                                    setCardGroupIndex((prev) => ({
                                      ...prev,
                                      [group.key]: (clampedIndex + 1) % total,
                                    }))
                                  }
                                >
                                  {currentDisplay} / {total}
                                </button>
                              )}
                            </div>
                            <div className="explore-product-card__actions">
                              <button
                                type="button"
                                className="explore-product-card__button-text flex items-center gap-1"
                                onClick={() => {
                                  if (!p.brands?.id) return;
                                  setSelectedBrandId(p.brands.id);
                                  setIsBrandModalOpen(true);
                                }}
                              >
                                <Store className="h-3.5 w-3.5" />
                                <span>{t('explore.view_brand', 'View store')}</span>
                              </button>
                              <button
                                type="button"
                                className={`explore-product-card__button-icon ${
                                  isLiked ? 'is-liked' : ''
                                }`}
                                onClick={() => handleToggleLike(p)}
                                aria-pressed={isLiked}
                                aria-label={
                                  isLiked
                                    ? t('explore.unlike_product', 'Unlike product')
                                    : t('explore.like_product', 'Like product')
                                }
                              >
                                <Heart
                                  className={`h-4 w-4 ${isLiked ? 'fill-current' : ''}`}
                                />
                              </button>
                              <button
                                type="button"
                                className={`explore-product-card__button-icon ${
                                  p.allow_add_as_item === false ? 'disabled' : ''
                                }`}
                                onClick={() => handleAddAsItemClick(p)}
                                disabled={p.allow_add_as_item === false}
                                aria-label={t('explore.add_as_item', 'Add as item')}
                              >
                                <Plus className="h-4 w-4" />
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="space-y-1.5">
                  {productsQuery.data!.map((p: any, idx: number) => (
                    <div
                      key={p.id}
                      className="explore-product-row"
                      style={{ animationDelay: `${idx * 40}ms` }}
                      onClick={async () => {
                        try {
                          const { data: auth } = await supabase.auth.getUser();
                          const me = auth.user?.id;
                          if (me) {
                            await (supabase as any)
                              .from("brand_product_views")
                              .insert({
                                product_id: p.id,
                                viewer_id: me,
                                source: "explore_card_open",
                              });
                          }
                        } catch (viewErr) {
                          console.warn("Failed to record product view (card open)", viewErr);
                        }
                        setSelectedProductForModal(p);
                      }}
                    >
                      <div className="explore-product-row__image">
                        {p.image_url ? (
                          <img
                            src={p.image_url}
                            alt={p.name || t('explore.untitled_product', 'Untitled product')}
                            onError={(e: any) => {
                              e.currentTarget.style.display = 'none';
                            }}
                          />
                        ) : null}
                      </div>
                      <div className="explore-product-row__text">
                        <div className="explore-product-row__title">
                          {p.name || t('explore.untitled_product', 'Untitled product')}
                        </div>
                        <div className="explore-product-row__meta">
                          {p.brands?.logo_url && (
                            <span className="explore-product-row__brand-avatar">
                              <img
                                src={p.brands.logo_url}
                                alt={p.brands.brand_name || t('explore.unknown_brand', 'Brand / Store')}
                                onError={(e: any) => {
                                  e.currentTarget.style.display = 'none';
                                }}
                              />
                            </span>
                          )}
                          <span className="explore-product-row__brand">
                            {p.brands?.brand_name || t('explore.unknown_brand', 'Brand / Store')}
                          </span>
                          {p.description && (
                            <span className="explore-product-row__subtitle">
                              {p.description}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="explore-product-row__actions" onClick={(e) => e.stopPropagation()}>
                        {(() => {
                          const isLiked = likedProductIds.has(p.id);
                          return (
                            <button
                              type="button"
                              className={`explore-product-row__icon-btn ${
                                isLiked ? 'is-liked' : ''
                              }`}
                              onClick={() => handleToggleLike(p)}
                              aria-pressed={isLiked}
                              aria-label={
                                isLiked
                                  ? t('explore.unlike_product', 'Unlike product')
                                  : t('explore.like_product', 'Like product')
                              }
                            >
                              <Heart
                                className={`h-3.5 w-3.5 ${
                                  isLiked ? 'fill-current' : ''
                                }`}
                              />
                            </button>
                          );
                        })()}
                        <button
                          type="button"
                          className="explore-product-row__icon-btn"
                          onClick={async () => {
                            if (!p.brands?.id) return;
                            try {
                              const { data: auth } = await supabase.auth.getUser();
                              const me = auth.user?.id;
                              if (me) {
                                await (supabase as any)
                                  .from("brand_product_views")
                                  .insert({
                                    product_id: p.id,
                                    viewer_id: me,
                                    source: "explore_view_store_row",
                                  });
                              }
                            } catch (viewErr) {
                              console.warn("Failed to record product view (view store row)", viewErr);
                            }
                            setSelectedBrandId(p.brands.id);
                            setIsBrandModalOpen(true);
                          }}
                          aria-label={t('explore.view_brand', 'View store')}
                        >
                          <Store className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          className={`explore-product-row__icon-btn ${
                            p.allow_add_as_item === false ? 'is-disabled' : ''
                          }`}
                          onClick={() => p.allow_add_as_item === false ? undefined : handleAddAsItemClick(p)}
                          disabled={p.allow_add_as_item === false}
                          aria-label={t('explore.add_as_item', 'Add as item')}
                        >
                          <Plus className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        ) : (
          debouncedQ.length === 0 ? (
            <div className="rounded-2xl bg-white/70 backdrop-blur ring-1 ring-white/70 shadow-[0_18px_40px_rgba(0,0,0,0.06)] p-4 text-sm text-muted-foreground">{t('explore.empty_users', 'Type a name, username, or email to search users.')}</div>
          ) : usersQuery.isLoading ? (
            <div className="flex items-center justify-center py-10"><div className="loader"><span className="text">{t('explore.loading', 'Loading')}</span></div></div>
          ) : (usersQuery.data?.length ?? 0) === 0 ? (
            <div className="rounded-2xl bg-white/70 backdrop-blur ring-1 ring-white/70 shadow-[0_18px_40px_rgba(0,0,0,0.06)] p-4 text-sm text-muted-foreground">{t('explore.no_results', 'No results.')}</div>
          ) : (
            <div className="space-y-3">
              {usersQuery.data!.map((u: any) => {
                const requestedLocal = requestedIds.includes(u.id);
                const statusFromDb = String((u.follow_status || "")).toLowerCase();
                let effectiveStatus: string | null = null;

                if (statusFromDb === "pending" || statusFromDb === "accepted") {
                  effectiveStatus = statusFromDb;
                } else if (requestedLocal) {
                  effectiveStatus = u.require_follow_approval ? "pending" : "accepted";
                }

                const label = !effectiveStatus
                  ? t("explore.follow", "Follow")
                  : effectiveStatus === "pending"
                  ? t("explore.follow_requested", "Requested")
                  : t("explore.following", "Following");
                return (
                  <div
                    key={u.id}
                    className="flex items-center justify-between gap-3 rounded-2xl bg-white/80 backdrop-blur ring-1 ring-white/70 shadow-[0_18px_40px_rgba(0,0,0,0.06)] p-4"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      {u.avatar_url ? (
                        <span className="relative flex shrink-0 overflow-hidden rounded-full h-9 w-9 ring-2 ring-white/80">
                          <img
                            src={u.avatar_url}
                            alt={u.full_name || u.username || "avatar"}
                            className="h-full w-full object-cover"
                            onError={(e: any) => {
                              e.currentTarget.style.display = "none";
                            }}
                          />
                        </span>
                      ) : (
                        <div className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-[hsl(var(--brand-cool-start))] via-[hsl(var(--brand-cool-end))] to-[hsl(var(--brand-warm-end))] text-white ring-1 ring-white/60 shadow-[0_6px_14px_rgba(200,80,192,0.28)]">
                          <Users className="h-4 w-4" />
                        </div>
                      )}
                      <div className="min-w-0">
                        <div className="font-medium truncate">{u.full_name || u.username || "User"}</div>
                        {u.username && (
                          <div className="text-sm text-muted-foreground">@{u.username}</div>
                        )}
                      </div>
                    </div>
                    <button
                      type="button"
                      className="explore-follow-btn shrink-0 disabled:opacity-70 disabled:cursor-default"
                      onClick={() => handleFollow(u)}
                      disabled={!!effectiveStatus}
                    >
                      <span className="explore-follow-btn-fold" aria-hidden="true" />
                      <span className="explore-follow-btn-points" aria-hidden="true">
                        {Array.from({ length: 10 }).map((_, i) => (
                          <span key={i} className="explore-follow-btn-point" />
                        ))}
                      </span>
                      <span className="explore-follow-btn-inner">
                        {label === t("explore.follow", "Follow") ? t("explore.follow_me", "Follow me") : label}
                      </span>
                    </button>
                  </div>
                );
              })}
            </div>
          )
        )}
      </div>

      {/* Brand Profile Modal */}
      {selectedBrandId && (
        <BrandProfileModal
          brandId={selectedBrandId}
          isOpen={isBrandModalOpen}
          onClose={() => {
            setIsBrandModalOpen(false);
            setSelectedBrandId(null);
          }}
        />
      )}

      {/* Product detail modal for list view - reuses premium card */}
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
                aria-label={t('common.close', 'Close')}
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
                        alt={selectedProductForModal.name || t('explore.untitled_product', 'Untitled product')}
                        onError={(e: any) => {
                          e.currentTarget.style.display = 'none';
                        }}
                      />
                    ) : null}
                  </div>

                  <div className="explore-product-card__text">
                    <p className="explore-product-card__title truncate">
                      {selectedProductForModal.name || t('explore.untitled_product', 'Untitled product')}
                    </p>
                    <p className="explore-product-card__description line-clamp-3">
                      {selectedProductForModal.description || t('explore.no_description', 'No description provided')}
                    </p>
                  </div>

                  {/* Questions section - Instagram style */}
                  <ProductQuestions
                    productId={selectedProductForModal.id}
                    brandUserId={selectedProductForModal.brands?.user_id}
                    brandName={selectedProductForModal.brands?.brand_name || "Brand"}
                    brandLogo={selectedProductForModal.brands?.logo_url}
                  />

                  <div className="explore-product-card__footer">
                    <div className="flex items-center gap-2 min-w-0">
                      {selectedProductForModal.brands?.logo_url && (
                        <span className="explore-product-card__brand-avatar">
                          <img
                            src={selectedProductForModal.brands.logo_url}
                            alt={
                              selectedProductForModal.brands.brand_name ||
                              t('explore.unknown_brand', 'Brand / Store')
                            }
                            onError={(e: any) => {
                              e.currentTarget.style.display = 'none';
                            }}
                          />
                        </span>
                      )}
                      <div className="explore-product-card__brand truncate">
                        {selectedProductForModal.brands?.brand_name ||
                          t('explore.unknown_brand', 'Brand / Store')}
                      </div>
                    </div>
                    <div className="explore-product-card__actions">
                      <button
                        type="button"
                        className="explore-product-card__button-icon"
                        onClick={async () => {
                          if (!selectedProductForModal.brands?.id) return;
                          try {
                            const { data: auth } = await supabase.auth.getUser();
                            const me = auth.user?.id;
                            if (me && selectedProductForModal?.id) {
                              await (supabase as any)
                                .from("brand_product_views")
                                .insert({
                                  product_id: selectedProductForModal.id,
                                  viewer_id: me,
                                  source: "explore_view_store_modal",
                                });
                            }
                          } catch (viewErr) {
                            console.warn("Failed to record product view (view store modal)", viewErr);
                          }
                          setSelectedBrandId(selectedProductForModal.brands.id);
                          setIsBrandModalOpen(true);
                        }}
                        aria-label={t('explore.view_brand', 'View store')}
                      >
                        <Store className="h-3.5 w-3.5" />
                      </button>
                      {selectedProductForModal.brands?.user_id && (
                        <button
                          type="button"
                          className="explore-product-card__button-icon"
                          onClick={() => handleMessageBrand(selectedProductForModal.brands.user_id)}
                          disabled={messagingBrand}
                          aria-label={t('explore.message_brand', 'Message')}
                        >
                          <Send className="h-3.5 w-3.5" />
                        </button>
                      )}
                      {(() => {
                        const isLiked = selectedProductForModal?.id
                          ? likedProductIds.has(selectedProductForModal.id)
                          : false;
                        return (
                          <button
                            type="button"
                            className={`explore-product-card__button-icon ${
                              isLiked ? 'is-liked' : ''
                            }`}
                            onClick={() => handleToggleLike(selectedProductForModal)}
                            aria-pressed={isLiked}
                            aria-label={
                              isLiked
                                ? t('explore.unlike_product', 'Unlike product')
                                : t('explore.like_product', 'Like product')
                            }
                          >
                            <Heart
                              className={`h-4 w-4 ${isLiked ? 'fill-current' : ''}`}
                            />
                          </button>
                        );
                      })()}
                      <button
                        type="button"
                        className={`explore-product-card__button-icon ${
                          selectedProductForModal.allow_add_as_item === false ? 'disabled' : ''
                        }`}
                        onClick={() =>
                          selectedProductForModal.allow_add_as_item === false
                            ? undefined
                            : handleAddAsItemClick(selectedProductForModal)
                        }
                        disabled={selectedProductForModal.allow_add_as_item === false}
                        aria-label={t('explore.add_as_item', 'Add as item')}
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

      {/* Add as item dialog for brand products */}
      {productForAdd && isAddDialogOpen && wishlistOptions.length > 0 && (
        <WishAddDialog
          open={isAddDialogOpen}
          onOpenChange={(open) => {
            setIsAddDialogOpen(open);
            if (!open) {
              setProductForAdd(null);
            }
          }}
          wishlists={wishlistOptions}
          initialTitle={productForAdd.name || ""}
          initialBrand={productForAdd.brands?.brand_name || ""}
          initialDescription={productForAdd.description || ""}
          initialImageUrl={productForAdd.image_url || null}
          onSubmit={async ({ wishlistId, title, brand, description, desire, imagePreviewUrl }) => {
            try {
              const effectiveTitle = title || productForAdd.name || "";
              const effectiveBrand = brand || productForAdd.brands?.brand_name || "";
              const effectiveDescription = description || productForAdd.description || "";

              const imageUrlToSave =
                typeof imagePreviewUrl === "string" && imagePreviewUrl.startsWith("http")
                  ? imagePreviewUrl
                  : productForAdd.image_url || null;

              const itemData = {
                wishlist_id: wishlistId,
                title: effectiveTitle,
                brand: effectiveBrand,
                description: effectiveDescription,
                desire,
                image_url: imageUrlToSave,
                item_url: productForAdd.product_url || null,
                brand_product_id: productForAdd.id || null, // Link to brand product for analytics
              };

              console.log("🔍 Saving wishlist item with brand_product_id:", itemData.brand_product_id);
              console.log("📦 Full product data:", productForAdd);
              console.log("💾 Item data being saved:", itemData);

              const { error } = await (supabase as any)
                .from("wishlist_items")
                .insert(itemData);

              if (error) {
                console.error("❌ Error saving wishlist item:", error);
                throw error;
              }

              console.log("✅ Wishlist item saved successfully!");

              toast.success(
                t("explore.added_product_to_wishlist", "Added to your wishlist"),
              );
            } catch (e: any) {
              toast.error(
                e?.message ||
                  t("common.error_generic", "Something went wrong. Please try again."),
              );
            } finally {
              setIsAddDialogOpen(false);
              setProductForAdd(null);
            }
          }}
        />
      )}
    </div>
  );
};

export default Explore;
