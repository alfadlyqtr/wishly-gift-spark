import React, { useMemo, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Link2, ImagePlus } from "lucide-react";
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

  // Tab state and inputs
  const [activeTab, setActiveTab] = useState<"link" | "photo">("link");
  const [url, setUrl] = useState("");
  const [manualText, setManualText] = useState("");

  // AI scraping result / editable fields
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [itemUrl, setItemUrl] = useState("");
  const [imageUrl, setImageUrl] = useState("");

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
      reader.onerror = () => reject(reader.error || new Error("Failed to read file"));
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
        throw new Error("Not authenticated");
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
        throw new Error("Could not get public URL for image");
      }
      setPhotoFile(file);
      setImageUrl(publicUrlData.publicUrl);
      toast.success(t("brand.product.image_uploaded", "Image uploaded"));
    } catch (err: any) {
      const message = err?.message || "Failed to upload image";
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
      setItemUrl(data.item_url ?? url);

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

      // Step 3: Download and upload external image to Supabase Storage
      if (data.image_url) {
        try {
          const { data: { user } } = await supabase.auth.getUser();
          if (user) {
            const imageResponse = await fetch(data.image_url);
            const imageBlob = await imageResponse.blob();
            
            const fileExt = data.image_url.split('.').pop()?.split('?')[0] || 'jpg';
            const filePath = `brand-products/${user.id}/${Date.now()}.${fileExt}`;
            
            const { error: uploadError } = await (supabase as any).storage
              .from("brand-media")
              .upload(filePath, imageBlob, {
                cacheControl: "3600",
                upsert: false,
              });
            
            if (!uploadError) {
              const { data: publicUrlData } = (supabase as any).storage
                .from("brand-media")
                .getPublicUrl(filePath);
              
              if (publicUrlData?.publicUrl) {
                setImageUrl(publicUrlData.publicUrl);
              }
            } else {
              setImageUrl(data.image_url);
            }
          } else {
            setImageUrl(data.image_url);
          }
        } catch (imgError) {
          setImageUrl(data.image_url);
        }
      }
      
      toast.success(t("brand.product.details_fetched", "Product details fetched"));
    } catch (e: any) {
      toast.error(e?.message || "Failed to fetch product details");
    } finally {
      setLoadingScrape(false);
    }
  };

  const handleExtractFromPhoto = async () => {
    try {
      if (!photoFile) {
        toast.error(t("brand.product.upload_photo_first", "Please upload a photo first"));
        return;
      }
      if (!extractFromImageUrl || !supabaseUrl) {
        toast.error(t("brand.product.extractor_not_configured", "Image AI extractor is not configured."));
        return;
      }

      setExtractingFromImage(true);

      const base64 = await readFileAsBase64(photoFile);
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
        setItemUrl(urlFromApi);
        updated = true;
      }

      if (updated) {
        toast.success(t("brand.product.extracted_from_image", "Extracted details from image"));
        setActiveTab("link");
      } else {
        toast.info(t("brand.product.no_details_found", "Image analyzed but no structured details were found."));
      }
    } catch (e: any) {
      const msg = e?.message || (typeof e === "string" ? e : "") || "Failed to extract from image";
      toast.error(msg);
    } finally {
      setExtractingFromImage(false);
    }
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
          description: description || manualText || null,
          product_url: itemUrl || url || null,
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
      setUrl("");
      setManualText("");
      setTitle("");
      setDescription("");
      setItemUrl("");
      setImageUrl("");
      setOpen(false);
    } catch (e: any) {
      toast.error(e?.message || "Failed to save product");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="w-[92vw] max-w-[420px] p-0 sm:p-0 rounded-2xl">
        <DialogHeader>
          <DialogTitle className="sr-only">Add Product</DialogTitle>
        </DialogHeader>
        <div className="mx-auto w-full rounded-2xl p-[2px] bg-gradient-to-r from-[hsl(var(--brand-cool-start))] via-[hsl(var(--brand-cool-end))] to-[hsl(var(--brand-warm-end))]">
          <div className="rounded-2xl bg-white/90 backdrop-blur p-4 sm:p-6 ring-1 ring-white/70">
            <h3 className="heading text-center font-semibold text-lg text-foreground">Add Product</h3>
            <p className="mt-1 text-center text-xs text-muted-foreground">
              Paste a link, type a description, or upload a photo.
            </p>

            <div className="mt-3 space-y-3">
              {/* Tab selector - Explore style */}
              <div className="rounded-full p-[2px] bg-gradient-to-r from-[hsl(var(--brand-cool-start))] via-[hsl(var(--brand-cool-end))] to-[hsl(var(--brand-warm-end))] shadow-md">
                <div className="relative flex items-center rounded-full bg-white/80 backdrop-blur px-1 py-1 ring-1 ring-white/70 overflow-hidden">
                  {/* Sliding highlight */}
                  <span
                    className="pointer-events-none absolute top-1 bottom-1 rounded-full bg-white shadow-md transition-all duration-300 ease-out z-0"
                    style={{
                      width: '50%',
                      left: activeTab === 'link' ? '0%' : '50%',
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setActiveTab('link')}
                    className={`relative z-10 flex-1 rounded-full px-3 py-2 text-[12px] font-semibold transition-colors duration-200 flex items-center justify-center gap-1.5 ${
                      activeTab === 'link' ? 'text-foreground' : 'text-muted-foreground'
                    }`}
                  >
                    <Link2 className="h-4 w-4" />
                    <span>URL / Text</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab('photo')}
                    className={`relative z-10 flex-1 rounded-full px-3 py-2 text-[12px] font-semibold transition-colors duration-200 flex items-center justify-center gap-1.5 ${
                      activeTab === 'photo' ? 'text-foreground' : 'text-muted-foreground'
                    }`}
                  >
                    <ImagePlus className="h-4 w-4" />
                    <span>Photo Upload</span>
                  </button>
                </div>
              </div>

              {/* Tab content */}
              {activeTab === 'link' && (
              <div className="flex flex-col gap-3 mt-3">
                    {/* Paste URL row */}
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <Label htmlFor="url">Paste URL</Label>
                        <div className="inline-flex items-center gap-2">
                          <span className="hidden sm:inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-[hsl(var(--brand-cool-start))] to-[hsl(var(--brand-warm-end))] px-3 py-0.5 text-[11px] font-medium text-white shadow-sm">
                            <span aria-hidden="true">✨</span>
                            {loadingScrape ? "Wishly AI · fetching…" : "Wishly AI"}
                          </span>
                          <select
                            className="text-[11px] rounded-full border border-[hsl(var(--brand-cool-start))]/35 bg-white px-3 py-1 text-slate-700 shadow-sm hover:border-[hsl(var(--brand-cool-start))]/70 focus:outline-none focus:ring-2 focus:ring-[hsl(var(--brand-cool-start))]/60"
                            value=""
                            disabled={loadingScrape || !url}
                            aria-label="AI fetch style"
                            onChange={(e) => {
                              const tone = e.target.value as "" | "tidy" | "confident" | "pro" | "sales" | "aggressive";
                              if (!tone) return;
                              handleScrape(tone);
                            }}
                          >
                            <option value="">{loadingScrape ? "Fetching…" : "Fetch"}</option>
                            <option value="tidy">AI tidy (shorter)</option>
                            <option value="confident">Confident</option>
                            <option value="pro">Pro</option>
                            <option value="sales">Sales person</option>
                            <option value="aggressive">High-energy sales</option>
                          </select>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Input
                          id="url"
                          type="url"
                          placeholder="https://example.com/product"
                          value={url}
                          onChange={(e) => setUrl(e.target.value)}
                        />
                      </div>
                    </div>

                    {/* Manual description */}
                    <div className="space-y-2">
                      <Label htmlFor="manual">Or describe the item</Label>
                      <Textarea
                        id="manual"
                        placeholder="e.g., Red running shoes, size 42, Nike..."
                        value={manualText}
                        onChange={(e) => setManualText(e.target.value)}
                        rows={3}
                      />
                    </div>

                    {/* Editable fields */}
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-2 sm:col-span-2">
                        <Label htmlFor="title">Product Name</Label>
                        <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} />
                      </div>
                      <div className="space-y-2 sm:col-span-2">
                        <Label htmlFor="description">Description</Label>
                        <Textarea id="description" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="item_url">Product URL</Label>
                        <Input id="item_url" value={itemUrl} onChange={(e) => setItemUrl(e.target.value)} />
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor="image_url">Image URL</Label>
                        <Input
                          id="image_url"
                          value={imageUrl}
                          onChange={(e) => setImageUrl(e.target.value)}
                          placeholder="Right-click product image → Copy image address"
                        />
                        <p className="text-[11px] text-muted-foreground">
                          Tip: On the product page, right-click the main image and choose{" "}
                          <span className="font-medium">Copy image address</span>, then paste it here.
                        </p>
                      </div>
                    </div>
              </div>
              )}

              {activeTab === 'photo' && (
              <div className="mt-3 flex flex-col items-center">
                    <div className="space-y-3 w-full max-w-xs">
                      <div className="flex items-center justify-between">
                        <Label className="text-xs font-semibold text-slate-700">Upload image file</Label>
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
                          aria-label="Upload product image"
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
                                alt="Product preview"
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
                          {uploadingImage ? "Uploading…" : "Upload a Photo"}
                        </button>

                        <input
                          ref={fileRef}
                          id="photo_file"
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => handlePhotoUpload(e.target.files?.[0] || null)}
                          disabled={uploadingImage}
                        />
                      </div>

                      <p className="text-[11px] leading-snug text-muted-foreground mt-2">
                        We will upload this image to your brand storage and fill the Image URL field automatically.
                      </p>
                      {uploadError && (
                        <p className="text-xs text-red-500">{uploadError}</p>
                      )}

                      <button
                        type="button"
                        onClick={handleExtractFromPhoto}
                        disabled={extractingFromImage || !photoFile}
                        className="mt-3 w-full inline-flex items-center justify-center gap-1.5 rounded-full bg-gradient-to-r from-[hsl(var(--brand-cool-start))] via-[hsl(var(--brand-cool-end))] to-[hsl(var(--brand-warm-end))] px-4 py-2.5 text-[12px] font-semibold text-white shadow-[0_10px_22px_rgba(15,23,42,0.25)] transition-transform transition-shadow duration-150 active:scale-[0.97] hover:shadow-[0_14px_26px_rgba(15,23,42,0.3)] disabled:opacity-60 disabled:cursor-not-allowed"
                      >
                        <span aria-hidden="true">✨</span>
                        {extractingFromImage ? "Extracting with AI…" : "Extract details with AI"}
                      </button>
                    </div>
              </div>
              )}

              <DialogFooter className="mt-4">
                <Button variant="secondary" onClick={() => setOpen(false)} disabled={saving}>
                  Cancel
                </Button>
                <Button onClick={handleSave} disabled={saving || !title}>
                  {saving ? "Saving..." : "Save Product"}
                </Button>
              </DialogFooter>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
