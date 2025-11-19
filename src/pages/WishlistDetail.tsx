import { useParams, useNavigate, Link, useSearchParams, useLocation } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import BackButton from "@/components/BackButton";
import WishAddDialog from "@/components/wishes/WishAddDialog";
import FloatingLines from "@/components/FloatingLines";
import Counter from "@/components/Counter";
import { useWishlists } from "@/hooks/use-wishlists";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Check, X } from "lucide-react";
import { Carousel, CarouselContent, CarouselItem, CarouselPrevious, CarouselNext, type CarouselApi } from "@/components/ui/carousel";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useTranslation } from "react-i18next";
import type { Database } from "@/integrations/supabase/types";
import wishlyLogo from "@/assets/wishly-logo.png";

type Wishlist = Database["public"]["Tables"]["wishlists"]["Row"];
type WishlistItem = Database["public"]["Tables"]["wishlist_items"]["Row"];

const WishlistDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { t, i18n } = useTranslation();
  const [searchParams] = useSearchParams();
  const [open, setOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<WishlistItem | null>(null);
  const { data: wishlistsData } = useWishlists();
  const queryClient = useQueryClient();
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState("");
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewSrc, setPreviewSrc] = useState<string | null>(null);
  const [claimed, setClaimed] = useState<Record<string, boolean>>({});
  const [owner, setOwner] = useState<{ full_name?: string | null; username?: string | null; avatar_url?: string | null; allow_friends_claim?: boolean | null; show_countdown_timer?: boolean | null } | null>(null);
  const [countdown, setCountdown] = useState<string | null>(null);
  const [daysRemaining, setDaysRemaining] = useState<number | null>(null);
  const [carouselApi, setCarouselApi] = useState<CarouselApi | null>(null);
  const [slide, setSlide] = useState(0);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["wishlist-detail", id],
    queryFn: async (): Promise<{ wishlist: any | null; items: WishlistItem[] }> => {
      if (!id) return { wishlist: null, items: [] };

      const [{ data: wl, error: wlErr }, { data: items, error: itemsErr }] = await Promise.all([
        // Try to join owner profile for gifter header (user_profiles is the correct table)
        (supabase as any)
          .from("wishlists")
          .select("*, owner:user_profiles(full_name,username,avatar_url,allow_friends_claim,show_countdown_timer)")
          .eq("id", id)
          .maybeSingle(),
        supabase.from("wishlist_items").select("*").eq("wishlist_id", id).order("added_at", { ascending: false }),
      ]);

      if (wlErr) throw wlErr;
      if (itemsErr) throw itemsErr;

      return { wishlist: wl as any, items: (items as WishlistItem[]) ?? [] };
    },
  });

  const isBirthdayWishlist = (data?.wishlist?.title || "") === "My Birthday Wishlist";
  const isGifterMode = (searchParams.get('mode') || '').toLowerCase() === 'gifter';
  const fromFriendsTab = Boolean((location as any)?.state?.from === 'friends');
  const isAr = i18n.language?.startsWith('ar');

  const items = useMemo(() => data?.items ?? [], [data]);
  const wishlistsOptions = useMemo(
    () => (wishlistsData ?? []).map(w => ({ id: w.id, name: w.title || w.id })),
    [wishlistsData]
  );

  const desireEmoji = (d?: number | null) => {
    const arr = ["😐","😌","🙂","😊","😍"] as const;
    const idx = typeof d === "number" ? Math.max(0, Math.min(4, d)) : 3; // default to middle if missing
    return arr[idx];
  };

  // Load owner profile for gifter landing (prefer joined owner, otherwise fetch from user_profiles)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const joined = (data?.wishlist as any)?.owner;
        if (joined) { if (!cancelled) setOwner(joined as any); return; }
        const ownerId = (data?.wishlist as any)?.user_id;
        if (!ownerId) return;
        const { data: prof, error: profErr } = await supabase
          .from('user_profiles' as any)
          .select('full_name, username, avatar_url, allow_friends_claim, show_countdown_timer')
          .eq('id', ownerId)
          .maybeSingle();
        if (!cancelled && prof) { setOwner((prof as any) || null); return; }
        // If RLS blocked or no row returned, try direct REST with public env keys
        try {
          const supabaseUrl = (import.meta as any)?.env?.VITE_SUPABASE_URL as string | undefined;
          const supabaseKey = ((import.meta as any)?.env?.VITE_SUPABASE_PUBLISHABLE_KEY || (import.meta as any)?.env?.VITE_SUPABASE_ANON_KEY) as string | undefined;
          if (!supabaseUrl || !supabaseKey) return;
          const resp = await fetch(`${supabaseUrl.replace(/\/$/, '')}/rest/v1/user_profiles?id=eq.${encodeURIComponent(ownerId)}&select=full_name,username,avatar_url,allow_friends_claim,show_countdown_timer`, {
            headers: {
              apikey: supabaseKey,
              Authorization: `Bearer ${supabaseKey}`,
              Accept: 'application/json',
            },
          });
          if (!resp.ok) return;
          const arr = (await resp.json()) as any[];
          const row = Array.isArray(arr) && arr[0] ? arr[0] : null;
          if (!cancelled && row) setOwner(row);
        } catch {}
      } catch {
        if (!cancelled) setOwner(null);
      }
    })();
    return () => { cancelled = true; };
  }, [data?.wishlist?.id]);

  // Fallback fetch for public (gifter) mode when Supabase client can't access user_profiles due to RLS
  useEffect(() => {
    if (!isGifterMode) return;
    if (!id) return;
    const uid = (data?.wishlist as any)?.user_id as string | undefined;
    const looksPlaceholder = owner?.username ? /^user-[a-z0-9]{4,}$/i.test(owner.username) : false;
    const hasName = Boolean(owner?.full_name || owner?.username);
    const hasAvatar = Boolean(owner?.avatar_url);
    // Trigger fallback if missing name OR looks like placeholder OR missing avatar
    if (hasName && !looksPlaceholder && hasAvatar) return;
    let cancelled = false;
    (async () => {
      try {
        const resp = await fetch(`/api/public-wishlist/${id}`);
        if (!resp.ok) return;
        const payload = await resp.json();
        if (cancelled) return;
        const apiOwner = payload?.owner || {};
        setOwner((prev) => ({
          full_name: apiOwner.full_name ?? prev?.full_name,
          username: apiOwner.username ?? prev?.username,
          avatar_url: apiOwner.avatar_url ?? prev?.avatar_url,
          allow_friends_claim: typeof apiOwner.allow_friends_claim === 'boolean' ? apiOwner.allow_friends_claim : prev?.allow_friends_claim,
          show_countdown_timer: typeof apiOwner.show_countdown_timer === 'boolean' ? apiOwner.show_countdown_timer : prev?.show_countdown_timer,
        }));
      } catch {}
    })();
    return () => {
      cancelled = true;
    };
  }, [id, isGifterMode, owner?.full_name, owner?.username, owner?.avatar_url, data?.wishlist?.user_id]);

  const eventDateText = (() => {
    const d = data?.wishlist?.event_date ? new Date(data.wishlist.event_date) : null;
    if (!d || isNaN(d.getTime())) return null;
    if (i18n.language === 'ar') {
      return d.toLocaleDateString('ar-EG', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });
    }
    const weekday = d.toLocaleDateString('en-GB', { weekday: 'long' });
    const day = d.getDate();
    const month = d.toLocaleDateString('en-GB', { month: 'long' });
    return `${weekday}, ${day} ${month} ${d.getFullYear()}`;
  })();

  // Live countdown for event date (updates every minute)
  useEffect(() => {
    const d = data?.wishlist?.event_date ? new Date(data.wishlist.event_date) : null;
    if (!d || isNaN(d.getTime())) { setCountdown(null); return; }
    const fmt = () => {
      const now = new Date().getTime();
      const diff = d.getTime() - now;
      if (diff <= 0) { setCountdown(null); setDaysRemaining(0); return; }
      const mins = Math.floor(diff / 60000);
      const days = Math.floor(mins / (60 * 24));
      const hours = Math.floor((mins % (60 * 24)) / 60);
      const minutes = mins % 60;
      if (days > 0) setCountdown(`${days}d ${hours}h`);
      else if (hours > 0) setCountdown(`${hours}h ${minutes}m`);
      else setCountdown(`${minutes}m`);
      setDaysRemaining(Math.max(0, days));
    };
    fmt();
    const id = setInterval(fmt, 60000);
    return () => clearInterval(id);
  }, [data?.wishlist?.event_date]);

  // Track carousel slide for paging hint
  useEffect(() => {
    if (!carouselApi) return;
    const onSelect = () => setSlide(carouselApi.selectedScrollSnap());
    onSelect();
    carouselApi.on('select', onSelect);
    return () => {
      try { carouselApi.off('select', onSelect); } catch {}
    };
  }, [carouselApi]);

  if (isLoading) {
    return (
      <div className="container max-w-2xl mx-auto px-4 py-6">
        <p className="text-sm text-muted-foreground">Loading...</p>
      </div>
    );
  }

  return (
    <div className={`container max-w-2xl mx-auto px-4 py-6 space-y-4 ${isGifterMode ? 'relative' : ''}`}>
      {isGifterMode && (
        <div className="fixed inset-0 z-0">
          <FloatingLines
            enabledWaves={["top","middle","bottom"]}
            lineCount={[6,10,12] as any}
            lineDistance={[6,5,4] as any}
            bendRadius={5.0}
            bendStrength={-0.5}
            interactive={true}
            parallax={true}
            parallaxStrength={0.12}
            animationSpeed={0.85}
            linesGradient={["#4f46e5","#06b6d4","#ec4899","#f59e0b"]}
            mixBlendMode="normal"
          />
        </div>
      )}
      <div className={`${isGifterMode ? 'relative z-10' : ''}`}>
      {!isGifterMode && (
        <div className="flex items-center gap-2">
          <BackButton onClick={() => navigate(-1)}>{t("wishlist_detail_back", "Back")}</BackButton>
        </div>
      )}

      {isGifterMode && (
        <div className="relative w-full" dir={isAr ? 'rtl' : 'ltr'}>
          {/* Owner header */}
          <div className="relative mx-auto max-w-[520px] w-full mb-4 flex items-center gap-4 rounded-2xl px-5 py-4 ring-1 ring-white/60 shadow-[0_10px_28px_rgba(0,0,0,0.10)] overflow-hidden" style={{background:'linear-gradient(135deg, rgba(255,255,255,0.85), rgba(255,255,255,0.6))'}}>
            <div className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full opacity-20" style={{background:'radial-gradient(circle, rgba(99,102,241,0.8), transparent 60%)'}}/>
            <div className="pointer-events-none absolute -left-20 -bottom-24 h-48 w-48 rounded-full opacity-20" style={{background:'radial-gradient(circle, rgba(236,72,153,0.8), transparent 60%)'}}/>
            <img src={owner?.avatar_url || ''} alt="avatar" onError={(e:any)=>{e.currentTarget.style.display='none';}} className="relative h-14 w-14 sm:h-16 sm:w-16 rounded-full object-cover ring-2 ring-white/80 shadow-[0_6px_16px_rgba(0,0,0,0.15)]" />
            <div className="relative min-w-0 flex-1">
              {(() => {
                const uid = (data?.wishlist as any)?.user_id as string | undefined;
                const fallbackTag = uid ? `@user-${uid.slice(0, 6)}` : t('giftr.owner_someone','A friend');
                const name = owner?.full_name || owner?.username || fallbackTag;
                const handle = owner?.username ? `@${owner.username}` : '';
                const wlTitle = (data?.wishlist?.title || t('wishlist_detail.wishlist','Wishlist')) as string;
                const possessive = /s$/i.test(name) ? `${name}'` : `${name}'s`;
                const welcome = isAr
                  ? `${t('giftr.welcome_to','مرحبًا بكم في')} ${'قائمة أمنيات'} ${name}`
                  : `${t('giftr.welcome_to','Welcome to')} ${possessive} ${wlTitle}`;
                return (
                  <>
                    <div className="flex items-center gap-2 text-base sm:text-xl font-extrabold truncate">
                      <span className="truncate">{name}</span>
                      {handle && <span className="text-sm sm:text-base font-medium text-muted-foreground truncate">{handle}</span>}
                    </div>
                    <div className="mt-0.5 text-xs sm:text-sm text-muted-foreground truncate">
                      {welcome}
                    </div>
                    <div className="mt-2"></div>
                  </>
                );
              })()}
            </div>
          </div>
        </div>
      )}

      {isGifterMode && (owner?.show_countdown_timer ?? true) && daysRemaining !== null && (
        <div className="mx-auto mb-2 flex flex-col items-center" style={{ maxWidth: 420 }} dir={isAr ? 'rtl' : 'ltr'}>
          <Counter
            value={daysRemaining}
            places={daysRemaining >= 100 ? [100,10,1] : daysRemaining >= 10 ? [10,1] : [1]}
            fontSize={28}
            padding={2}
            gap={6}
            textColor="white"
            fontWeight={900}
            gradientHeight={12}
            gradientFrom="rgba(0,0,0,0.35)"
            gradientTo="transparent"
            counterStyle={{ background: 'rgba(255,255,255,0.08)' }}
            borderRadius={8}
            horizontalPadding={6}
          />
          <span className="mt-1 text-xs text-white drop-shadow-sm">{isAr ? 'أيام متبقية' : t('giftr.days_left','days left')}</span>
        </div>
      )}

      {/* Detail inside the same gradient card style as the stack */}
      <div className={`mx-auto ${isGifterMode ? 'mt-6' : 'mt-12'} w-full max-w-[420px]`} dir={isAr ? 'rtl' : 'ltr'}>
        <div className="wl-card w-full">
          <div className="wl-card-surface p-5 text-white" style={{ alignItems: 'flex-start', justifyContent: 'flex-start' }}>
            <div className="w-full">
              <div className="flex items-center gap-2">
                {!isEditingTitle || isBirthdayWishlist ? (
                  <>
                    <h2
                      className="text-3xl font-extrabold bg-gradient-to-r from-[hsl(var(--brand-cool-start))] via-[hsl(var(--brand-cool-end))] to-[hsl(var(--brand-warm-end))] bg-clip-text text-transparent drop-shadow-[0_2px_2px_rgba(0,0,0,0.75)] wl-card-title"
                      style={{ textAlign: 'left', WebkitTextStroke: '0.6px rgba(0,0,0,0.9)' }}
                    >
                      {data?.wishlist?.title || "Wishlist"}
                    </h2>
                    {!isBirthdayWishlist && !isGifterMode && (
                      <button
                        type="button"
                        className="inline-flex items-center justify-center rounded-md p-1.5 text-white/90 hover:text-white hover:bg-white/10 transition"
                        aria-label="Edit title"
                        onClick={() => {
                          setTitleDraft(data?.wishlist?.title || "");
                          setIsEditingTitle(true);
                        }}
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                    )}
                  </>
                ) : (
                  <div className="flex items-center gap-2">
                    <Input
                      value={titleDraft}
                      onChange={(e) => setTitleDraft(e.target.value)}
                      className="h-9 w-64 text-black"
                      autoFocus
                    />
                    <Button
                      size="sm"
                      onClick={async () => {
                        try {
                          if (!id) return;
                          const newTitle = titleDraft.trim();
                          if (!newTitle) return;
                          const { error } = await supabase
                            .from("wishlists")
                            .update({ title: newTitle })
                            .eq("id", id);
                          if (error) throw error;
                          setIsEditingTitle(false);
                          await refetch();
                          await queryClient.invalidateQueries({ queryKey: ["wishlists"] });
                          await queryClient.invalidateQueries({
                            predicate: (q) => Array.isArray(q.queryKey) && q.queryKey[0] === 'events'
                          });
                          toast.success("Title updated");
                        } catch (e: any) {
                          toast.error(e?.message || "Failed to update title");
                        }
                      }}
                      aria-label="Save title"
                    >
                      <Check className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => setIsEditingTitle(false)}
                      aria-label="Cancel editing"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </div>
              {!isGifterMode && (
                <>
                  <p className="mt-3 text-xs font-semibold opacity-90 drop-shadow-[0_2px_8px_rgba(0,0,0,0.6)]">{t('wishlist_detail.contains', 'This wishlist contains ({{count}}/10)', { count: items.length })}</p>
                </>
              )}
              {eventDateText && (
                <div className="mt-1 flex items-center gap-2">
                  <p className={`mt-2 text-xs font-semibold opacity-90 drop-shadow-[0_2px_8px_rgba(0,0,0,0.6)] ${isAr ? 'text-right' : ''}`}>{eventDateText}</p>
                  <span className="inline-flex items-center rounded-full bg-white/80 px-2 py-0.5 text-[11px] ring-1 ring-black/10 text-blue-900">
                    {items.length} {t('giftr.items','items')}
                  </span>
                </div>
              )}

              <div className="mt-3 w-full">
                <h3 className={`text-base font-semibold drop-shadow-[0_2px_6px_rgba(0,0,0,0.5)] ${isAr ? 'text-right' : ''}`}>{isAr ? 'العناصر' : t('wishlist_detail.items_title', 'Items')}</h3>
                {items.length > 0 ? (
                  <>
                  <Carousel opts={{ align: 'start', loop: false }} className="mt-2" setApi={setCarouselApi}>
                    <CarouselContent>
                      {items.map((it) => (
                        <CarouselItem key={it.id}>
                          <div className="rounded-2xl p-[2px] bg-gradient-to-br from-[hsl(var(--brand-cool-start))] via-[hsl(var(--brand-cool-end))] to-[hsl(var(--brand-warm-end))] shadow-[0_8px_18px_rgba(0,0,0,0.22)]">
                            <div className="rounded-xl bg-black/30 backdrop-blur-sm px-3 py-3 flex items-start gap-3 select-none">
                            <button
                              type="button"
                              onClick={() => {
                                if (!it.image_url) return;
                                setPreviewSrc(it.image_url!);
                                setPreviewOpen(true);
                              }}
                              className="focus:outline-none"
                              aria-label="Preview image"
                            >
                              {it.image_url ? (
                                <img
                                  src={it.image_url}
                                  alt={it.title || 'Preview'}
                                  className="h-[80px] w-[80px] rounded-full object-cover ring-2 ring-white/40 shadow-[0_6px_18px_rgba(0,0,0,0.35)]"
                                  loading="lazy"
                                />
                              ) : (
                                <div className="h-[80px] w-[80px] rounded-full bg-gradient-to-br from-white/20 to-white/10 ring-2 ring-white/30" />
                              )}
                            </button>
                            <div className={`min-w-0 flex-1 ${isAr ? 'text-right' : ''}`}>
                              <div className="flex items-center justify-between gap-2">
                                <div className="text-base sm:text-lg font-extrabold text-white truncate drop-shadow-[0_2px_8px_rgba(0,0,0,0.6)]">{it.title || t('events.untitled','Untitled')}</div>
                                <div className="text-lg" aria-hidden>{desireEmoji((it as any).desire)}</div>
                              </div>
                              {(it as any)?.brand && (
                                <div className="mt-0.5 text-xs text-white/90 truncate drop-shadow-[0_2px_6px_rgba(0,0,0,0.5)]">{(it as any).brand}</div>
                              )}
                              {it.description && (
                                <div className="mt-1 text-sm text-white/95 line-clamp-4 drop-shadow-[0_2px_6px_rgba(0,0,0,0.5)]">{it.description}</div>
                              )}
                              {it.item_url && (
                                <a href={it.item_url} target="_blank" rel="noreferrer" className="mt-1 inline-block text-[11px] text-blue-200 underline">
                                  {t('giftr.view_link', 'View link')}
                                </a>
                              )}
                              <div className={`mt-2 flex items-center gap-2 ${isAr ? 'justify-end' : ''}`}>
                                {isGifterMode ? (
                                  (owner?.allow_friends_claim ?? true) ? (
                                    <Button
                                      size="sm"
                                      className="h-8 px-3"
                                      onClick={() => {
                                        toast.message(t('giftr.cta_title','Want to send a message or claim an item?'), {
                                          description: t('giftr.cta_sub','See your friends\' wishlists too.'),
                                          action: { label: t('giftr.cta_signup','Sign up'), onClick: () => navigate('/signup') },
                                          cancel: { label: t('giftr.cta_login','Log in'), onClick: () => navigate('/login') },
                                        } as any);
                                      }}
                                    >
                                      {claimed[it.id] ? (isAr ? 'تم الحجز' : t('giftr.claimed_btn', 'Claimed')) : (isAr ? 'حجز' : t('giftr.claim_btn', 'Claim'))}
                                    </Button>
                                  ) : null
                                ) : fromFriendsTab ? (
                                  (owner?.allow_friends_claim ?? true) ? (
                                    <Button
                                      size="sm"
                                      className="h-8 px-3"
                                      onClick={async () => {
                                        try {
                                          const { data: { user } } = await supabase.auth.getUser();
                                          if (!user) { navigate('/login'); return; }
                                          toast.success(t('giftr.claim_soon','Claim reserved — coming soon'));
                                        } catch {
                                          toast.error(t('giftr.error','Something went wrong'));
                                        }
                                      }}
                                    >
                                      {isAr ? 'حجز' : t('giftr.claim_btn','Claim')}
                                    </Button>
                                  ) : null
                                ) : (
                                  <>
                                    <button
                                      type="button"
                                      className="text-white/90 hover:text-white transition"
                                      onClick={() => {
                                        setEditingItem(it);
                                        setEditOpen(true);
                                      }}
                                      aria-label="Edit"
                                    >
                                      <Pencil className="h-4 w-4" />
                                    </button>
                                    <button
                                      type="button"
                                      className="text-white/90 hover:text-white transition"
                                      onClick={async () => {
                                        const ok = window.confirm("Delete this item?");
                                        if (!ok) return;
                                        const { error } = await supabase.from("wishlist_items").delete().eq("id", it.id);
                                        if (error) {
                                          toast.error(error.message || "Failed to delete");
                                        } else {
                                          toast.success("Deleted");
                                          await refetch();
                                        }
                                      }}
                                      aria-label="Delete"
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </button>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>
                          </div>
                        </CarouselItem>
                      ))}
                    </CarouselContent>
                    {/* Desktop arrows */}
                    <CarouselPrevious className="hidden sm:flex" />
                    <CarouselNext className="hidden sm:flex" />
                  </Carousel>
                  <div className="mt-2 text-center text-[11px] text-white/90">
                    {slide + 1}/{items.length}
                  </div>
                  </>
                ) : (
                  <p className="text-sm opacity-80 mt-1">{t('wishlist_detail.no_items', 'No items yet.')}</p>
                )}
              </div>
            </div>
            {!isGifterMode && (
              <>
                <div className="absolute bottom-4 right-4">
                  <button
                    type="button"
                    onClick={() => setOpen(true)}
                    className="w-12 h-12 rounded-full bg-black text-white flex items-center justify-center shadow-[0_16px_34px_rgba(0,0,0,0.5)] ring-2 ring-white/30"
                    aria-label="Add"
                  >
                    <Plus className="h-6 w-6" />
                  </button>
                </div>
                <WishAddDialog
                  open={open}
                  onOpenChange={setOpen}
                  wishlists={wishlistsOptions}
                  fixedWishlistId={data?.wishlist?.id || id || ""}
                  onSubmit={async ({ wishlistId, title, brand, description, desire, imageFile }) => {
                    try {
                      const { data: { user } } = await supabase.auth.getUser();
                      if (!user) {
                        toast.error("You must be signed in");
                        return;
                      }

                      let publicImageUrl: string | null = null;
                      if (imageFile) {
                        const bucket = "wishlist_images";
                        const filePath = `wishlist-items/${user.id}/${Date.now()}_${imageFile.name}`;
                        const { error: uploadError } = await supabase.storage
                          .from(bucket)
                          .upload(filePath, imageFile, { upsert: false, contentType: imageFile.type });
                        if (uploadError) throw uploadError;
                        const { data: pub } = supabase.storage.from(bucket).getPublicUrl(filePath);
                        publicImageUrl = pub.publicUrl;
                      }

                      const payload: any = {
                        title,
                        brand: brand || null,
                        description: description || (brand ? `Brand: ${brand}` : null),
                        image_url: publicImageUrl,
                        item_url: null,
                        price: null,
                        status: null,
                        wishlist_id: wishlistId,
                        added_at: new Date().toISOString(),
                        desire,
                      };
                      const { error } = await supabase.from("wishlist_items").insert([payload]);
                      if (error) throw error;
                      toast.success("Wish saved");
                      await refetch();
                    } catch (e: any) {
                      toast.error(e?.message || "Failed to save wish");
                    }
                  }}
                />
              </>
            )}

            {!isGifterMode && (
            <WishAddDialog
              open={editOpen}
              onOpenChange={(o) => {
                setEditOpen(o);
                if (!o) setEditingItem(null);
              }}
              wishlists={wishlistsOptions}
              initialWishlistId={editingItem?.wishlist_id || undefined}
              onSubmit={async ({ itemId, wishlistId, title, brand, description, desire, imageFile }) => {
                try {
                  if (!itemId) return;
                  const { data: { user } } = await supabase.auth.getUser();
                  if (!user) {
                    toast.error("You must be signed in");
                    return;
                  }

                  let publicImageUrl: string | undefined;
                  if (imageFile) {
                    const bucket = "wishlist_images";
                    const filePath = `wishlist-items/${user.id}/${Date.now()}_${imageFile.name}`;
                    const { error: uploadError } = await supabase.storage
                      .from(bucket)
                      .upload(filePath, imageFile, { upsert: false, contentType: imageFile.type });
                    if (uploadError) throw uploadError;
                    const { data: pub } = supabase.storage.from(bucket).getPublicUrl(filePath);
                    publicImageUrl = pub.publicUrl;
                  }

                  const updates: any = {
                    title,
                    brand: brand || null,
                    description: description || (brand ? `Brand: ${brand}` : null),
                    wishlist_id: wishlistId,
                    desire,
                  };
                  if (typeof publicImageUrl === "string") updates.image_url = publicImageUrl;

                  const { error } = await supabase.from("wishlist_items").update(updates).eq("id", itemId);
                  if (error) throw error;
                  toast.success("Wish updated");
                  await refetch();
                } catch (e: any) {
                  toast.error(e?.message || "Failed to update wish");
                }
              }}
              itemId={editingItem?.id || undefined}
              initialTitle={editingItem?.title || ""}
              initialBrand={(editingItem as any)?.brand || ""}
              initialDescription={editingItem?.description || ""}
              initialDesire={(editingItem as any)?.desire ?? 3}
              initialImageUrl={editingItem?.image_url || null}
            />)}
          </div>
        </div>
      </div>

      {isGifterMode && (
        <div className="mx-auto mt-5 w-full max-w-[520px]">
          <div className="rounded-2xl bg-white/70 backdrop-blur ring-1 ring-white/60 px-4 py-4 shadow-[0_10px_28px_rgba(0,0,0,0.08)]">
            <div className="flex items-center justify-center gap-3 mb-2">
              <img src={wishlyLogo} alt="Wishly" className="h-12 w-12 rounded-full ring-1 ring-white/50 shadow-sm object-cover" />
              <div className="text-center">
                <div className="text-white text-lg sm:text-xl font-extrabold drop-shadow-[0_3px_12px_rgba(0,0,0,0.45)] tracking-tight">
                  {t('giftr.cta_head','Wishlist in Style')}
                </div>
                <div className="text-xs opacity-95 -mt-0.5 text-black/80">
                  {t('giftr.cta_sub','Create wishlists and share them with friends.')}
                </div>
              </div>
            </div>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-3">
              <Link
                to="/signup"
                className="w-full sm:w-auto px-5 py-2 rounded-full text-white text-sm font-semibold bg-gradient-to-br from-[hsl(var(--brand-cool-start))] to-[hsl(var(--brand-warm-end))] hover:opacity-95 shadow-sm"
              >
                {t('giftr.cta_signup','Sign up')}
              </Link>
              <Link to="/login" className="w-full sm:w-auto px-5 py-2 rounded-full text-sm font-semibold ring-1 ring-black/10 bg-white/80">{t('giftr.cta_login','Log in')}</Link>
            </div>
          </div>
        </div>
      )}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Preview</DialogTitle>
          </DialogHeader>
          <div className="flex items-center justify-center">
            {previewSrc ? (
              <img src={previewSrc} alt="Preview" className="max-h-[75vh] max-w-full object-contain rounded-md" />
            ) : null}
          </div>
        </DialogContent>
      </Dialog>
    </div>
    </div>
  );
};

export default WishlistDetail;
