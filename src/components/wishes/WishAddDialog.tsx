import React, { useEffect, useMemo, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
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
  const { t } = useTranslation();
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractedColors, setExtractedColors] = useState<{hex: string; score: number}[]>([]);

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

  const readFileAsBase64 = (file: File) =>
    new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const res = reader.result as string;
        // res format: data:image/png;base64,xxxx
        const base64 = res.includes(",") ? res.split(",")[1] : res;
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

  async function loadTesseract(): Promise<any> {
    if (typeof window === 'undefined') return null;
    const w = window as any;
    if (w.Tesseract) return w.Tesseract;
    await new Promise<void>((resolve, reject) => {
      const s = document.createElement('script');
      s.src = 'https://cdn.jsdelivr.net/npm/tesseract.js@5.0.5/dist/tesseract.min.js';
      s.async = true;
      s.onload = () => resolve();
      s.onerror = () => reject(new Error('Failed to load OCR library'));
      document.head.appendChild(s);
    });
    return (window as any).Tesseract;
  }

  function parseOcrText(text: string) {
    const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    let title = '';
    for (const l of lines) {
      const wc = l.split(/\s+/).length;
      if (wc >= 3 && wc <= 10) { title = l; break; }
    }
    if (!title && lines[0]) title = lines[0];
    const urlMatch = text.match(/https?:[^\s]+/i);
    const brandMatch = text.match(/\b([A-Z][a-zA-Z]{2,})\b/);
    const brand = brandMatch ? brandMatch[1] : '';
    const url = urlMatch ? urlMatch[0] : '';
    return { title, brand, description: text.slice(0, 400), url };
  }

  async function preprocessImageToCanvas(srcUrl: string): Promise<HTMLCanvasElement> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const maxW = 1400;
        const scale = Math.min(1, maxW / img.width);
        canvas.width = Math.floor(img.width * scale);
        canvas.height = Math.floor(img.height * scale);
        const ctx = canvas.getContext('2d');
        if (!ctx) return reject(new Error('Canvas unsupported'));
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const d = imgData.data;
        const contrast = 1.35;
        for (let i = 0; i < d.length; i += 4) {
          const r = d[i], g = d[i+1], b = d[i+2];
          let y = 0.299*r + 0.587*g + 0.114*b;
          y = (y - 128) * contrast + 128;
          const v = Math.max(0, Math.min(255, y));
          d[i] = d[i+1] = d[i+2] = v;
        }
        ctx.putImageData(imgData, 0, 0);
        resolve(canvas);
      };
      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = srcUrl;
    });
  }

  const runOcrFallback = async () => {
    const localeIsAr = typeof navigator !== 'undefined' && navigator.language?.startsWith('ar');
    const Tesseract = await loadTesseract();
    if (!Tesseract || !imageUrl) throw new Error('OCR unavailable');
    // Try both English and Arabic if available
    const canvas = await preprocessImageToCanvas(imageUrl as string).catch(() => null);
    const target = (canvas as any) || (imageUrl as string);
    let result: any = null;
    try {
      // Prefer Arabic first if UI is Arabic
      const primaryLang = localeIsAr ? 'ara' : 'eng';
      const secondaryLang = localeIsAr ? 'eng' : 'ara';
      try {
        result = await Tesseract.recognize(target, `${primaryLang}+${secondaryLang}`);
      } catch {
        result = await Tesseract.recognize(target, primaryLang);
      }
    } catch {
      result = await Tesseract.recognize(target, 'eng');
    }
    const rawText = result?.data?.text || result?.text || '';
    const { title: tTitle, brand: tBrand, description: tDesc, url: tUrl } = parseOcrText(rawText);
    let updated = false;
    if (tTitle && !title) { setTitle(tTitle); updated = true; }
    if (tBrand && !brand) { setBrand(tBrand); updated = true; }
    if (tDesc && !description) { setDescription(tDesc); updated = true; }
    if (tUrl) { setDescription((prev) => prev ? `${prev}\n${tUrl}` : tUrl); updated = true; }
    // Post-process with Deepseek to clean/structure OCR text
    try {
      const { data: session } = await supabase.auth.getSession();
      const token = session.session?.access_token;
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-gateway`;
      const sys = localeIsAr
        ? 'أنت مساعد Wishly. لخص النص التالي إلى JSON بالمفاتيح: title, brand, description, url. لا تُدخل أسعارًا. إذا كان النص رديئًا فأعد فقط ما تستطيع.'
        : 'You are Wishly. Summarize the following OCR text into strict JSON keys: title, brand, description, url. No prices. If poor text, return what you can.';
      const body = { model: 'deepseek-chat', messages: [
        { role: 'system', content: sys },
        { role: 'user', content: `OCR TEXT:\n${rawText}` },
      ], temperature: 0.2, max_tokens: 300 } as const;
      const resp = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify(body) });
      if (resp.ok) {
        let out: any = null;
        try { out = await resp.json(); } catch { const txt = await resp.text(); const m = txt.match(/\{[\s\S]*\}/); if (m) out = JSON.parse(m[0]); }
        if (out && typeof out === 'object') {
          let improved = false;
          if (out.title && (!title || out.title.length > title.length)) { setTitle(out.title); improved = true; }
          if (out.brand && (!brand || out.brand.length > brand.length)) { setBrand(out.brand); improved = true; }
          if (out.description && (!description || out.description.length > description.length)) { setDescription(out.description); improved = true; }
          if (out.url) { setDescription((prev) => prev ? `${prev}\n${out.url}` : out.url); improved = true; }
          updated = updated || improved;
        }
      }
    } catch {}
    if (updated) toast.success(t('wish_item.extract_done', 'Extracted details from image'));
    else toast.warning?.(localeIsAr ? 'لم نتمكن من استخراج نص واضح من الصورة.' : 'Couldn’t extract clear text from the image.');
    return updated;
  };

  const handleExtractFromImage = async () => {
    try {
      if (!imageFile) {
        toast.error(t("wish_item.extract_no_image", "Please upload an image first"));
        return;
      }
      setIsExtracting(true);
      const base64 = await readFileAsBase64(imageFile);
      const { data: session } = await supabase.auth.getSession();
      const token = session.session?.access_token;
      const baseUrl = import.meta.env.VITE_SUPABASE_URL as string;
      const url = `${baseUrl}/functions/v1/ai-gateway`;
      const locale = typeof navigator !== "undefined" && navigator.language?.startsWith("ar") ? "ar" : "en";
      // A) Google Vision Edge Function first (if configured on project)
      try {
        const visionFn = `${baseUrl}/functions/v1/extract-from-image`;
        const vres = await fetch(visionFn, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : { Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY as string}` }),
          },
          body: JSON.stringify({ image_base64: base64, locale }),
        });
        if (vres.ok) {
          const vjson = await vres.json();
          console.log('[Vision] Full response:', vjson);
          const s = vjson?.structured || vjson;
          const logos = vjson?.logos || [];
          const labels = vjson?.labels || [];
          const colors = vjson?.colors || [];
          console.log('[Vision] Structured:', s, 'Logos:', logos, 'Labels:', labels, 'Colors:', colors);
          setExtractedColors(colors.slice(0, 5)); // Store top 5 colors
          let applied = false;
          if (s?.title) { setTitle(s.title); applied = true; }
          if (s?.brand) { setBrand(s.brand); applied = true; }
          if (s?.description) { setDescription(s.description); applied = true; }
          if (s?.url) { setDescription((prev) => prev ? `${prev}\n${s.url}` : s.url); applied = true; }
          if (applied) {
            toast.success(t('wish_item.extract_done', 'Extracted details from image'));
            return;
          } else {
            toast.message?.('Vision Debug', { description: `Logos: ${logos.join(', ') || 'none'} | Labels: ${labels.slice(0,3).join(', ') || 'none'}` });
          }
        } else {
          const errText = await vres.text().catch(() => '');
          toast.message?.('Vision', { description: `Vision ${vres.status}: ${errText.slice(0, 140)}` });
        }
      } catch {}
      const systemPrompt = locale === 'ar'
        ? "أنت مساعد Wishly. أعد فقط JSON بالمفاتيح: title, brand, description, url. لا تُدخل أسعارًا. إذا تعذر عليك فهم الصورة فأعد فقط {} دون نص إضافي."
        : "You are Wishly. Return ONLY strict JSON with keys: title, brand, description, url. No prices. If you cannot parse the image, return just {} with no extra text.";
      const dataUrl = `data:${imageFile.type || 'image/png'};base64,${base64}`;
      const body = {
        model: "deepseek-chat",
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content:
              locale === 'ar'
                ? `هذه صورة منتج (مشفرة كـ data URL). استخرج title و brand و description ورابط إن وجد من الصورة. data_url:\n${dataUrl}`
                : `This is a product image (encoded as a data URL). Extract a concise title, brand, description, and a link if present from any visible text. data_url:\n${dataUrl}`,
          },
        ],
        temperature: 0.2,
        max_tokens: 400,
      } as const;

      // 0) Optional: If Deepseek Vision model configured, try vision with image_url first
      const visionModel = (import.meta as any).env?.VITE_DEEPSEEK_VISION_MODEL as string | undefined;
      if (visionModel) {
        try {
          // upload image to storage (public) for URL reference
          const filename = `extract/${Date.now()}_${imageFile.name}`;
          const upload = await supabase.storage.from('public').upload(filename, imageFile, { upsert: true });
          if (!upload.error) {
            const { data: { publicUrl } } = supabase.storage.from('public').getPublicUrl(filename);
            const visionBody = {
              model: visionModel,
              messages: [
                { role: 'system', content: locale === 'ar' ? 'أعد فقط JSON: title, brand, description, url. بدون أسعار.' : 'Return ONLY JSON: title, brand, description, url. No prices.' },
                {
                  role: 'user',
                  content: [
                    { type: 'text', text: locale === 'ar' ? 'استخرج الحقول من الصورة' : 'Extract fields from this product image' },
                    { type: 'image_url', image_url: { url: publicUrl } },
                  ],
                },
              ],
              temperature: 0.2,
              max_tokens: 400,
            } as const;
            const vres = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify(visionBody) });
            if (vres.ok) {
              let jout: any = null;
              try { jout = await vres.json(); } catch { const txt = await vres.text(); const m = txt.match(/\{[\s\S]*\}/); if (m) jout = JSON.parse(m[0]); }
              if (jout && typeof jout === 'object') {
                let applied = false;
                if (jout.title) { setTitle(jout.title); applied = true; }
                if (jout.brand) { setBrand(jout.brand); applied = true; }
                if (jout.description) { setDescription(jout.description); applied = true; }
                if (jout.url) { setDescription((prev) => prev ? `${prev}\n${jout.url}` : jout.url); applied = true; }
                if (applied) {
                  toast.success(t('wish_item.extract_done', 'Extracted details from image'));
                  return; // stop here if vision worked
                }
              }
            }
          }
        } catch {}
      }

      const resp = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(body),
      });
      if (!resp.ok) {
        const text = await resp.text();
        throw new Error(text || `Gateway error ${resp.status}`);
      }
      // Response might be JSON or streamed text. Try JSON first.
      let out: any = null;
      try {
        const j = await resp.json();
        if (j && typeof j === 'object') out = j;
      } catch {
        const text = await resp.text();
        const match = text.match(/\{[\s\S]*\}/);
        if (match) {
          try { out = JSON.parse(match[0]); } catch {}
        }
      }
      if (!out || typeof out !== 'object') {
        throw new Error(locale === 'ar' ? 'تعذر استخراج البيانات من الاستجابة' : 'Could not extract data from AI response');
      }
      // Expecting { title?: string, brand?: string, description?: string, url?: string }
      let updated = false;
      if (out?.title) { setTitle(out.title); updated = true; }
      if (out?.brand) { setBrand(out.brand); updated = true; }
      if (out?.description) { setDescription(out.description); updated = true; }
      if (out?.url) {
        setDescription((prev) => prev ? `${prev}\n${out.url}` : out.url);
        updated = true;
      }
      if (updated) {
        toast.success(t("wish_item.extract_done", "Extracted details from image"));
      } else {
        // If nothing useful returned, attempt OCR fallback automatically
        await runOcrFallback();
      }
    } catch (e: any) {
      const msg = e?.message || (typeof e === 'string' ? e : '') || 'Failed to extract from image';
      // Normalize DeepSeek 400 into friendly text
      if (/DeepSeek API error|Gateway error|400/.test(msg)) {
        // Try client-side OCR fallback
        try {
          await runOcrFallback();
        } catch (ocrErr: any) {
          const friendly = typeof navigator !== 'undefined' && navigator.language?.startsWith('ar')
            ? 'تعذر استخراج النص من الصورة الآن.'
            : 'Could not extract text from the image.';
          toast.error(friendly);
        }
      } else {
        toast.error(msg);
      }
    } finally {
      setIsExtracting(false);
    }
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
          <DialogTitle className="sr-only">{itemId ? t("wish_item.edit_hidden", "Edit Wish") : t("wish_item.add_hidden", "Add Wish")}</DialogTitle>
        </DialogHeader>
        <div className="mx-auto w-full max-w-md sm:max-w-2xl rounded-2xl p-[2px] bg-gradient-to-r from-[hsl(var(--brand-cool-start))] via-[hsl(var(--brand-cool-end))] to-[hsl(var(--brand-warm-end))]">
          <div className="rounded-2xl bg-white/90 backdrop-blur p-4 sm:p-6 ring-1 ring-white/70">
            <h3 className="heading text-center font-semibold text-lg text-foreground">{itemId ? t("wish_item.edit_title", "Edit Wishlist Item") : t("wish_item.create_title", "Create Wishlist Item")}</h3>

            <div className="mt-2 space-y-3 max-h-[60vh] overflow-y-auto pr-1">
            <div className="input-div flex flex-col">
              <Label className="mb-1">{t("wish_item.wishlist_label", "Wishlist")}</Label>
              <Select value={wishlistId} onValueChange={setWishlistId}>
                <SelectTrigger disabled={!!fixedWishlistId} className="h-11 text-[15px] px-3 rounded-xl">
                  <SelectValue placeholder={t("wish_item.wishlist_placeholder", "Tap to choose a wishlist")} />
                </SelectTrigger>
                <SelectContent>
                  {wishlists.map((w) => (
                    <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {!fixedWishlistId && itemId ? (
                <p className="mt-1 text-xs text-white/85">{t("wish_item.wishlist_move_hint", "Select a different wishlist to move this item.")}</p>
              ) : null}
            </div>

            {/* Upload (animated folder with sliding preview) */}
            <div className="input-div flex flex-col">
              <Label className="mb-1">{t("wish_item.upload_label", "Upload Image")}</Label>
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
                  aria-label={t("wish_item.upload_aria", "Upload image")}
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
                  {t("wish_item.upload_button", "Upload a File")}
                </button>
                <input ref={fileRef} type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
              </div>
              {imageUrl ? (
                <div className="mt-2">
                  <Button type="button" variant="ghost" onClick={handleClearImage}>{t("wish_item.clear_image", "Clear Image")}</Button>
                  <Button type="button" className="ml-2" onClick={handleExtractFromImage} disabled={isExtracting}>
                    {isExtracting ? t("wish_item.extracting", "Extracting...") : t("wish_item.extract_ai_button", "Extract details with AI")}
                  </Button>
                </div>
              ) : null}
            </div>

            {/* Fields */}
            <div className="input-div flex flex-col">
              <Label className="mb-1" htmlFor="title">{t("wish_item.item_name_label", "Item Name")}</Label>
              <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t("wish_item.item_name_placeholder", "e.g., Apple AirPods Pro (2nd gen)")} className="h-11 text-[15px] px-3 rounded-xl" />
            </div>
            <div className="input-div flex flex-col">
              <Label className="mb-1" htmlFor="brand">{t("wish_item.brand_label", "Brand")}</Label>
              <Input id="brand" value={brand} onChange={(e) => setBrand(e.target.value)} placeholder={t("wish_item.brand_placeholder", "e.g., Apple")} className="h-11 text-[15px] px-3 rounded-xl" />
            </div>
            <div className="input-div flex flex-col">
              <Label className="mb-1" htmlFor="desc">{t("wish_item.description_label", "Description")}</Label>
              <Textarea id="desc" value={description} onChange={(e) => setDescription(e.target.value)} placeholder={t("wish_item.description_placeholder", "Add size, color, or why you want it…")} className="min-h-[84px] text-[15px] px-3 rounded-xl" />
            </div>

            {/* Ambivalence slider (0-4) with emojis */}
            <div className="input-div flex flex-col">
              <Label className="mb-2">{t("wish_item.desire_label", "How badly do you want it?")}</Label>
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
              <Button type="button" variant="secondary" onClick={() => onOpenChange?.(false)} className="w-full sm:w-auto px-6">{t("common.cancel", "Cancel")}</Button>
              <Button type="button" disabled={!canSubmit} onClick={handleSubmit} className="w-full sm:w-auto px-8 py-2 bg-gradient-to-r from-[hsl(var(--brand-cool-start))] via-[hsl(var(--brand-cool-end))] to-[hsl(var(--brand-warm-end))] text-white rounded-xl">{itemId ? t("wish_item.update_button", "Update Wish") : t("wish_item.save_button", "Save to Wishlist")}</Button>
            </div>
          </div>
        </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
