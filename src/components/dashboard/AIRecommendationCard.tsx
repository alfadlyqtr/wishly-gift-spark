import { useEffect, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Sparkles, Store, Plus, ChevronLeft, ChevronRight } from "lucide-react";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import WishAddDialog from "@/components/wishes/WishAddDialog";
import { useWishlists } from "@/hooks/use-wishlists";
import { toast } from "sonner";
import "@/pages/ExploreProductsCard.css";

type BrandProduct = {
  id: string;
  name: string;
  description: string | null;
  image_url: string | null;
  allow_add_as_item: boolean;
  product_url?: string | null;
  brands: {
    id: string;
    brand_name: string;
    logo_url: string | null;
  } | null;
};

export const AIRecommendationCard = () => {
  const { t } = useTranslation();
  const [products, setProducts] = useState<BrandProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedProduct, setSelectedProduct] = useState<BrandProduct | null>(null);
  const [productForWishAdd, setProductForWishAdd] = useState<BrandProduct | null>(null);
  const [productWishlistIds, setProductWishlistIds] = useState<Record<string, string[]>>({});
  const [wishlistTitlesById, setWishlistTitlesById] = useState<Record<string, string>>({});
  const stripRef = useRef<HTMLDivElement | null>(null);
  const wishlistsQuery = useWishlists();
  const wishlistOptions = (wishlistsQuery.data || []).map((w) => ({ id: w.id, name: w.title }));

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        setLoading(true);
        const { data, error } = await (supabase as any)
          .from("brand_products")
          .select("id,name,description,image_url,product_url,allow_add_as_item,brands!inner(id,brand_name,logo_url)")
          .eq("is_findable", true)
          .limit(8)
          .order("created_at", { ascending: false });

        if (error) throw error;
        setProducts(data || []);
      } catch (err) {
        console.error("Error loading gift ideas:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchProducts();
  }, []);

  useEffect(() => {
    const refreshAddedFlags = async () => {
      try {
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
        console.warn("AIRecommendationCard: failed to refresh added flags", e);
      }
    };

    refreshAddedFlags();
  }, [products]);

  return (
    <>
      <Card
        className="relative overflow-hidden rounded-[24px] bg-gradient-to-br from-[hsl(var(--brand-cool-start))] via-[hsl(var(--brand-cool-end))] to-[hsl(var(--brand-warm-end))] shadow-[0_20px_45px_rgba(15,23,42,0.45)]"
      >
        <div className="rounded-[24px] bg-background/88 backdrop-blur-md">
        <CardHeader className="pb-3 px-5 pt-4">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Sparkles className="h-5 w-5 text-[hsl(var(--brand-warm-end))]" />
            {t("dashboard.gift_ideas_title", "Wishlist items")}
            <span className="text-sm font-normal text-muted-foreground">
              ({t("dashboard.gift_ideas_subtitle", "Recommended for you")})
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="px-5 pb-4">
          {loading && (
            <p className="text-xs text-muted-foreground pb-2">{t('dashboard.loading_products', 'Loading gift ideas...')}</p>
          )}
          <div className="relative">
            {products.length > 0 && (
              <>
                <button
                  type="button"
                  className="absolute -left-3 top-1/2 -translate-y-1/2 z-10 inline-flex h-8 w-8 items-center justify-center rounded-full bg-background/90 shadow-md border border-white/70 text-slate-700 hover:bg-white"
                  onClick={() => {
                    const el = stripRef.current;
                    if (!el) return;
                    const amount = el.clientWidth * 0.7;
                    el.scrollBy({ left: -amount, behavior: 'smooth' });
                  }}
                  aria-label={t('dashboard.slider_prev', 'Previous items')}
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  className="absolute -right-3 top-1/2 -translate-y-1/2 z-10 inline-flex h-8 w-8 items-center justify-center rounded-full bg-background/90 shadow-md border border-white/70 text-slate-700 hover:bg-white"
                  onClick={() => {
                    const el = stripRef.current;
                    if (!el) return;
                    const amount = el.clientWidth * 0.7;
                    el.scrollBy({ left: amount, behavior: 'smooth' });
                  }}
                  aria-label={t('dashboard.slider_next', 'Next items')}
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </>
            )}
            <div
              ref={stripRef}
              className="w-full overflow-x-auto wishlist-strip scroll-smooth"
            >
              <div className="flex gap-4 pr-2">
                {products.length > 0 ? (
                  products.map((product) => (
                    <div
                      key={product.id}
                      className="w-32 shrink-0 space-y-2 rounded-lg bg-card border p-3 hover:shadow-md transition-shadow cursor-pointer"
                      onClick={() => setSelectedProduct(product)}
                    >
                      <div className="aspect-square rounded-md bg-muted flex items-center justify-center overflow-hidden">
                        {product.image_url ? (
                          <img
                            src={product.image_url}
                            alt={product.name}
                            className="h-full w-full object-cover"
                            onError={(e: any) => {
                              e.currentTarget.style.display = "none";
                            }}
                          />
                        ) : (
                          <Store className="h-8 w-8 text-muted-foreground" />
                        )}
                      </div>
                      <div>
                        <p className="text-sm font-medium line-clamp-2">{product.name}</p>
                        {product.brands?.brand_name && (
                          <p className="text-xs text-muted-foreground truncate">{product.brands.brand_name}</p>
                        )}
                        {(() => {
                          const wishlistIds = productWishlistIds[String(product.id)] || [];
                          if (wishlistIds.length === 0) return null;
                          if (wishlistIds.length === 1) {
                            const name = wishlistTitlesById[wishlistIds[0]] || "";
                            return (
                              <p className="mt-1 inline-flex max-w-full items-center overflow-hidden text-ellipsis rounded-full bg-emerald-50/80 text-emerald-800 text-[10px] px-2 py-0.5 font-semibold ring-1 ring-emerald-200/70 whitespace-nowrap">
                                {t("explore.added_to_name", { name: name || t("wish_item.wishlist_label", "Wishlist") })}
                              </p>
                            );
                          }
                          return (
                            <p className="mt-1 inline-flex max-w-full items-center overflow-hidden text-ellipsis rounded-full bg-emerald-50/80 text-emerald-800 text-[10px] px-2 py-0.5 font-semibold ring-1 ring-emerald-200/70 whitespace-nowrap">
                              {t("explore.added_to_count", { count: wishlistIds.length })}
                            </p>
                          );
                        })()}
                      </div>
                    </div>
                  ))
                ) : !loading ? (
                  <p className="text-xs text-muted-foreground">{t('dashboard.no_products', 'No products available yet.')}</p>
                ) : null}
              </div>
            </div>
          </div>
        </CardContent>
        </div>
      </Card>

      {/* Product Detail Modal - Premium Card */}
      {selectedProduct && (
        <Dialog
          open={!!selectedProduct}
          onOpenChange={(open) => {
            if (!open) setSelectedProduct(null);
          }}
        >
          <DialogContent className="max-w-md sm:max-w-lg border-0 bg-transparent shadow-none p-0">
            <div className="flex justify-end px-2 pt-2">
              <button
                type="button"
                onClick={() => setSelectedProduct(null)}
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
                    {selectedProduct.image_url ? (
                      <img
                        src={selectedProduct.image_url}
                        alt={selectedProduct.name}
                        onError={(e: any) => {
                          e.currentTarget.style.display = "none";
                        }}
                      />
                    ) : null}
                  </div>

                  <div className="explore-product-card__text">
                    <p className="explore-product-card__title truncate">
                      {selectedProduct.name}
                    </p>
                    <p className="explore-product-card__description line-clamp-2">
                      {selectedProduct.description || t("explore.no_description", "No description provided")}
                    </p>
                    {(() => {
                      const wishlistIds = productWishlistIds[String(selectedProduct.id)] || [];
                      if (wishlistIds.length === 0) return null;
                      if (wishlistIds.length === 1) {
                        const name = wishlistTitlesById[wishlistIds[0]] || "";
                        return (
                          <div className="mt-2">
                            <span className="inline-flex max-w-full items-center overflow-hidden text-ellipsis rounded-full bg-emerald-50/80 text-emerald-800 text-[10px] px-2 py-0.5 font-semibold ring-1 ring-emerald-200/70 whitespace-nowrap">
                              {t("explore.added_to_name", { name: name || t("wish_item.wishlist_label", "Wishlist") })}
                            </span>
                          </div>
                        );
                      }
                      return (
                        <div className="mt-2">
                          <span className="inline-flex max-w-full items-center overflow-hidden text-ellipsis rounded-full bg-emerald-50/80 text-emerald-800 text-[10px] px-2 py-0.5 font-semibold ring-1 ring-emerald-200/70 whitespace-nowrap">
                            {t("explore.added_to_count", { count: wishlistIds.length })}
                          </span>
                        </div>
                      );
                    })()}
                  </div>

                  <div className="explore-product-card__footer">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="explore-product-card__brand truncate">
                        {selectedProduct.brands?.brand_name || t("explore.unknown_brand", "Brand / Store")}
                      </div>
                    </div>
                    <div className="explore-product-card__actions">
                      <button
                        type="button"
                        className="explore-product-card__button-text flex items-center gap-1"
                        onClick={() => setSelectedProduct(null)}
                      >
                        <Store className="h-3.5 w-3.5" />
                        <span>{t("explore.view_brand", "View store")}</span>
                      </button>
                      <button
                        type="button"
                        className={`explore-product-card__button-icon ${
                          selectedProduct.allow_add_as_item === false ? "disabled" : ""
                        }`}
                        onClick={() => {
                          if (selectedProduct.allow_add_as_item !== false) {
                            setProductForWishAdd(selectedProduct);
                            setSelectedProduct(null);
                          }
                        }}
                        disabled={selectedProduct.allow_add_as_item === false}
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
          initialBrand={productForWishAdd.brands?.brand_name || ""}
          initialDescription={productForWishAdd.description || ""}
          initialImageUrl={productForWishAdd.image_url || null}
          onSubmit={async ({ wishlistId, title, brand, description, desire, imagePreviewUrl }) => {
            let shouldClose = false;
            try {
              const effectiveTitle = title || productForWishAdd.name || "";
              const effectiveBrand = brand || productForWishAdd.brands?.brand_name || "";

              const { error } = await (supabase as any).from("wishlist_items").insert({
                wishlist_id: wishlistId,
                title: effectiveTitle,
                brand: effectiveBrand,
                description: description || "",
                desire: desire,
                image_url: imagePreviewUrl || productForWishAdd.image_url || null,
                item_url: productForWishAdd.product_url || null,
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
    </>
  );
};
