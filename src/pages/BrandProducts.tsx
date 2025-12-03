import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Plus, Trash2, ExternalLink, Eye, CirclePlus, Heart, Pencil } from "lucide-react";
import { AddProductModal } from "@/components/brands/AddProductModal";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import "./BrandProductsCard.css";

const BrandProducts = () => {
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();
  const location = useLocation();
  const navigate = useNavigate();
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [modalFlags, setModalFlags] = useState<{ is_findable: boolean; allow_add_as_item: boolean } | null>(null);
  const [viewMode, setViewMode] = useState<"card" | "grid" | "list">("list");
  const [brandSettings, setBrandSettings] = useState<{ products_find_mode?: 'all_off' | 'all_on' | 'per_product'; products_add_mode?: 'all_off' | 'all_on' | 'per_product'; } | null>(null);

  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState<{ name: string; description: string; product_url: string } | null>(null);
  const [selectedTone, setSelectedTone] = useState<"tidy" | "confident" | "pro" | "sales" | "aggressive" | null>(null);
  const [isAiLoading, setIsAiLoading] = useState(false);

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  const supabaseAnonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;

  const edgeFunctionUrl = useMemo(() => {
    if (!supabaseUrl) return "";
    return `${supabaseUrl}/functions/v1/ai-gateway`;
  }, [supabaseUrl]);

  const handleCloseModal = () => {
    setSelectedProduct(null);

    // Remove productId from query params so the modal doesn’t auto-reopen
    const params = new URLSearchParams(location.search);
    if (params.has("productId")) {
      params.delete("productId");
      navigate({ pathname: location.pathname, search: params.toString() ? `?${params.toString()}` : "" }, { replace: true });
    }
  };

  // Fetch brand products
  const { data: products, isLoading } = useQuery({
    queryKey: ["brand-products"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data: brandData } = await (supabase as any)
        .from("brands")
        .select("id, products_find_mode, products_add_mode")
        .eq("user_id", user.id)
        .maybeSingle();

      if (!brandData) return [];

      setBrandSettings({
        products_find_mode: (brandData.products_find_mode as any) || 'per_product',
        products_add_mode: (brandData.products_add_mode as any) || 'per_product',
      });

      const { data, error } = await (supabase as any)
        .from("brand_products")
        .select("*")
        .eq("brand_id", brandData.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      const baseProducts = (data || []) as any[];

      // Fetch aggregated engagement metrics (views/adds/likes) for these products
      const { data: analytics, error: analyticsError } = await (supabase as any).rpc(
        "brand_dashboard_analytics",
        { brand_uuid: brandData.id }
      );

      if (analyticsError) {
        console.error("Error loading brand analytics for products:", analyticsError);
      }

      const metricsById: Record<string, { views: number; adds: number; likes: number }> = {};
      for (const row of (analytics as any[] | null) || []) {
        metricsById[row.product_id] = {
          views: row.views_count ?? 0,
          adds: row.adds_count ?? 0,
          likes: row.likes_count ?? 0,
        };
      }

      return baseProducts.map((p) => ({
        ...p,
        __metrics: metricsById[p.id] || { views: 0, adds: 0, likes: 0 },
      }));
    },
  });

  const handleAiTone = async (tone: "tidy" | "confident" | "pro" | "sales" | "aggressive") => {
    if (!editForm || !selectedProduct) return;

    if (!edgeFunctionUrl || !supabaseAnonKey) {
      toast.error(t("brand.ai_gateway_not_configured", "AI gateway is not configured."));
      return;
    }

    try {
      setIsAiLoading(true);
      const res = await fetch(edgeFunctionUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${supabaseAnonKey}`,
        },
        body: JSON.stringify({
          mode: "rewrite-description",
          tone,
          name: editForm.name,
          description: editForm.description,
          product_url: editForm.product_url,
          locale: i18n.language,
        }),
      });

      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(errorText || `AI request failed (${res.status})`);
      }

      const data = await res.json();
      if (data && (typeof data.description === "string" || typeof data.name === "string")) {
        const rawName = typeof data.name === "string" ? data.name.trim() : "";
        const nextName = rawName
          ? rawName.slice(0, 90)
          : editForm.name;

        const nextDescription = typeof data.description === "string" && data.description.trim().length > 0
          ? data.description
          : editForm.description;

        setEditForm((prev) => (prev ? { ...prev, name: nextName, description: nextDescription } : prev));
        setSelectedTone(tone);
        toast.success(t("brand.ai_tone_success", "Description updated with AI"));
      } else {
        toast.error(t("brand.ai_tone_error_missing", "AI did not return a description."));
      }
    } catch (error: any) {
      console.error("AI tone error", error);
      toast.error(
        error?.message ||
          t("brand.ai_tone_error", "Couldn't update description with AI. Please try again."),
      );
    } finally {
      setIsAiLoading(false);
    }
  };

  const updateProductDetails = useMutation({
    mutationFn: async ({ id, name, description, product_url }: { id: string; name: string; description: string; product_url: string }) => {
      const { error } = await (supabase as any)
        .from("brand_products")
        .update({ name, description, product_url })
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["brand-products"] });
      toast.success(t("brand.product_updated", "Product updated successfully"));
      setIsEditing(false);
    },
    onError: (error: any) => {
      toast.error(error.message || t("brand.product_update_error", "Failed to update product settings"));
    },
  });

  // If navigated from BrandDashboard with a productId query param, auto-open that product in the modal
  useEffect(() => {
    if (!products || products.length === 0) return;
    if (selectedProduct) return;

    const params = new URLSearchParams(location.search);
    const productId = params.get("productId");
    if (!productId) return;

    const found = products.find((p: any) => p.id === productId);
    if (found) {
      setSelectedProduct(found);
    }
  }, [products, location.search, selectedProduct]);

  const updateProductFlags = useMutation({
    mutationFn: async ({ id, is_findable, allow_add_as_item }: { id: string; is_findable?: boolean; allow_add_as_item?: boolean }) => {
      const updates: any = {};
      if (typeof is_findable === 'boolean') updates.is_findable = is_findable;
      if (typeof allow_add_as_item === 'boolean') updates.allow_add_as_item = allow_add_as_item;
      const { error } = await (supabase as any)
        .from("brand_products")
        .update(updates)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["brand-products"] });
    },
    onError: (error: any) => {
      toast.error(error.message || t("brand.product_update_error", "Failed to update product settings"));
    },
  });

  const effectiveFindState = (product: any) => {
    return {
      value: product.is_findable !== false,
      disabled: false,
    };
  };

  const effectiveAddState = (product: any) => {
    return {
      value: product.allow_add_as_item !== false,
      disabled: false,
    };
  };

  // When a product is opened in the modal, initialise local toggle state
  useEffect(() => {
    if (selectedProduct) {
      setModalFlags({
        is_findable: selectedProduct.is_findable !== false,
        allow_add_as_item: selectedProduct.allow_add_as_item !== false,
      });
      setIsEditing(false);
      setEditForm({
        name: selectedProduct.name || "",
        description: selectedProduct.description || "",
        product_url: selectedProduct.product_url || "",
      });
      setSelectedTone(null);
    } else {
      setModalFlags(null);
      setIsEditing(false);
      setEditForm(null);
      setSelectedTone(null);
    }
  }, [selectedProduct]);

  // Delete product mutation
  const deleteMutation = useMutation({
    mutationFn: async (productId: string) => {
      const { error } = await (supabase as any)
        .from("brand_products")
        .delete()
        .eq("id", productId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["brand-products"] });
      toast.success(t("brand.product_deleted", "Product deleted successfully"));
    },
    onError: (error: any) => {
      toast.error(error.message || t("brand.product_delete_error", "Failed to delete product"));
    },
  });

  return (
    <div className="p-4 md:p-6 space-y-4">
      <Card className="shadow-lg border border-white/40 bg-gradient-to-br from-white/95 via-white/90 to-white/80">
        <CardHeader className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <CardTitle className="text-2xl font-bold">
              {t("brand.products_title", "Products")}
            </CardTitle>
            <CardDescription>
              {t("brand.products_subtitle", "Manage the items you want to appear in Wishly.")}
            </CardDescription>
          </div>
          <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center">
            <div className="inline-flex rounded-full border bg-muted px-1 py-0.5 text-xs self-start">
              <button
                type="button"
                className={`px-2 py-1 rounded-full ${viewMode === "card" ? "bg-white shadow-sm" : "text-muted-foreground"}`}
                onClick={() => setViewMode("card")}
              >
                {t("brand.view_card", "Card")}
              </button>
              <button
                type="button"
                className={`px-2 py-1 rounded-full ${viewMode === "grid" ? "bg-white shadow-sm" : "text-muted-foreground"}`}
                onClick={() => setViewMode("grid")}
              >
                {t("brand.view_grid", "Grid")}
              </button>
              <button
                type="button"
                className={`px-2 py-1 rounded-full ${viewMode === "list" ? "bg-white shadow-sm" : "text-muted-foreground"}`}
                onClick={() => setViewMode("list")}
              >
                {t("brand.view_list", "List")}
              </button>
            </div>
            <AddProductModal>
              <Button className="bg-gradient-to-r from-brand-warm-start to-brand-warm-end text-white hover:brightness-110 w-full sm:w-auto">
                <Plus className="h-4 w-4 mr-2" />
                {t("brand.products_add", "Add Product")}
              </Button>
            </AddProductModal>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">{t("brand.loading_products", "Loading products...")}</p>
          ) : products && products.length > 0 ? (
            <div
              className={
                viewMode === "list"
                  ? "space-y-2"
                  : viewMode === "grid"
                  ? "grid grid-cols-2 lg:grid-cols-3 gap-3"
                  : "brand-product-list"
              }
            >
              {products.map((product: any) => {
                const metrics = (product as any).__metrics || { views: 0, adds: 0, likes: 0 };
                return (
                  <div
                    key={product.id}
                    className={
                      viewMode === "list"
                        ? "flex items-center justify-between rounded-xl border bg-white px-3 py-2 text-sm hover:bg-muted cursor-pointer"
                        : viewMode === "grid"
                        ? "rounded-xl border bg-white shadow-sm hover:shadow-md transition-shadow cursor-pointer p-3 flex flex-col gap-2"
                        : "brand-product-card"
                    }
                    onClick={() => setSelectedProduct(product)}
                  >
                    {viewMode === "list" ? (
                      <>
                        <div className="flex items-center gap-2 min-w-0">
                          {product.image_url && (
                            <img
                              src={product.image_url}
                              alt={product.name}
                              className="h-10 w-10 rounded-md object-cover flex-shrink-0"
                              onError={(e) => {
                                e.currentTarget.style.display = "none";
                              }}
                            />
                          )}
                          <div className="min-w-0">
                            <div className="text-[11px] text-muted-foreground">
                              {product.category || t("brand.products_item_type", "Product")}
                            </div>
                            <div className="text-sm font-medium truncate">{product.name}</div>
                            <div className="mt-0.5 flex flex-wrap gap-1">
                              <span
                                className={`inline-flex items-center rounded-full px-2 py-0.5 text-[9px] font-medium ${
                                  product.is_findable !== false
                                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                                    : 'bg-slate-100 text-slate-600 border border-slate-200'
                                }`}
                              >
                                {product.is_findable !== false
                                  ? t('brand.product_findable_short_on', 'Findable')
                                  : t('brand.product_findable_short_off', 'Hidden')}
                              </span>
                              <span
                                className={`inline-flex items-center rounded-full px-2 py-0.5 text-[9px] font-medium ${
                                  product.allow_add_as_item !== false
                                    ? 'bg-sky-50 text-sky-700 border border-sky-100'
                                    : 'bg-slate-100 text-slate-600 border border-slate-200'
                                }`}
                              >
                                {product.allow_add_as_item !== false
                                  ? t('brand.product_addable_short_on', 'Can be added')
                                  : t('brand.product_addable_short_off', 'Cannot be added')}
                              </span>
                              <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[9px] font-medium bg-white border border-slate-100 text-slate-700 gap-1">
                                <Eye className="h-3 w-3" />
                                {metrics.views}
                              </span>
                              <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[9px] font-medium bg-white border border-slate-100 text-slate-700 gap-1">
                                <CirclePlus className="h-3 w-3" />
                                {metrics.adds}
                              </span>
                              <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[9px] font-medium bg-white border border-slate-100 text-slate-700 gap-1">
                                <Heart className="h-3 w-3" />
                                {metrics.likes}
                              </span>
                            </div>
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteMutation.mutate(product.id);
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </>
                    ) : viewMode === "grid" ? (
                      <>
                        {product.image_url && (
                          <img
                            src={product.image_url}
                            alt={product.name}
                            className="w-full h-28 object-cover rounded-lg"
                            onError={(e) => {
                              e.currentTarget.style.display = "none";
                            }}
                          />
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="text-[11px] text-muted-foreground mb-0.5">
                            {product.category || t("brand.products_item_type", "Product")}
                          </div>
                          <div className="text-sm font-semibold truncate mb-0.5">{product.name}</div>
                          <div className="mb-1 flex flex-wrap gap-1">
                            <span
                              className={`inline-flex items-center rounded-full px-2 py-0.5 text-[9px] font-medium ${
                                product.is_findable !== false
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                                  : 'bg-slate-100 text-slate-600 border border-slate-200'
                              }`}
                            >
                              {product.is_findable !== false
                                ? t('brand.product_findable_short_on', 'Findable')
                                : t('brand.product_findable_short_off', 'Hidden')}
                            </span>
                            <span
                              className={`inline-flex items-center rounded-full px-2 py-0.5 text-[9px] font-medium ${
                                product.allow_add_as_item !== false
                                  ? 'bg-sky-50 text-sky-700 border border-sky-100'
                                  : 'bg-slate-100 text-slate-600 border border-slate-200'
                              }`}
                            >
                              {product.allow_add_as_item !== false
                                ? t('brand.product_addable_short_on', 'Can be added')
                                : t('brand.product_addable_short_off', 'Cannot be added')}
                            </span>
                            <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[9px] font-medium bg-white border border-slate-100 text-slate-700 gap-1">
                              <Eye className="h-3 w-3" />
                              {metrics.views}
                            </span>
                            <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[9px] font-medium bg-white border border-slate-100 text-slate-700 gap-1">
                              <CirclePlus className="h-3 w-3" />
                              {metrics.adds}
                            </span>
                            <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[9px] font-medium bg-white border border-slate-100 text-slate-700 gap-1">
                              <Heart className="h-3 w-3" />
                              {metrics.likes}
                            </span>
                          </div>
                          {product.description && (
                            <p className="text-xs text-muted-foreground line-clamp-2">
                              {product.description}
                            </p>
                          )}
                        </div>
                        <div className="mt-1 flex justify-end">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteMutation.mutate(product.id);
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="brand-product-card__img">
                          {product.image_url && (
                            <img
                              src={product.image_url}
                              alt={product.name}
                              onError={(e) => {
                                e.currentTarget.style.display = "none";
                              }}
                            />
                          )}
                        </div>

                        <div className="brand-product-card__wrapper">
                          <div>
                            <div className="brand-product-card__subtitle">
                              {product.category || t("brand.products_item_type", "Product")}
                            </div>
                            <div className="brand-product-card__title">{product.name}</div>
                            <div className="mt-1 flex flex-wrap gap-1">
                              <span
                                className={`inline-flex items-center rounded-full px-2 py-0.5 text-[9px] font-medium ${
                                  product.is_findable !== false
                                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                                    : 'bg-slate-100 text-slate-600 border border-slate-200'
                                }`}
                              >
                                {product.is_findable !== false
                                  ? t('brand.product_findable_short_on', 'Findable')
                                  : t('brand.product_findable_short_off', 'Hidden')}
                              </span>
                              <span
                                className={`inline-flex items-center rounded-full px-2 py-0.5 text-[9px] font-medium ${
                                  product.allow_add_as_item !== false
                                    ? 'bg-sky-50 text-sky-700 border border-sky-100'
                                    : 'bg-slate-100 text-slate-600 border border-slate-200'
                                }`}
                              >
                                {product.allow_add_as_item !== false
                                  ? t('brand.product_addable_short_on', 'Can be added')
                                  : t('brand.product_addable_short_off', 'Cannot be added')}
                              </span>
                              <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[9px] font-medium bg-white border border-slate-100 text-slate-700 gap-1">
                                <Eye className="h-3 w-3" />
                                {metrics.views}
                              </span>
                              <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[9px] font-medium bg-white border border-slate-100 text-slate-700 gap-1">
                                <CirclePlus className="h-3 w-3" />
                                {metrics.adds}
                              </span>
                              <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[9px] font-medium bg-white border border-slate-100 text-slate-700 gap-1">
                                <Heart className="h-3 w-3" />
                                {metrics.likes}
                              </span>
                            </div>
                          </div>
                          <div className="brand-product-card__icon">
                            <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                              <polyline points="9 18 15 12 9 6" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          </div>
                        </div>

                        {product.description && (
                          <div className="brand-product-card__description">
                            {product.description}
                          </div>
                        )}
                      <div className="mt-3 flex items-center justify-end">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedProduct(product);
                          }}
                          className="shrink-0 text-muted-foreground hover:text-foreground"
                          aria-label={t('brand.view_product_details', 'View product details')}
                        >
                          <ExternalLink className="h-4 w-4" />
                        </Button>
                      </div>
                    </>
                  )}
                </div>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              {t(
                "brand.products_placeholder",
                "Products you add will appear here. Click 'Add Product' to get started.",
              )}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Product Detail Modal - compact sheet */}
      <Dialog open={!!selectedProduct} onOpenChange={(open) => { if (!open) handleCloseModal(); }}>
        <DialogContent className="max-w-md sm:max-w-lg p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle className="text-base sm:text-lg font-semibold">
              {selectedProduct?.name}
            </DialogTitle>
          </DialogHeader>

          {selectedProduct && editForm && (
            <div className="space-y-3">
              {/* Product Image (small/medium) */}
              {selectedProduct.image_url && (
                <div className="w-full rounded-xl overflow-hidden bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center">
                  <img
                    src={selectedProduct.image_url}
                    alt={selectedProduct.name}
                    className="w-full max-h-64 object-contain"
                    onError={(e) => {
                      e.currentTarget.style.display = "none";
                    }}
                  />
                </div>
              )}

              {/* Product Name + Description */}
              <div>
                <h3 className="text-sm font-semibold mb-1">{t("brand.field_name", "Brand Name")}</h3>
                {isEditing ? (
                  <input
                    className="w-full rounded-md border border-slate-200 px-2 py-1 text-xs sm:text-sm"
                    value={editForm.name}
                    onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  />
                ) : (
                  <p className="text-xs sm:text-sm text-foreground whitespace-pre-wrap">
                    {editForm.name || selectedProduct.name}
                  </p>
                )}
              </div>

              <div>
                <div className="flex items-center justify-between mb-1 gap-2">
                  <h3 className="text-sm font-semibold">
                    {t("brand.product_description", "Description")}
                  </h3>
                  {isEditing && (
                    <div className="inline-flex items-center gap-2">
                      <span className="hidden sm:inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-[hsl(var(--brand-cool-start))] to-[hsl(var(--brand-warm-end))] px-3 py-0.5 text-[11px] font-medium text-white shadow-sm">
                        <span aria-hidden="true">✨</span>
                        {isAiLoading
                          ? t("brand.ai_badge_working", "Wishly AI · working…")
                          : t("brand.ai_badge_label", "Wishly AI")}
                      </span>
                      <select
                        className="text-[11px] rounded-full border border-[hsl(var(--brand-cool-start))]/35 bg-white px-3 py-1 text-slate-700 shadow-sm hover:border-[hsl(var(--brand-cool-start))]/70 focus:outline-none focus:ring-2 focus:ring-[hsl(var(--brand-cool-start))]/60"
                        value={selectedTone || ""}
                        disabled={isAiLoading}
                        aria-label={t("brand.ai_tone_helper", "AI tone helper")}
                        onChange={(e) => {
                          const value = e.target.value as
                            | ""
                            | "tidy"
                            | "confident"
                            | "pro"
                            | "sales"
                            | "aggressive";
                          if (!value) return;
                          handleAiTone(value);
                        }}
                      >
                        <option value="">
                          {t("brand.ai_tone_label", "AI tone")}
                        </option>
                        <option value="tidy">
                          {t("brand.ai_tone_tidy", "AI tidy (shorter)")}
                        </option>
                        <option value="confident">
                          {t("brand.ai_tone_confident", "Confident")}
                        </option>
                        <option value="pro">
                          {t("brand.ai_tone_pro", "Pro")}
                        </option>
                        <option value="sales">
                          {t("brand.ai_tone_sales", "Sales person")}
                        </option>
                        <option value="aggressive">
                          {t("brand.ai_tone_aggressive", "High-energy sales")}
                        </option>
                      </select>
                    </div>
                  )}
                </div>
                {isEditing ? (
                  <textarea
                    className="w-full rounded-md border border-slate-200 px-2 py-1 text-xs sm:text-sm min-h-[80px]"
                    value={editForm.description}
                    onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                  />
                ) : (
                  <p className="text-xs sm:text-sm text-muted-foreground whitespace-pre-wrap">
                    {editForm.description}
                  </p>
                )}
              </div>

              {/* Product URL */}
              <div>
                <h3 className="text-sm font-semibold mb-1">{t("brand.product_link", "Product Link")}</h3>
                {isEditing ? (
                  <input
                    className="w-full rounded-md border border-slate-200 px-2 py-1 text-xs sm:text-sm mb-2"
                    value={editForm.product_url}
                    onChange={(e) => setEditForm({ ...editForm, product_url: e.target.value })}
                  />
                ) : null}
                {editForm.product_url && (
                  <Button
                    variant="outline"
                    className="w-full justify-center text-xs sm:text-sm"
                    onClick={() => window.open(editForm.product_url, "_blank")}
                  >
                    <ExternalLink className="h-3 w-3 sm:h-4 sm:w-4 mr-2" />
                    {t("brand.view_on_website", "View on Brand Website")}
                  </Button>
                )}
              </div>

              {/* Product visibility settings */}
              <div className="mt-1 flex items-center justify-between gap-3 border rounded-lg px-3 py-2 bg-muted/40">
                <div className="flex flex-col gap-2 text-[11px] sm:text-xs text-muted-foreground w-full">
                  <div className="flex items-center justify-between gap-2">
                    <span>{t('brand.product_findable', 'Findable')}</span>
                    <Switch
                      checked={modalFlags?.is_findable ?? true}
                      disabled={updateProductFlags.isPending}
                      onCheckedChange={(checked) => {
                        setModalFlags((prev) =>
                          prev ? { ...prev, is_findable: checked } : { is_findable: checked, allow_add_as_item: modalFlags?.allow_add_as_item ?? true }
                        );
                        updateProductFlags.mutate({ id: selectedProduct.id, is_findable: checked });
                      }}
                    />
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span>{t('brand.product_addable', 'Add as item')}</span>
                    <Switch
                      checked={modalFlags?.allow_add_as_item ?? true}
                      disabled={updateProductFlags.isPending}
                      onCheckedChange={(checked) => {
                        setModalFlags((prev) =>
                          prev ? { ...prev, allow_add_as_item: checked } : { allow_add_as_item: checked, is_findable: modalFlags?.is_findable ?? true }
                        );
                        updateProductFlags.mutate({ id: selectedProduct.id, allow_add_as_item: checked });
                      }}
                    />
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex flex-wrap gap-2 pt-2">
                <Button
                  variant="outline"
                  className="flex-1 min-w-[90px] text-xs sm:text-sm"
                  onClick={handleCloseModal}
                >
                  {t("brand.close", "Close")}
                </Button>
                <Button
                  type="button"
                  className="flex-1 min-w-[100px] text-xs sm:text-sm bg-gradient-to-r from-[hsl(var(--brand-cool-start))] to-[hsl(var(--brand-warm-end))] text-white shadow-sm hover:shadow-md hover:scale-[1.02] transition-transform"
                  aria-label={t("brand.dashboard_edit_product", "Edit product")}
                  disabled={updateProductDetails.isPending}
                  onClick={() => {
                    if (!selectedProduct || !editForm) return;
                    if (!isEditing) {
                      setIsEditing(true);
                      return;
                    }
                    updateProductDetails.mutate({
                      id: selectedProduct.id,
                      name: editForm.name,
                      description: editForm.description,
                      product_url: editForm.product_url,
                    });
                  }}
                >
                  <Pencil className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
                  {isEditing
                    ? updateProductDetails.isPending
                      ? t("brand.saving", "Saving...")
                      : t("brand.save_profile", "Save Profile")
                    : t("brand.dashboard_edit_product", "Edit product")}
                </Button>
                <Button
                  variant="destructive"
                  className="text-xs sm:text-sm"
                  onClick={() => {
                    if (!selectedProduct) return;
                    deleteMutation.mutate(selectedProduct.id);
                    handleCloseModal();
                  }}
                  disabled={deleteMutation.isPending}
                >
                  <Trash2 className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
                  {t("common.delete", "Delete")}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default BrandProducts;
