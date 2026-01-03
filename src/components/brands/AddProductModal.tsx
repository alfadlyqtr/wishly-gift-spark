import React, { useMemo, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

/**
 * AddProductModal
 * - Dialog-based modal triggered by the Add Product button
 * - Two tabs:
 *   1) Link/Text: paste URL or type description. Submitting a URL calls the Edge Function (ai-gateway) to parse content.
 *   2) Photo Upload: placeholder for file input (future: integrate Supabase Storage)
 * - Final Save: inserts a row into `brand_products` with the finalized fields
 *
 * Props:
 * - children: Trigger element (the Add Product button) via DialogTrigger asChild
 */
export type AddProductModalProps = React.PropsWithChildren<{}>;

export const AddProductModal: React.FC<AddProductModalProps> = ({ children }) => {
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  // Inputs
  const [url, setUrl] = useState("");

  // AI scraping result / editable fields
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [selectedTone, setSelectedTone] = useState<"" | "tidy" | "confident" | "pro" | "sales" | "aggressive">("");

  const [loadingScrape, setLoadingScrape] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [extractingFromImage, setExtractingFromImage] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "https://oefwopmeejfhzwojczqq.supabase.co";
  const supabaseAnonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9lZndvcG1lZWpmaHp3b2pjenFxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjIyNDAyMDIsImV4cCI6MjA3NzgxNjIwMn0._r6kM1tzRcpBIuGW0m-lZWFecbZT4d1rHJVO3EzVueQ";

  const edgeFunctionUrl = useMemo(() => {
    if (!supabaseUrl) return "";
    return `${supabaseUrl}/functions/v1/ai-gateway`;
  }, [supabaseUrl]);

  const extractFromImageUrl = useMemo(() => {
    if (!supabaseUrl) return "";
    return `${supabaseUrl}/functions/v1/extract-from-image`;
  }, [supabaseUrl]);

  const readFileAsBase64 = (file: File) => {
    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        const base64 = result.includes(",") ? result.split(",")[1] : result;
        resolve(base64);
      };
      reader.onerror = () => reject(reader.error || new Error(t("errors.failed_read_file", "Failed to read file")));
      reader.readAsDataURL(file);
    });
  };

  const handlePhotoUpload = async (file: File | null) => {
    if (!file) return;
    setUploadError(null);

    try {
      setUploadingImage(true);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error(t("common.not_authenticated", "Not authenticated"));
      }

      const fileExt = file.name.split(".").pop();
      const filePath = `brand-products/${user.id}/${Date.now()}.${fileExt}`;

      const { error: uploadError } = await (supabase as any).storage
        .from("brand-media")
        .upload(filePath, file, {
          cacheControl: "3600",
          upsert: false,
        });

      if (uploadError) {
        throw uploadError;
      }

      const { data: publicUrlData } = (supabase as any).storage
        .from("brand-media")
        .getPublicUrl(filePath);

      if (!publicUrlData?.publicUrl) {
        throw new Error(t("errors.failed_public_url", "Could not get public URL for image"));
      }
      setPhotoFile(file);
      setImageUrl(publicUrlData.publicUrl);
      toast.success(t("brand.product.image_uploaded", "Image uploaded"));
    } catch (err: any) {
      const message = err?.message || t("errors.failed_to_upload", "Failed to upload image");
      setUploadError(message);
      toast.error(message);
    } finally {
      setUploadingImage(false);
    }
  };

  const handleScrape = async (tone?: "tidy" | "confident" | "pro" | "sales" | "aggressive") => {
    if (!url) {
      toast.error(t("brand.product.paste_url_first", "Please paste a URL first."));
      return;
    }
    if (!edgeFunctionUrl || !supabaseAnonKey) {
      toast.error(t("brand.product.ai_not_configured", "AI gateway is not configured."));
      return;
    }

    try {
      setLoadingScrape(true);

      // Step 1: Scrape the URL
      const res = await fetch(edgeFunctionUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${supabaseAnonKey}`,
        },
        body: JSON.stringify({ url }),
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `Gateway request failed (${res.status})`);
      }

      const data = await res.json();
      // Expected shape: { title, description, image_url, item_url }
      let finalTitle = data.title ?? title;
      let finalDescription = data.description ?? description;
      setTitle(finalTitle);
      setDescription(finalDescription);
      if (data.item_url) setUrl(data.item_url);

      // Step 2: If a tone was selected, rewrite the description with AI
      if (tone && finalDescription) {
        try {
          const rewriteRes = await fetch(edgeFunctionUrl, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${supabaseAnonKey}`,
            },
            body: JSON.stringify({
              mode: "rewrite-description",
              context: "brand_product",
              tone,
              name: finalTitle,
              description: finalDescription,
              product_url: data.item_url ?? url,
              locale: "en",
            }),
          });

          if (rewriteRes.ok) {
            const rewriteData = await rewriteRes.json();
            if (rewriteData.name) setTitle(rewriteData.name);
            if (rewriteData.description) setDescription(rewriteData.description);
          }
        } catch (rewriteErr) {
          console.warn("AI rewrite failed, keeping scraped description:", rewriteErr);
        }
      }

      // Step 3: Reuse the discovered image URL directly (do not re-upload)
      if (data.image_url) setImageUrl(data.image_url);
      
      toast.success(t("brand.product.details_fetched", "Product details fetched"));
    } catch (e: any) {
      toast.error(e?.message || t("errors.failed_fetch_details", "Failed to fetch product details"));
    } finally {
      setLoadingScrape(false);
    }
  };

  const handleExtractFromPhoto = async () => {
    try {
      if (!extractFromImageUrl || !supabaseUrl) {
        toast.error(t("brand.product.extractor_not_configured", "Image AI extractor is not configured."));
        return;
      }

      const canUseExistingImageUrl = Boolean(imageUrl);
      if (!photoFile && !canUseExistingImageUrl) {
        toast.error(t("brand.product.upload_photo_first", "Please upload a photo first"));
        return;
      }

      setExtractingFromImage(true);

      let base64: string;
      if (photoFile) {
        base64 = await readFileAsBase64(photoFile);
      } else {
        const resImg = await fetch(imageUrl);
        if (!resImg.ok) {
          throw new Error(t("errors.failed_to_load", "Failed to load"));
        }
        const blob = await resImg.blob();
        const f = new File([blob], "image", { type: blob.type || "image/jpeg" });
        base64 = await readFileAsBase64(f);
      }
      const { data: session } = await supabase.auth.getSession();
      const token = session.session?.access_token;

      const res = await fetch(extractFromImageUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token
            ? { Authorization: `Bearer ${token}` }
            : supabaseAnonKey
            ? { Authorization: `Bearer ${supabaseAnonKey}` }
            : {}),
        },
        body: JSON.stringify({ image_base64: base64, locale: "en", mode: "brand" }),
      });

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(text || `Failed to extract from image (${res.status})`);
      }

      const json = await res.json();
      const s = json?.structured || json;

      const titleFromApi = s?.Item_Name || s?.title || "";
      const descFromApi = s?.Description || s?.description || "";
      const urlFromApi = s?.url || "";

      let updated = false;
      if (titleFromApi) {
        setTitle(titleFromApi);
        updated = true;
      }
      if (descFromApi) {
        setDescription(descFromApi);
        updated = true;
      }
      if (urlFromApi) {
        setUrl(urlFromApi);
        updated = true;
      }

      if (updated) {
        toast.success(t("brand.product.extracted_from_image", "Extracted details from image"));
      } else {
        toast.info(t("brand.product.no_details_found", "Image analyzed but no structured details were found."));
      }
    } catch (e: any) {
      const msg = e?.message || (typeof e === "string" ? e : "") || t("errors.failed_extract_image", "Failed to extract from image");
      toast.error(msg);
    } finally {
      setExtractingFromImage(false);
    }
  };

  const handleWishlyAi = async () => {
    // Priority 1: URL fetch (best for product catalogs)
    if (url) {
      await handleScrape(selectedTone || undefined);
      return;
    }
    // Priority 2: Image extraction (if no URL provided)
    if (photoFile || imageUrl) {
      await handleExtractFromPhoto();
      return;
    }
    toast.error(t("brand.product.paste_url_first", "Please paste a URL first."));
  };

  const handleSave = async () => {
    if (!title) {
      toast.error(t("brand.product.name_required", "Product name is required"));
      return;
    }

    try {
      setSaving(true);
      
      // Get brand ID
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error(t("common.not_authenticated", "Not authenticated"));
        return;
      }

      const { data: brandData } = await (supabase as any)
        .from("brands")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (!brandData) {
        toast.error(t("brand.product.brand_not_found", "Brand not found"));
        return;
      }

      const { error } = await (supabase as any).from("brand_products").insert([
        {
          brand_id: brandData.id,
          name: title,
          description: description || null,
          product_url: url || null,
          image_url: imageUrl || null,
          status: "active",
        },
      ]);

      if (error) {
        toast.error(error.message);
        return;
      }

      // Invalidate queries to refresh product list in real-time
      await queryClient.invalidateQueries({ queryKey: ["brand-products"] });
      await queryClient.invalidateQueries({ queryKey: ["brand-dashboard"] });
      
      toast.success(t("brand.product.added_successfully", "Product added successfully"));
      // Reset fields on success
      handleClear();
      setOpen(false);
    } catch (e: any) {
      toast.error(e?.message || t("errors.failed_save_product", "Failed to save product"));
    } finally {
      setSaving(false);
    }
  };

  const handleClear = () => {
    setUrl("");
    setTitle("");
    setDescription("");
    setImageUrl("");
    setPhotoFile(null);
    setUploadError(null);
    setSelectedTone("");
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="w-[92vw] max-w-[420px] p-0 sm:p-0 rounded-2xl max-h-[85vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle className="sr-only">{t("brand.product.add_title", "Add Product")}</DialogTitle>
        </DialogHeader>
        <div className="mx-auto w-full rounded-2xl p-[2px] bg-gradient-to-r from-[hsl(var(--brand-cool-start))] via-[hsl(var(--brand-cool-end))] to-[hsl(var(--brand-warm-end))]">
          <div className="rounded-2xl bg-white/90 backdrop-blur p-4 sm:p-6 ring-1 ring-white/70 max-h-[calc(85vh-12px)] overflow-y-auto overscroll-contain">
            <h3 className="heading text-center font-semibold text-lg text-foreground">{t("brand.product.add_title", "Add Product")}</h3>
            <p className="mt-1 text-center text-xs text-muted-foreground">
              {t("brand.product.add_subtitle", "Paste a link, type a description, or upload a photo.")}
            </p>

            <div className="mt-3 space-y-3">
              <div className="flex flex-col gap-3 mt-3">
                    <div className="mt-2 flex flex-col items-center">
                    <div className="space-y-3 w-full max-w-xs">
                      <div className="flex items-center justify-between">
                        <Label htmlFor="photo_file" className="text-xs font-semibold text-slate-700">{t("brand.product.upload_file_label", "Upload image file")}</Label>
                      </div>
                      {/* Folder-style upload card with preview */}
                      <style>{`@keyframes folder-float {0%{transform:translateY(0)}50%{transform:translateY(-6px)}100%{transform:translateY(0)}}`}</style>
                      <div
                        className="group relative w-full rounded-[20px] px-3 sm:px-4 pt-10 sm:pt-14 pb-3 sm:pb-4 mx-auto"
                        style={{
                          background: "linear-gradient(135deg, #f162ba, #ed45ae)",
                          boxShadow: "0 18px 32px rgba(15,23,42,0.32)",
                          maxWidth: 260,
                          width: "100%",
                          border: "1px solid rgba(255,255,255,0.55)",
                        }}
                      >
                        <div
                          className="absolute left-3 right-3 top-2 h-2 rounded-full"
                          style={{
                            background:
                              "linear-gradient(180deg, rgba(255,255,255,0.7), rgba(255,255,255,0))",
                          }}
                        />

                        <button
                          type="button"
                          onClick={() => fileRef.current?.click()}
                          className="absolute -top-3 left-1/2 -translate-x-1/2 flex flex-col items-center"
                          style={{ animation: "folder-float 2.5s ease-in-out infinite" }}
                          aria-label={t("brand.product.upload_aria", "Upload product image")}
                        >
                          <div
                            className="relative overflow-hidden w-[96px] h-[64px] sm:w-[112px] sm:h-[74px]"
                            style={{ filter: "drop-shadow(0 10px 18px rgba(15,23,42,0.4))" }}
                          >
                            <div
                              className="absolute -top-2 left-4 sm:left-6 h-4 sm:h-5 w-16 sm:w-20 rounded-t-[12px]"
                              style={{
                                background: "linear-gradient(135deg,#ff9a56,#ff6f56)",
                                boxShadow: "0 5px 14px rgba(15,23,42,0.35)",
                              }}
                            />
                            <div
                              className="absolute inset-0 rounded-[14px]"
                              style={{
                                background: "linear-gradient(135deg,#ffe563,#ffc663)",
                                boxShadow: "0 16px 26px rgba(15,23,42,0.38)",
                              }}
                            />
                            {imageUrl ? (
                              <img
                                src={imageUrl}
                                alt={t("brand.product.preview_alt", "Product preview")}
                                className="absolute inset-0 h-full w-full object-contain rounded-[14px] bg-white p-1"
                              />
                            ) : null}
                          </div>
                        </button>

                        <button
                          type="button"
                          onClick={() => fileRef.current?.click()}
                          className="mt-4 w-full rounded-[16px] text-white text-center py-2 sm:py-2.5 px-4 text-sm font-semibold tracking-wide"
                          style={{
                            background: "#ff9ad5",
                            boxShadow:
                              "inset 0 1.5px 0 rgba(255,255,255,0.55), 0 12px 22px rgba(15,23,42,0.25)",
                            border: "1px solid rgba(255,255,255,0.8)",
                          }}
                        >
                          {uploadingImage
                            ? t("brand.product.uploading", "Uploading…")
                            : imageUrl
                            ? t("brand.product.change_photo", "Change Photo")
                            : t("brand.product.upload_button", "Upload a Photo")}
                        </button>

                        <input
                          ref={fileRef}
                          id="photo_file"
                          type="file"
                          accept="image/*"
                          className="hidden"
                          aria-label={t("brand.product.upload_aria", "Upload product image")}
                          title={t("brand.product.upload_aria", "Upload product image")}
                          onChange={(e) => handlePhotoUpload(e.target.files?.[0] || null)}
                          disabled={uploadingImage}
                        />
                      </div>

                      <p className="text-[11px] leading-snug text-muted-foreground mt-2">
                        {t("brand.product.upload_hint_minimal", "We will use this image for your product and AI extraction.")}
                      </p>
                      {uploadError && (
                        <p className="text-xs text-red-500">{uploadError}</p>
                      )}

                      <button
                        type="button"
                        onClick={handleWishlyAi}
                        disabled={extractingFromImage || loadingScrape || (!photoFile && !imageUrl && !url)}
                        className="mt-3 w-full inline-flex items-center justify-center gap-1.5 rounded-full bg-gradient-to-r from-[hsl(var(--brand-cool-start))] via-[hsl(var(--brand-cool-end))] to-[hsl(var(--brand-warm-end))] px-4 py-2.5 text-[12px] font-semibold text-white shadow-[0_10px_22px_rgba(15,23,42,0.25)] transition-transform transition-shadow duration-150 active:scale-[0.97] hover:shadow-[0_14px_26px_rgba(15,23,42,0.3)] disabled:opacity-60 disabled:cursor-not-allowed"
                      >
                        <span aria-hidden="true">✨</span>
                        {extractingFromImage || loadingScrape
                          ? t("brand.product.ai_working", "Wishly AI · working…")
                          : t("brand.product.ai_action", "Extract/fetch with Wishly AI")}
                      </button>
                    </div>
                    </div>

                    {/* Paste URL row */}
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <Label htmlFor="url">{t("brand.product.paste_url", "Paste URL")}</Label>
                        <div className="inline-flex items-center gap-2">
                          <span className="hidden sm:inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-[hsl(var(--brand-cool-start))] to-[hsl(var(--brand-warm-end))] px-3 py-0.5 text-[11px] font-medium text-white shadow-sm">
                            <span aria-hidden="true">✨</span>
                            {loadingScrape ? t("brand.product.ai_fetching", "Wishly AI · fetching…") : t("brand.product.ai_badge", "Wishly AI")}
                          </span>
                          <select
                            className="text-[11px] rounded-full border border-[hsl(var(--brand-cool-start))]/35 bg-white px-3 py-1 text-slate-700 shadow-sm hover:border-[hsl(var(--brand-cool-start))]/70 focus:outline-none focus:ring-2 focus:ring-[hsl(var(--brand-cool-start))]/60"
                            value={selectedTone}
                            disabled={loadingScrape || extractingFromImage}
                            aria-label={t("brand.product.ai_style_aria", "AI fetch style")}
                            onChange={(e) => {
                              const tone = e.target.value as "" | "tidy" | "confident" | "pro" | "sales" | "aggressive";
                              setSelectedTone(tone);
                            }}
                          >
                            <option value="">{t("brand.product.tone_select", "Style")}</option>
                            <option value="tidy">{t("brand.product.tone_tidy", "AI tidy (shorter)")}</option>
                            <option value="confident">{t("brand.product.tone_confident", "Confident")}</option>
                            <option value="pro">{t("brand.product.tone_pro", "Pro")}</option>
                            <option value="sales">{t("brand.product.tone_sales", "Sales person")}</option>
                            <option value="aggressive">{t("brand.product.tone_aggressive", "High-energy sales")}</option>
                          </select>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Input
                          id="url"
                          type="url"
                          placeholder={t("brand.product.url_placeholder", "https://example.com/product")}
                          value={url}
                          onChange={(e) => setUrl(e.target.value)}
                        />
                      </div>
                    </div>

                    {/* Editable fields */}
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-2 sm:col-span-2">
                        <Label htmlFor="title">{t("brand.product.name_label", "Product Name")}</Label>
                        <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} />
                      </div>
                      <div className="space-y-2 sm:col-span-2">
                        <Label htmlFor="description">{t("brand.product.description_label", "Description")}</Label>
                        <Textarea id="description" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
                      </div>
                    </div>
              </div>

              <DialogFooter className="mt-4 flex flex-row items-center justify-between sm:justify-between w-full">
                <Button 
                  variant="outline" 
                  onClick={handleClear} 
                  disabled={saving || loadingScrape || extractingFromImage}
                  className="rounded-xl border-slate-200 text-slate-600 hover:bg-slate-50"
                >
                  {t("common.clear", "Clear")}
                </Button>
                <div className="flex flex-row gap-2">
                  <Button variant="secondary" onClick={() => setOpen(false)} disabled={saving} className="rounded-xl">
                    {t("common.cancel", "Cancel")}
                  </Button>
                  <Button 
                    onClick={handleSave} 
                    disabled={saving || !title}
                    className="rounded-xl bg-indigo-900 hover:bg-indigo-800 text-white"
                  >
                    {saving ? t("common.saving", "Saving...") : t("brand.product.save_button", "Save Product")}
                  </Button>
                </div>
              </DialogFooter>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
