import React, { useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";

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
  const [uploadError, setUploadError] = useState<string | null>(null);

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  const supabaseAnonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;

  const edgeFunctionUrl = useMemo(() => {
    if (!supabaseUrl) return "";
    return `${supabaseUrl}/functions/v1/ai-gateway`;
  }, [supabaseUrl]);

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

      setImageUrl(publicUrlData.publicUrl);
      toast.success("Image uploaded");
      setActiveTab("link");
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
      toast.error("Please paste a URL first.");
      return;
    }
    if (!edgeFunctionUrl || !supabaseAnonKey) {
      toast.error("AI gateway is not configured.");
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
      
      toast.success("Product details fetched");
    } catch (e: any) {
      toast.error(e?.message || "Failed to fetch product details");
    } finally {
      setLoadingScrape(false);
    }
  };

  const handleSave = async () => {
    if (!title) {
      toast.error("Product name is required");
      return;
    }

    try {
      setSaving(true);
      
      // Get brand ID
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error("Not authenticated");
        return;
      }

      const { data: brandData } = await (supabase as any)
        .from("brands")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (!brandData) {
        toast.error("Brand not found");
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
      
      toast.success("Product added successfully");
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
      <DialogContent className="w-[92vw] max-w-xl rounded-2xl border border-white/70 bg-white/95 shadow-[0_18px_45px_rgba(15,23,42,0.28)]">
        <DialogHeader>
          <DialogTitle>Add Product</DialogTitle>
          <DialogDescription>Paste a link, type a description, or upload a photo.</DialogDescription>
        </DialogHeader>
        <div className="mt-2 space-y-4">
          <div className="rounded-2xl border border-slate-100 bg-slate-50/80 px-3 py-3 sm:px-4 sm:py-4 shadow-sm">
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
            <TabsList className="inline-flex rounded-full bg-muted px-1 py-0.5 text-xs font-medium">
              <TabsTrigger
                value="link"
                className="rounded-full px-3 py-1 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm data-[state=inactive]:text-muted-foreground"
              >
                URL / Text
              </TabsTrigger>
              <TabsTrigger
                value="photo"
                className="rounded-full px-3 py-1 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm data-[state=inactive]:text-muted-foreground"
              >
                Photo Upload
              </TabsTrigger>
            </TabsList>

            <TabsContent value="link" className="flex flex-col gap-4 mt-4 min-h-[420px]">
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
            </TabsContent>

            <TabsContent value="photo" className="space-y-4 pt-4 min-h-[420px] flex flex-col">
              <div className="space-y-2">
                <Label htmlFor="photo_file">Upload image file</Label>
                <Input
                  id="photo_file"
                  type="file"
                  accept="image/*"
                  onChange={(e) => handlePhotoUpload(e.target.files?.[0] || null)}
                  disabled={uploadingImage}
                />
                <p className="text-xs text-muted-foreground">
                  We will upload this image to your brand storage and fill the Image URL field automatically.
                </p>
                {uploadError && (
                  <p className="text-xs text-red-500">{uploadError}</p>
                )}
              </div>
            </TabsContent>
          </Tabs>
          </div>

        </div>

        <DialogFooter className="mt-4">
          <Button variant="secondary" onClick={() => setOpen(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving || !title}>
            {saving ? "Saving..." : "Save Product"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
