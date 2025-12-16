import React, { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useWishlists } from "@/hooks/use-wishlists";

/**
 * AddWishModal
 * - Dialog-based modal triggered by the Plus button in MainLayout
 * - Two tabs:
 *   1) Link/Text: paste URL or type description. Submitting a URL calls the Edge Function (ai-gateway) to parse content.
 *   2) Photo Upload: placeholder for file input (future: integrate Supabase Storage)
 * - Final Save: inserts a row into `wishlist_items` with the finalized fields
 *
 * Props:
 * - wishlistId (optional): If provided, used for saving. If not provided, a minimal Wishlist ID input is shown.
 * - children: Trigger element (the Plus button) via DialogTrigger asChild
 */
export type AddWishModalProps = React.PropsWithChildren<{
  wishlistId?: string;
}>;

export const AddWishModal: React.FC<AddWishModalProps> = ({ children, wishlistId }) => {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

  // Tab state and inputs
  const [activeTab, setActiveTab] = useState<"link" | "photo">("link");
  const [url, setUrl] = useState("");
  const [manualText, setManualText] = useState("");
  const [localWishlistId, setLocalWishlistId] = useState("");

  // AI scraping result / editable fields
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [itemUrl, setItemUrl] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [price, setPrice] = useState<string>("");

  const [loadingScrape, setLoadingScrape] = useState(false);
  const [saving, setSaving] = useState(false);

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

  // Fetch user's wishlists for dropdown
  const { data: wishlistsData, refetch: refetchWishlists } = useWishlists();

  // Ensure dropdown always shows the latest lists when modal opens
  useEffect(() => {
    if (open) {
      refetchWishlists();
    }
  }, [open, refetchWishlists]);

  const edgeFunctionUrl = useMemo(() => {
    if (!supabaseUrl) return "";
    return `${supabaseUrl}/functions/v1/ai-gateway`;
  }, [supabaseUrl]);

  const handleScrape = async () => {
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
      // Expected shape (scaffold): { title, description, image_url, price, item_url }
      setTitle(data.title ?? title);
      setDescription(data.description ?? description);
      setImageUrl(data.image_url ?? imageUrl);
      setItemUrl(data.item_url ?? url);
      if (data.price != null) setPrice(String(data.price));
      toast.success(t("success.item_details_fetched", "Item details fetched"));
    } catch (e: any) {
      toast.error(e?.message || t("errors.failed_fetch_details", "Failed to fetch details"));
    } finally {
      setLoadingScrape(false);
    }
  };

  const handleSave = async () => {
    const finalWishlistId = wishlistId || localWishlistId;
    if (!finalWishlistId) {
      toast.error(t("wish_item.wishlist_placeholder", "Please choose a wishlist"));
      return;
    }
    if (!title) {
      toast.error(t("wishlist_detail.title_required", "Title is required"));
      return;
    }

    try {
      setSaving(true);
      const priceNumber = price ? Number(price) : null;
      const { error } = await supabase.from("wishlist_items").insert([
        {
          title,
          description: description || manualText || null,
          item_url: itemUrl || url || null,
          image_url: imageUrl || null,
          price: priceNumber,
          wishlist_id: finalWishlistId,
          status: null,
          added_at: new Date().toISOString(),
        },
      ]);

      if (error) {
        toast.error(error.message);
        return;
      }

      toast.success(t("success.wish_saved", "Wish saved"));
      // Reset fields on success
      setUrl("");
      setManualText("");
      setTitle("");
      setDescription("");
      setItemUrl("");
      setImageUrl("");
      setPrice("");
      setLocalWishlistId("");
      setOpen(false);
    } catch (e: any) {
      toast.error(e?.message || t("errors.failed_save_wish", "Failed to save wish"));
    } finally {
      setSaving(false);
    }
  };

  const simpleMode = Boolean(wishlistId);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle>{t('wish_item.add_wish_title', 'Add Wish')}</DialogTitle>
              <DialogDescription>{t('wish_item.add_wish_desc', 'Paste a link, type a description, or upload a photo.')}</DialogDescription>
            </div>
            <DialogClose asChild>
              <button aria-label="Close" className="rounded-md px-2 py-1 text-sm hover:bg-muted">✕</button>
            </DialogClose>
          </div>
        </DialogHeader>

        <div className="space-y-6">
          {/* Optional wishlist selector if not in simple mode */}
          {!simpleMode && (
            <div className="space-y-2">
              <Label htmlFor="wishlist">{t('wish_item.wishlist_label', 'Wishlist')}</Label>
              <Select value={localWishlistId} onValueChange={setLocalWishlistId}>
                <SelectTrigger id="wishlist">
                  <SelectValue placeholder={t('wish_item.wishlist_placeholder', 'Choose a wishlist')} />
                </SelectTrigger>
                <SelectContent>
                  {(wishlistsData?.length ?? 0) === 0 ? (
                    <SelectItem value="" disabled>{t('wish_item.no_wishlists', 'No wishlists found')}</SelectItem>
                  ) : (
                    (wishlistsData ?? []).map((w) => (
                      <SelectItem key={w.id} value={w.id}>
                        {w.title || w.id}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
          )}

          {simpleMode ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="title">{t('common.title', 'Title')}</Label>
                <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="price">{t('wish_item.price_optional', 'Price (optional)')}</Label>
                <Input id="price" type="number" min="0" step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="image_url">{t('wish_item.image_url_optional', 'Image URL (optional)')}</Label>
                <Input id="image_url" value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="description">{t('wish_item.description_optional', 'Description (optional)')}</Label>
                <Textarea id="description" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
              </div>
            </div>
          ) : (
            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
              <TabsList>
                <TabsTrigger value="link">{t('wish_item.tab_url_text', 'URL / Text')}</TabsTrigger>
                <TabsTrigger value="photo">{t('wish_item.tab_photo', 'Photo Upload')}</TabsTrigger>
              </TabsList>
              <TabsContent value="link" className="space-y-4 pt-4">
                <div className="space-y-2">
                  <Label htmlFor="url">{t('wish_item.paste_url', 'Paste URL')}</Label>
                  <div className="flex gap-2">
                    <Input
                      id="url"
                      placeholder="https://example.com/product"
                      value={url}
                      onChange={(e) => setUrl(e.target.value)}
                    />
                    <Button type="button" onClick={handleScrape} disabled={loadingScrape || !url}>
                      {loadingScrape ? t('wish_item.scraping', 'Scraping...') : t('wish_item.fetch', 'Fetch')}
                    </Button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="manual">{t('wish_item.describe_item', 'Or describe the item')}</Label>
                  <Textarea
                    id="manual"
                    placeholder="e.g., Red running shoes, size 42, Nike..."
                    value={manualText}
                    onChange={(e) => setManualText(e.target.value)}
                    rows={3}
                  />
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="title">{t('common.title', 'Title')}</Label>
                    <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="price">{t('wish_item.price', 'Price')}</Label>
                    <Input id="price" type="number" min="0" step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} />
                  </div>
                  <div className="space-y-2 sm:col-span-2">
                    <Label htmlFor="description">{t('common.description', 'Description')}</Label>
                    <Textarea id="description" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="item_url">{t('wish_item.item_url', 'Item URL')}</Label>
                    <Input id="item_url" value={itemUrl} onChange={(e) => setItemUrl(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="image_url">{t('wish_item.image_url', 'Image URL')}</Label>
                    <Input id="image_url" value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} />
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="photo" className="space-y-4 pt-4">
                <div className="rounded-md border p-4 text-sm text-muted-foreground">
                  <p className="mb-2 font-medium text-foreground">{t('wish_item.photo_placeholder_title', 'Photo Upload (placeholder)')}</p>
                  <p>
                    This is a placeholder for integrating Supabase Storage. Provide a file input, upload to Storage,
                    then set <code>image_url</code> to the public URL.
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="image_url_photo">{t('wish_item.image_url', 'Image URL')}</Label>
                  <Input id="image_url_photo" value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} />
                </div>
              </TabsContent>
            </Tabs>
          )}
        </div>

        <DialogFooter>
          <Button variant="secondary" onClick={() => setOpen(false)} disabled={saving}>
            {t('common.cancel', 'Cancel')}
          </Button>
          <Button onClick={handleSave} disabled={saving || !title}>
            {saving ? t('common.saving', 'Saving...') : t('wish_item.save_to_wishlist', 'Save to Wishlist')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default AddWishModal;
