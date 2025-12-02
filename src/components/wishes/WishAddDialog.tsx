import React, { useEffect, useMemo, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { ChevronDown, Link as LinkIcon, ArrowDownToLine, Loader2 } from "lucide-react";
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
  initialUrl?: string;
  onSubmit?: (data: {
    wishlistId: string;
    title: string;
    brand: string;
    description: string;
    desire: number; // 0-100
    imageFile?: File | null;
    imagePreviewUrl?: string | null;
    itemId?: string;
    url?: string;
  }) => void | Promise<void>;
  trigger?: React.ReactNode;
};

export default function WishAddDialog({ open, onOpenChange, wishlists, fixedWishlistId, itemId, initialWishlistId, initialTitle, initialBrand, initialDescription, initialDesire, initialImageUrl, initialUrl, onSubmit, trigger }: Props) {
  const [wishlistId, setWishlistId] = useState(() => fixedWishlistId ?? initialWishlistId ?? "");
  const [title, setTitle] = useState("");
  const [brand, setBrand] = useState("");
  const [description, setDescription] = useState("");
  const [desire, setDesire] = useState<number>(3);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [itemUrl, setItemUrl] = useState("");
  const [urlInput, setUrlInput] = useState("");
  const [isFetchingUrl, setIsFetchingUrl] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const { t, i18n } = useTranslation();
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractedColors, setExtractedColors] = useState<{hex: string; score: number}[]>([]);
  const [stylePreset, setStylePreset] = useState<"Auto" | "Professional" | "Natural" | "GenZ">(() => (typeof window !== 'undefined' && (localStorage.getItem('wish_style_preset') as any)) || 'Auto');

  useEffect(() => {
    if (fixedWishlistId) setWishlistId(fixedWishlistId);
  }, [fixedWishlistId]);

  useEffect(() => {
    if (typeof window !== 'undefined') localStorage.setItem('wish_style_preset', stylePreset);
  }, [stylePreset]);

  // When opening in edit mode, seed state
  useEffect(() => {
    if (open) {
      if (initialTitle) setTitle(initialTitle);
      if (initialBrand) setBrand(initialBrand);
      if (initialDescription) setDescription(initialDescription);
      if (typeof initialDesire === "number") setDesire(Math.max(0, Math.min(5, initialDesire)));
      if (initialImageUrl) setImageUrl(initialImageUrl);
      if (initialUrl) {
        setItemUrl(initialUrl);
        setUrlInput(initialUrl);
      }
      if (fixedWishlistId) {
        setWishlistId(fixedWishlistId);
      } else if (initialWishlistId) {
        setWishlistId(initialWishlistId);
      }
    }
  }, [open, initialTitle, initialBrand, initialDescription, initialDesire, initialImageUrl, initialUrl, fixedWishlistId, initialWishlistId]);

  const canSubmit = useMemo(() => !!wishlistId && !!title, [wishlistId, title]);

  const DESC_MAX = 200;

  const refineDescription = (
    brand: string,
    description: string,
    maxLen = DESC_MAX,
    tone?: 'neutral' | 'chill' | 'interested' | 'excited' | 'obsessed',
    stylePreset?: 'Auto' | 'Professional' | 'Natural' | 'GenZ',
    locale?: 'en' | 'ar'
  ) => {
    if (!description) return description;
    let text = description.trim();
    if (brand) {
      const esc = brand.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const lower = text.toLowerCase();
      const idx = lower.indexOf(brand.toLowerCase());
      if (idx !== -1) {
        const head = text.slice(0, idx + brand.length);
        const tail = text
          .slice(idx + brand.length)
          .replace(new RegExp(esc, 'gi'), '')
          .replace(/\s{2,}/g, ' ')
          .trim();
        text = (head + ' ' + tail).replace(/\s{2,}/g, ' ').trim();
      } else {
        text = text.replace(new RegExp(`\\b${esc}\\b`, 'gi'), '').replace(/\s{2,}/g, ' ').trim();
      }
    }
    // Apply tone/style adjustments (light-touch, post-Gemini)
    const isAr = locale === 'ar';
    const style = (stylePreset || 'Auto');
    const toneVal = tone || 'interested';

    // Normalize excessive exclamations
    text = text.replace(/!{2,}/g, '!');

    // Tone injection when missing first-person (except neutral)
    const hasFirstPerson = /\b(I\b|I'm\b|I am\b|أحب|أريده|يعجبني)/i.test(text);
    const inject = (phraseEn: string, phraseAr: string) => (isAr ? phraseAr : phraseEn);
    if (!hasFirstPerson && toneVal !== 'neutral') {
      if (toneVal === 'interested') text = `${inject('I like ', 'يعجبني ')}${text}`;
      else if (toneVal === 'excited') text = `${inject('I love ', 'أحب ')}${text}`;
      else if (toneVal === 'obsessed') text = `${inject('I really want this – ', 'أريده بشدة – ')}${text}`;
    }

    // Professional style: no slang, no emoji, no exclamations, minimize first-person
    if (style === 'Professional') {
      text = text
        .replace(/[\p{Emoji_Presentation}\p{Extended_Pictographic}]/gu, '')
        .replace(/!/g, '')
        .replace(/\bI\s+(really\s+)?(want|love|like)\b/gi, (m) => m.replace(/\bI\s+/i, ''))
        .replace(/\bI'm\b/gi, 'I am');
    }

    // Gen Z: allow one emoji max; add a light emoji if none
    if (style === 'GenZ') {
      const hasEmoji = /[\p{Emoji_Presentation}\p{Extended_Pictographic}]/gu.test(text);
      if (!hasEmoji) {
        const emoji = toneVal === 'obsessed' ? '😍' : toneVal === 'excited' ? '✨' : '🙂';
        text = `${text} ${emoji}`.trim();
      }
    }

    // Neutral tone: avoid first-person/exclamations
    if (toneVal === 'neutral') {
      text = text.replace(/!/g, '').replace(/\bI\b[^.]{0,30}/gi, (m) => m.replace(/\bI\b/i, '').trim());
    }

    // Keep at most two sentences
    const sentences = text.split(/(?<=[.!?])\s+/);
    if (sentences.length > 2) text = `${sentences[0]} ${sentences[1]}`.trim();
    // Respect max length without cutting mid-sentence
    if (text.length > maxLen) {
      const before = text.slice(0, maxLen);
      const lastEnd = Math.max(before.lastIndexOf('.'), before.lastIndexOf('!'), before.lastIndexOf('?'));
      if (lastEnd >= 60) {
        text = before.slice(0, lastEnd + 1).trim();
      } else {
        const lastComma = before.lastIndexOf(',');
        const lastSpace = before.lastIndexOf(' ');
        const pos = Math.max(lastComma, lastSpace);
        text = before.slice(0, pos > 0 ? pos : maxLen).trim();
        if (!/[.!?]$/.test(text)) text += '.';
      }
    }
    return text;
  };

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
    if (tDesc && !description) {
      const tone2 = ["neutral","chill","interested","excited","obsessed"][Math.min(4, Math.max(0, desire))] as any;
      const loc2 = (typeof window !== 'undefined' && (i18n?.language || navigator.language))?.startsWith('ar') ? 'ar' : 'en';
      setDescription(refineDescription(tBrand, tDesc, DESC_MAX, tone2, stylePreset, loc2));
      updated = true;
    }
    if (tUrl) { setDescription((prev) => prev ? `${prev}\n${tUrl}` : tUrl); updated = true; }
    // Note: removed ai-gateway/Deepseek post-processing; keep pure OCR fallback only
    if (updated) toast.success(t('wish_item.extract_done', 'Extracted details from image'));
    else toast.warning?.(localeIsAr ? 'لم نتمكن من استخراج نص واضح من الصورة.' : 'Couldn’t extract clear text from the image.');
    return updated;
  };

  const handleFetchUrl = async () => {
    if (!urlInput) return;
    
    // Basic URL validation
    let targetUrl = urlInput.trim();
    if (!targetUrl.startsWith('http')) {
      targetUrl = `https://${targetUrl}`;
    }
    
    try {
      setIsFetchingUrl(true);
      
      // Use VITE_SUPABASE_PUBLISHABLE_KEY or fallback to hardcoded values from client.ts
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "https://oefwopmeejfhzwojczqq.supabase.co";
      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9lZndvcG1lZWpmaHp3b2pjenFxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjIyNDAyMDIsImV4cCI6MjA3NzgxNjIwMn0._r6kM1tzRcpBIuGW0m-lZWFecbZT4d1rHJVO3EzVueQ";
      const edgeFunctionUrl = `${supabaseUrl}/functions/v1/ai-gateway`;

      // Using direct fetch like in AddProductModal to ensure compatibility
      const res = await fetch(edgeFunctionUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${supabaseAnonKey}`,
        },
        body: JSON.stringify({ url: targetUrl }),
      });

      if (!res.ok) {
        const text = await res.text();
        console.error('Gateway error response:', text);
        throw new Error(text || `Gateway request failed (${res.status})`);
      }

      const data = await res.json();

      let updated = false;
      // Map ai-gateway response fields: { title, description, image_url, item_url, price? }
      if (data.title) { setTitle(data.title); updated = true; }
      
      // Smart brand extraction
      let extractedBrand = '';
      if (data.brand) {
        extractedBrand = data.brand;
      } else if (data.title) {
        // Try to extract brand from title using common brand patterns
        const commonBrands = [
          'Apple', 'Samsung', 'Xiaomi', 'Huawei', 'OnePlus', 'Google', 'Sony', 'LG', 'Nokia',
          'Nike', 'Adidas', 'Puma', 'Reebok', 'Under Armour',
          'Zara', 'H&M', 'Gucci', 'Prada', 'Louis Vuitton', 'Chanel',
          'IKEA', 'Amazon', 'Microsoft', 'Dell', 'HP', 'Lenovo', 'Asus', 'Acer',
          'Canon', 'Nikon', 'Fujifilm', 'GoPro', 'DJI',
          'Lego', 'Mattel', 'Hasbro', 'Nintendo', 'PlayStation', 'Xbox'
        ];
        
        const titleLower = data.title.toLowerCase();
        for (const brand of commonBrands) {
          if (titleLower.includes(brand.toLowerCase())) {
            extractedBrand = brand;
            break;
          }
        }
        
        // If still no brand, try first word of title (often the brand)
        if (!extractedBrand) {
          const firstWord = data.title.split(/[\s-]/)[0];
          if (firstWord && firstWord.length > 2) {
            extractedBrand = firstWord.charAt(0).toUpperCase() + firstWord.slice(1);
          }
        }
      }
      
      // Last resort: extract from domain
      if (!extractedBrand) {
        try {
          const urlObj = new URL(targetUrl);
          const hostname = urlObj.hostname.replace('www.', '');
          const domainParts = hostname.split('.');
          // Skip common marketplace names
          const skipDomains = ['amazon', 'ebay', 'walmart', 'target', 'lulu', 'noon', 'souq'];
          const domainName = domainParts[0];
          if (!skipDomains.includes(domainName.toLowerCase())) {
            extractedBrand = domainName.charAt(0).toUpperCase() + domainName.slice(1);
          }
        } catch(e) { /* ignore */ }
      }
      
      if (extractedBrand) {
        setBrand(extractedBrand);
        updated = true;
      }

      if (data.description) { 
        setDescription(refineDescription(brand, data.description, DESC_MAX)); 
        updated = true; 
      }
      
      // Download and re-upload image to Supabase Storage to avoid CORS issues
      if (data.image_url) {
        try {
          // Fetch the image as a blob
          const imageResponse = await fetch(data.image_url);
          if (imageResponse.ok) {
            const blob = await imageResponse.blob();
            
            // Convert blob to File
            const fileExt = data.image_url.split('.').pop()?.split('?')[0] || 'jpg';
            const fileName = `fetched-${Date.now()}.${fileExt}`;
            const file = new File([blob], fileName, { type: blob.type });
            
            // Set as imageFile so it gets uploaded when saving
            setImageFile(file);
            setImageUrl(URL.createObjectURL(blob));
            updated = true;
          } else {
            // Fallback: just set the URL (might not work due to CORS)
            setImageUrl(data.image_url);
            updated = true;
          }
        } catch (imgErr) {
          console.warn('Failed to download image, using direct URL:', imgErr);
          setImageUrl(data.image_url);
          updated = true;
        }
      }
      
      if (data.item_url) { setItemUrl(data.item_url); }
      // If ai-gateway returns the original url, ensure we save it
      if (!data.item_url && targetUrl) { setItemUrl(targetUrl); }

      if (updated) {
        toast.success(t('wish_item.fetch_success', 'Details fetched from link!'));
      } else {
        toast.info(t('wish_item.fetch_no_data', 'Could not find details, but link is saved.'));
      }
    } catch (err: any) {
      console.error('Fetch error:', err);
      toast.error(t('wish_item.fetch_error', 'Failed to fetch link details'));
    } finally {
      setIsFetchingUrl(false);
    }
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
      const locale = (typeof window !== 'undefined' && (i18n?.language || navigator.language))?.startsWith('ar') ? 'ar' : 'en';
      const tone = ["neutral","chill","interested","excited","obsessed"][Math.min(4, Math.max(0, desire))];

      const visionFn = `${baseUrl}/functions/v1/extract-from-image`;
      const vres = await fetch(visionFn, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : { Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY as string}` }),
        },
        body: JSON.stringify({ image_base64: base64, locale, tone, style: stylePreset }),
      });

      if (!vres.ok) {
        const errText = await vres.text().catch(() => '');
        throw new Error(errText || `Extract error ${vres.status}`);
      }

      const vjson = await vres.json();
      const s = vjson?.structured || vjson;

      // Map Gemini structured fields to our UI fields
      const titleFromApi = s?.Item_Name || s?.title || '';
      const brandFromApi = s?.Brand || s?.brand || '';
      const descFromApi = s?.Description || s?.description || '';

      let updated = false;
      if (titleFromApi) { setTitle(titleFromApi); updated = true; }
      if (brandFromApi) { setBrand(brandFromApi); updated = true; }
      if (descFromApi) {
        const loc = locale as 'en' | 'ar';
        const rd = refineDescription(brandFromApi, descFromApi, DESC_MAX, tone as any, stylePreset, loc);
        setDescription(rd); updated = true;
      }

      if (updated) {
        toast.success(t('wish_item.extract_done', 'Extracted details from image'));
        return;
      }

      // Fallback to client-side OCR if nothing was extracted
      await runOcrFallback();
    } catch (e: any) {
      const msg = e?.message || (typeof e === 'string' ? e : '') || 'Failed to extract from image';
      toast.error(msg);
    } finally {
      setIsExtracting(false);
    }
  };

  const handleSubmit = async () => {
    // Validation with helpful error messages
    if (!wishlistId) {
      toast.error(t("wish_item.error_no_wishlist", "Please select a wishlist first"));
      return;
    }
    if (!title) {
      toast.error(t("wish_item.error_no_title", "Please enter an item name"));
      return;
    }
    
    await onSubmit?.({
      wishlistId,
      title,
      brand,
      description,
      desire,
      imageFile,
      imagePreviewUrl: imageUrl ?? null,
      itemId,
      url: itemUrl || urlInput || undefined,
    });
    // reset on success
    setTitle("");
    setBrand("");
    setDescription("");
    setDesire(3);
    handleClearImage();
    setWishlistId("");
    setItemUrl("");
    setUrlInput("");
    onOpenChange?.(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {trigger ? <DialogTrigger asChild>{trigger}</DialogTrigger> : null}
      <DialogContent className="w-[92vw] max-w-[420px] p-0 sm:p-0 rounded-2xl">
        <DialogHeader>
          <DialogTitle className="sr-only">{itemId ? t("wish_item.edit_hidden", "Edit Wish") : t("wish_item.add_hidden", "Add Wish")}</DialogTitle>
        </DialogHeader>
        <div className="mx-auto w-full rounded-2xl p-[2px] bg-gradient-to-r from-[hsl(var(--brand-cool-start))] via-[hsl(var(--brand-cool-end))] to-[hsl(var(--brand-warm-end))]">
          <div className="rounded-2xl bg-white/90 backdrop-blur p-4 sm:p-6 ring-1 ring-white/70">
            <h3 className="heading text-center font-semibold text-lg text-foreground">{itemId ? t("wish_item.edit_title", "Edit Wishlist Item") : t("wish_item.create_title", "Create Wishlist Item")}</h3>

            <div className="mt-2 space-y-3 max-h-[75vh] overflow-y-auto pr-1">
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

            {/* Link Input - Fetch from URL */}
            <div className="input-div flex flex-col">
              <Label className="mb-1" htmlFor="urlInput">{t("wish_item.paste_link_label", "Paste Link")}</Label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                    <LinkIcon className="w-4 h-4" />
                  </div>
                  <Input
                    id="urlInput"
                    value={urlInput}
                    onChange={(e) => setUrlInput(e.target.value)}
                    placeholder={t("wish_item.paste_link_placeholder", "https://...")}
                    className="h-11 text-[15px] pl-9 pr-3 rounded-xl"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleFetchUrl();
                      }
                    }}
                  />
                </div>
                <Button 
                  type="button" 
                  onClick={handleFetchUrl}
                  disabled={!urlInput || isFetchingUrl}
                  className="h-11 w-11 p-0 rounded-xl shrink-0"
                  variant="outline"
                >
                  {isFetchingUrl ? <Loader2 className="w-5 h-5 animate-spin" /> : <ArrowDownToLine className="w-5 h-5" />}
                </Button>
              </div>
              <p className="mt-1.5 text-[11px] text-muted-foreground/80">{t("wish_item.paste_link_hint", "Fetch product details from any URL")}</p>
            </div>

            {/* Divider */}
            <div className="relative my-5">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-border/40"></div>
              </div>
              <div className="relative flex flex-col items-center gap-1">
                <span className="bg-white px-3 text-xs font-semibold text-muted-foreground/60 uppercase tracking-wide">{t("wish_item.or", "OR")}</span>
                <span className="bg-white px-3 text-[11px] text-muted-foreground/70 italic">{t("wish_item.ai_subtitle", "let's wishly ai take care")}</span>
              </div>
            </div>

            {/* Upload Image - Extract with AI */}
            <div className="input-div flex flex-col">
              <Label className="mb-2">{t("wish_item.upload_label", "Upload Image")}</Label>
              {/* Inline keyframes for float */}
              <style>{`@keyframes folder-float {0%{transform:translateY(0)}50%{transform:translateY(-10px)}100%{transform:translateY(0)}}`}</style>
              <div
                className="group relative w-full rounded-[20px] px-3 sm:px-4 pt-12 sm:pt-16 pb-3 sm:pb-4 mx-auto"
                style={{
                  background: "linear-gradient(135deg, #f162ba, #ed45ae)",
                  minHeight: 120,
                  boxShadow: "0 24px 44px rgba(0,0,0,0.22)",
                  maxWidth: 260,
                  width: '100%',
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
                      <img src={imageUrl} alt="Preview" className="absolute inset-0 h-full w-full object-contain rounded-[14px] bg-white p-1" />
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
              {/* Tone slider placed above extract button */}
              <div className="mt-3">
                <Label className="mb-2">{t("wish_item.desire_label", "How badly do you want it?")}</Label>
                <div className="flex w-full flex-col gap-2">
                  <div className="flex w-full items-center justify-between px-1 text-xl select-none">
                    {["😐","😌","🙂","😊","😍"].map((e, i) => (
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

              <div className="mt-2 flex items-center gap-2 flex-wrap">
                {imageUrl ? (
                  <Button type="button" variant="ghost" onClick={handleClearImage}>{t("wish_item.clear_image", "Clear Image")}</Button>
                ) : null}
                <div className="flex items-center gap-2 flex-1 min-w-0 w-full">
                  <Button type="button" onClick={handleExtractFromImage} disabled={isExtracting || !imageFile} className="flex-1 min-w-0 truncate">
                    {isExtracting ? t("wish_item.extracting", "Extracting...") : t("wish_item.extract_ai_button", "Extract details with AI")}
                  </Button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button type="button" variant="secondary" className="px-2 shrink-0" aria-label="Style presets">
                        <ChevronDown className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => setStylePreset('Auto')}>Auto</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setStylePreset('Professional')}>Professional</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setStylePreset('Natural')}>Natural</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setStylePreset('GenZ')}>Gen Z</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
                <span className="basis-full ml-1 text-xs text-muted-foreground">Style: {stylePreset}</span>
              </div>
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
              <div className="relative">
                <Textarea
                  id="desc"
                  value={description}
                  onChange={(e) => setDescription(e.target.value.slice(0, DESC_MAX))}
                  placeholder={t("wish_item.description_placeholder", "Add size, color, or why you want it…")}
                  className="min-h-[84px] text-[15px] px-3 rounded-xl pr-14"
                />
                <div className="pointer-events-none absolute bottom-2 right-3 text-xs select-none"
                     style={{ color: description.length > DESC_MAX - 20 ? 'var(--destructive)' as any : 'var(--muted-foreground)' as any }}>
                  {description.length}/{DESC_MAX}
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="button-div flex flex-col items-center justify-center gap-2 pt-2 pb-[max(env(safe-area-inset-bottom),0px)]">
              <div className="flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-3 w-full">
                <Button type="button" variant="secondary" onClick={() => onOpenChange?.(false)} className="w-full sm:w-auto px-6">{t("common.cancel", "Cancel")}</Button>
                <Button type="button" disabled={!canSubmit} onClick={handleSubmit} className="w-full sm:w-auto px-8 py-2 bg-gradient-to-r from-[hsl(var(--brand-cool-start))] via-[hsl(var(--brand-cool-end))] to-[hsl(var(--brand-warm-end))] text-white rounded-xl">{itemId ? t("wish_item.update_button", "Update Wish") : t("wish_item.save_button", "Save to Wishlist")}</Button>
              </div>
              <p className="text-[11px] text-muted-foreground/70 text-center italic mt-1">
                {t("wish_item.double_check_hint", "✨ Quick check! Make sure everything looks good before saving")}
              </p>
          </div>
        </div>
        </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
