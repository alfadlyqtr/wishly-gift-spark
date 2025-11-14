import React, { useEffect, useMemo, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
// no tabs in simplified design

export type WishlistOption = {
  id: string;
  name: string;
};

type Props = {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  wishlists: WishlistOption[];
  fixedWishlistId?: string; // if provided, preselect and disable dropdown
  // Edit mode support
  itemId?: string;
  initialWishlistId?: string;
  initialTitle?: string;
  initialBrand?: string;
  initialDescription?: string;
  initialDesire?: number; // 0..5
  initialImageUrl?: string | null;
  onSubmit?: (data: {
    wishlistId: string;
    title: string;
    brand: string;
    description: string;
    desire: number; // 0-100
    imageFile?: File | null;
    imagePreviewUrl?: string | null;
    itemId?: string;
  }) => void | Promise<void>;
  trigger?: React.ReactNode;
};

export default function WishAddDialog({ open, onOpenChange, wishlists, fixedWishlistId, itemId, initialWishlistId, initialTitle, initialBrand, initialDescription, initialDesire, initialImageUrl, onSubmit, trigger }: Props) {
  const [wishlistId, setWishlistId] = useState(() => fixedWishlistId ?? initialWishlistId ?? "");
  const [title, setTitle] = useState("");
  const [brand, setBrand] = useState("");
  const [description, setDescription] = useState("");
  const [desire, setDesire] = useState<number>(3);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (fixedWishlistId) setWishlistId(fixedWishlistId);
  }, [fixedWishlistId]);

  // When opening in edit mode, seed state
  useEffect(() => {
    if (open) {
      if (initialTitle) setTitle(initialTitle);
      if (initialBrand) setBrand(initialBrand);
      if (initialDescription) setDescription(initialDescription);
      if (typeof initialDesire === "number") setDesire(Math.max(0, Math.min(5, initialDesire)));
      if (initialImageUrl) setImageUrl(initialImageUrl);
      if (fixedWishlistId) {
        setWishlistId(fixedWishlistId);
      } else if (initialWishlistId) {
        setWishlistId(initialWishlistId);
      }
    }
  }, [open, initialTitle, initialBrand, initialDescription, initialDesire, initialImageUrl, fixedWishlistId, initialWishlistId]);

  const canSubmit = useMemo(() => !!wishlistId && !!title, [wishlistId, title]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) {
      setImageFile(null);
      setImageUrl(null);
      return;
    }
    setImageFile(file);
    const url = URL.createObjectURL(file);
    setImageUrl(url);
  };

  const handleClearImage = () => {
    setImageFile(null);
    setImageUrl(null);
    if (fileRef.current) fileRef.current.value = "";
  };

  const handleSubmit = async () => {
    if (!canSubmit) return;
    await onSubmit?.({
      wishlistId,
      title,
      brand,
      description,
      desire,
      imageFile,
      imagePreviewUrl: imageUrl ?? null,
      itemId,
    });
    // reset on success
    setTitle("");
    setBrand("");
    setDescription("");
    setDesire(3);
    handleClearImage();
    setWishlistId("");
    onOpenChange?.(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {trigger ? <DialogTrigger asChild>{trigger}</DialogTrigger> : null}
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="sr-only">{itemId ? "Edit Wish" : "Add Wish"}</DialogTitle>
        </DialogHeader>
        <div className="mx-auto w-full max-w-md sm:max-w-2xl rounded-2xl p-[2px] bg-gradient-to-r from-[hsl(var(--brand-cool-start))] via-[hsl(var(--brand-cool-end))] to-[hsl(var(--brand-warm-end))]">
          <div className="rounded-2xl bg-white/90 backdrop-blur p-4 sm:p-6 ring-1 ring-white/70">
            <h3 className="heading text-center font-semibold text-lg text-foreground">{itemId ? "Edit Wish" : "Create Wishlist Item"}</h3>

            <div className="mt-2 space-y-3 max-h-[60vh] overflow-y-auto pr-1">
            <div className="input-div flex flex-col">
              <Label className="mb-1">Wishlist</Label>
              <Select value={wishlistId} onValueChange={setWishlistId}>
                <SelectTrigger disabled={!!fixedWishlistId} className="h-11 text-[15px] px-3 rounded-xl">
                  <SelectValue placeholder="Tap to choose a wishlist" />
                </SelectTrigger>
                <SelectContent>
                  {wishlists.map((w) => (
                    <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {!fixedWishlistId && itemId ? (
                <p className="mt-1 text-xs text-white/85">Select a different wishlist to move this item.</p>
              ) : null}
            </div>

            {/* Upload (animated folder with sliding preview) */}
            <div className="input-div flex flex-col">
              <Label className="mb-1">Upload Image</Label>
              {/* Inline keyframes for float */}
              <style>{`@keyframes folder-float {0%{transform:translateY(0)}50%{transform:translateY(-10px)}100%{transform:translateY(0)}}`}</style>
              <div
                className="group relative w-full rounded-[20px] px-3 sm:px-4 pt-12 sm:pt-16 pb-3 sm:pb-4 mx-auto"
                style={{
                  background: "linear-gradient(135deg, #f162ba, #ed45ae)",
                  minHeight: 120,
                  boxShadow: "0 24px 44px rgba(0,0,0,0.22)",
                  maxWidth: 200,
                  border: "1px solid rgba(255,255,255,0.45)",
                }}
              >
                {/* glossy highlight strip */}
                <div className="pointer-events-none absolute left-3 right-3 top-2 h-2.5 rounded-full" style={{ background: "linear-gradient(180deg, rgba(255,255,255,0.6), rgba(255,255,255,0))" }} />
                {/* Folder */}
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="absolute -top-2 left-1/2 -translate-x-1/2 flex flex-col items-center"
                  style={{ animation: "folder-float 2.5s ease-in-out infinite" }}
                  aria-label="Upload image"
                >
                  <div className="relative overflow-hidden w-[100px] h-[66px] sm:w-[118px] sm:h-[78px]" style={{ filter: "drop-shadow(0 12px 20px rgba(0,0,0,0.28))" }}>
                    {/* tip */}
                    <div className="absolute -top-2 left-4 sm:left-6 h-4 sm:h-5 w-16 sm:w-20 rounded-t-[12px]" style={{ background: "linear-gradient(135deg,#ff9a56,#ff6f56)", boxShadow: "0 6px 16px rgba(0,0,0,0.22)" }} />
                    {/* cover acts as preview mask */}
                    <div className="absolute inset-0 rounded-[14px]" style={{ background: "linear-gradient(135deg,#ffe563,#ffc663)", boxShadow: "0 18px 30px rgba(0,0,0,0.26)" }} />
                    {imageUrl ? (
                      <img src={imageUrl} alt="Preview" className="absolute inset-0 h-full w-full object-cover rounded-[14px]" />
                    ) : null}
                  </div>
                </button>

                {/* Button overlay triggers input */}
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="mt-3 sm:mt-5 w-full rounded-[16px] text-white text-center py-2 sm:py-2.5 px-3 sm:px-4 transition font-semibold tracking-wide text-sm sm:text-base"
                  style={{
                    background: "#ff9ad5",
                    boxShadow: "inset 0 1.5px 0 rgba(255,255,255,0.55), 0 10px 20px rgba(0,0,0,0.12)",
                    border: "1px solid rgba(255,255,255,0.75)",
                  }}
                >
                  Upload a File
                </button>
                <input ref={fileRef} type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
              </div>
              {imageUrl ? (
                <div className="mt-2">
                  <Button type="button" variant="ghost" onClick={handleClearImage}>Clear Image</Button>
                </div>
              ) : null}
            </div>

            {/* Fields */}
            <div className="input-div flex flex-col">
              <Label className="mb-1" htmlFor="title">Item Name</Label>
              <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g., Apple AirPods Pro (2nd gen)" className="h-11 text-[15px] px-3 rounded-xl" />
            </div>
            <div className="input-div flex flex-col">
              <Label className="mb-1" htmlFor="brand">Brand</Label>
              <Input id="brand" value={brand} onChange={(e) => setBrand(e.target.value)} placeholder="e.g., Apple" className="h-11 text-[15px] px-3 rounded-xl" />
            </div>
            <div className="input-div flex flex-col">
              <Label className="mb-1" htmlFor="desc">Description</Label>
              <Textarea id="desc" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Add size, color, or why you want it…" className="min-h-[84px] text-[15px] px-3 rounded-xl" />
            </div>

            {/* Ambivalence slider (0-4) with emojis */}
            <div className="input-div flex flex-col">
              <Label className="mb-2">How badly do you want it?</Label>
              <div className="flex w-full flex-col gap-2">
                {/* Emoji rail */}
                <div className="flex w-full items-center justify-between px-1 text-xl select-none">
                  {(["😐","😌","🙂","😊","😍"] as const).map((e, i) => (
                    <span key={i} className={`transition-all ${desire === i ? "opacity-100 scale-110" : "opacity-70"}`}>{e}</span>
                  ))}
                </div>
                <Slider
                  value={[desire]}
                  max={4}
                  step={1}
                  onValueChange={(v) => setDesire(Math.min(4, Math.max(0, v[0] ?? 0)))}
                  className="w-full"
                />
              </div>
            </div>

            {/* Actions */}
            <div className="button-div flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-3 pt-2">
              <Button type="button" variant="secondary" onClick={() => onOpenChange?.(false)} className="w-full sm:w-auto px-6">Cancel</Button>
              <Button type="button" disabled={!canSubmit} onClick={handleSubmit} className="w-full sm:w-auto px-8 py-2 bg-gradient-to-r from-[hsl(var(--brand-cool-start))] via-[hsl(var(--brand-cool-end))] to-[hsl(var(--brand-warm-end))] text-white rounded-xl">{itemId ? "Update Wish" : "Save to Wishlist"}</Button>
            </div>
          </div>
        </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
