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
import { Plus, Pencil, Trash2, Check, X, Lock, Loader2, Heart, MessageCircle } from "lucide-react";
import { Carousel, CarouselContent, CarouselItem, CarouselPrevious, CarouselNext, type CarouselApi } from "@/components/ui/carousel";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useTranslation } from "react-i18next";
import type { Database } from "@/integrations/supabase/types";
import wishlyLogo from "@/assets/wishly-logo.png";
import { useIsMobile } from "@/hooks/use-mobile";
import { approveReservation, declineReservation } from "@/lib/reservations";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";

type Wishlist = Database["public"]["Tables"]["wishlists"]["Row"];
type WishlistItem = Database["public"]["Tables"]["wishlist_items"]["Row"];
type ReservationStatus = "pending" | "approved" | "declined";
type ReservationInfo = {
  id: string;
  item_id: string;
  status: ReservationStatus;
  approved_at: string | null;
  created_at: string | null;
  claimer: {
    id: string | null;
    full_name: string | null;
    username: string | null;
    avatar_url: string | null;
  } | null;
};

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
  const [reservationAction, setReservationAction] = useState<{ id: string; type: "approve" | "decline" } | null>(null);
  const [owner, setOwner] = useState<{ full_name?: string | null; username?: string | null; avatar_url?: string | null; allow_friends_claim?: boolean | null; show_countdown_timer?: boolean | null } | null>(null);
  const [countdown, setCountdown] = useState<string | null>(null);
  const [daysRemaining, setDaysRemaining] = useState<number | null>(null);
  const [carouselApi, setCarouselApi] = useState<CarouselApi | null>(null);
  const [slide, setSlide] = useState(0);
  const isMobile = useIsMobile();
  const [privacyLevel, setPrivacyLevel] = useState<string | null>(null);
  const [privacyUpdating, setPrivacyUpdating] = useState(false);
  const [viewerId, setViewerId] = useState<string | null>(null);
  const [visibilityPrefs, setVisibilityPrefs] = useState<{ allowFollowersView: boolean; enforceWishlistPrivacy: boolean } | null>(null);
  const [activeTab, setActiveTab] = useState<"items" | "activity">("items");

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

  const carouselOpts = useMemo(() => ({
    align: "start" as const,
    loop: false,
    direction: isAr ? "rtl" : "ltr",
  }), [isAr]);

  const items = useMemo(() => data?.items ?? [], [data]);
  const reservationKeyDeps = useMemo(() => items.map((item) => item.id).sort().join("|"), [items]);
  const { data: reservationRows = [], isLoading: reservationsLoading } = useQuery({
    queryKey: ["wishlist-detail", id, "reservations", reservationKeyDeps],
    enabled: Boolean(id) && items.length > 0,
    queryFn: async (): Promise<ReservationInfo[]> => {
      if (!id) return [];
      const itemIds = items.map((item) => item.id).filter(Boolean);
      if (itemIds.length === 0) return [];
      const { data: rows, error } = await (supabase as any)
        .from('wishlist_reservations')
        .select(`
          id,
          item_id,
          status,
          approved_at,
          created_at,
          reserved_by:user_profiles (
            id,
            full_name,
            username,
            avatar_url
          )
        `)
        .in('item_id', itemIds);
      if (error) throw error;
      return (rows ?? []).map((row: any) => ({
        id: row.id as string,
        item_id: row.item_id as string,
        status: row.status as ReservationStatus,
        approved_at: row.approved_at ?? null,
        created_at: row.created_at ?? null,
        claimer: row?.reserved_by ? {
          id: row.reserved_by.id ?? null,
          full_name: row.reserved_by.full_name ?? null,
          username: row.reserved_by.username ?? null,
          avatar_url: row.reserved_by.avatar_url ?? null,
        } : null,
      }));
    },
  });

  const reservationsByItem = useMemo(() => {
    return reservationRows.reduce<Record<string, ReservationInfo[]>>((acc, reservation) => {
      if (!reservation.item_id) return acc;
      if (!acc[reservation.item_id]) acc[reservation.item_id] = [];
      acc[reservation.item_id].push(reservation);
      return acc;
    }, {});
  }, [reservationRows]);

  // Wishlist-level likes (for Activity tab)
  const { data: wishlistLikes = [] } = useQuery({
    queryKey: ["wishlist-detail", id, "likes"],
    enabled: Boolean(id),
    queryFn: async () => {
      if (!id) return [] as any[];
      const { data, error } = await (supabase as any)
        .from("wishlist_likes" as any)
        .select("user_id, user_profiles(id, full_name, username, avatar_url)")
        .eq("wishlist_id", id);
      if (error) throw error;
      return data || [];
    },
  });

  // Wishlist-level comments (for Activity tab)
  const { data: wishlistComments = [] } = useQuery({
    queryKey: ["wishlist-detail", id, "comments"],
    enabled: Boolean(id),
    queryFn: async () => {
      if (!id) return [] as any[];
      const { data, error } = await (supabase as any)
        .from("wishlist_comments" as any)
        .select("id, content, created_at, user_id, user_profiles(id, full_name, username, avatar_url)")
        .eq("wishlist_id", id)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data || [];
    },
  });

  // Item-level likes and comments counts
  const { data: itemSocialCounts = {} } = useQuery({
    queryKey: ["wishlist-detail", id, "item-social-counts", reservationKeyDeps],
    enabled: Boolean(id) && items.length > 0,
    queryFn: async () => {
      if (!id || items.length === 0) return {};
      const itemIds = items.map((item) => item.id).filter(Boolean);
      if (itemIds.length === 0) return {};

      // Fetch item likes
      const { data: likesData } = await (supabase as any)
        .from("item_likes" as any)
        .select("item_id")
        .in("item_id", itemIds);

      // Fetch item comments
      const { data: commentsData } = await (supabase as any)
        .from("item_comments" as any)
        .select("item_id")
        .in("item_id", itemIds);

      // Count by item_id
      const counts: Record<string, { likes: number; comments: number }> = {};
      itemIds.forEach((itemId) => {
        counts[itemId] = { likes: 0, comments: 0 };
      });

      (likesData || []).forEach((like: any) => {
        if (counts[like.item_id]) {
          counts[like.item_id].likes += 1;
        }
      });

      (commentsData || []).forEach((comment: any) => {
        if (counts[comment.item_id]) {
          counts[comment.item_id].comments += 1;
        }
      });

      return counts;
    },
  });

  const wishlistsOptions = useMemo(
    () => (wishlistsData ?? []).map(w => ({ id: w.id, name: w.title || w.id })),
    [wishlistsData]
  );

  const desireEmoji = (d?: number | null) => {
    const arr = ["😐","😌","🙂","😊","😍"] as const;
    const idx = typeof d === "number" ? Math.max(0, Math.min(4, d)) : 3; // default to middle if missing
    return arr[idx];
  };

  const getClaimerName = (reservation?: ReservationInfo | null) => {
    if (!reservation?.claimer) return t('giftr.friend_label', 'Friend');
    return reservation.claimer.full_name || reservation.claimer.username || t('giftr.friend_label', 'Friend');
  };

  const formatClaimTime = (iso?: string | null) => {
    if (!iso) return "";
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return "";
    const diffMs = Date.now() - date.getTime();
    if (diffMs < 60000) return t('events.time_just_now', 'Just now');
    const mins = Math.floor(diffMs / 60000);
    if (mins < 60) return t('events.time_minutes_ago', '{{count}}m ago', { count: mins });
    const hours = Math.floor(mins / 60);
    if (hours < 24) return t('events.time_hours_ago', '{{count}}h ago', { count: hours });
    const days = Math.floor(hours / 24);
    return t('events.time_days_ago', '{{count}}d ago', { count: days });
  };

  useEffect(() => {
    if (!reservationRows || reservationRows.length === 0) {
      setClaimed({});
      return;
    }
    const nextClaimed: Record<string, boolean> = {};
    reservationRows.forEach((reservation) => {
      if (!reservation.item_id) return;
      if (reservation.status === "approved") {
        nextClaimed[reservation.item_id] = true;
      }
    });
    setClaimed(nextClaimed);
  }, [reservationRows]);

  const handleReservationAction = async (reservationId: string, action: "approve" | "decline") => {
    if (!reservationId) return;
    setReservationAction({ id: reservationId, type: action });
    try {
      if (action === "approve") {
        await approveReservation(reservationId);
        toast.success(t('events.claim_approved_toast', 'Claim approved'));
      } else {
        await declineReservation(reservationId);
        toast.success(t('events.claim_declined_toast', 'Claim declined'));
      }
      await queryClient.invalidateQueries({ queryKey: ["wishlist-detail", id, "reservations", reservationKeyDeps] });
    } catch (err: any) {
      toast.error(err?.message || t('events.claim_action_error', 'Unable to update claim. Please try again.'));
    } finally {
      setReservationAction(null);
    }
  };

  useEffect(() => {
    setPrivacyLevel(data?.wishlist?.privacy_level ?? null);
  }, [data?.wishlist?.privacy_level]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data: auth } = await supabase.auth.getUser();
        if (cancelled) return;
        const uid = auth.user?.id ?? null;
        setViewerId(uid);
        if (uid && data?.wishlist?.user_id === uid) {
          const { data: prefs } = await supabase
            .from('user_profiles' as any)
            .select('allow_followers_view, enforce_wishlist_privacy')
            .eq('id', uid)
            .maybeSingle();
          if (!cancelled) {
            setVisibilityPrefs({
              allowFollowersView: Boolean((prefs as any)?.allow_followers_view),
              enforceWishlistPrivacy: (prefs as any)?.enforce_wishlist_privacy !== false,
            });
          }
        } else if (!cancelled) {
          setVisibilityPrefs(null);
        }
      } catch {
        if (!cancelled) {
          setViewerId(null);
          setVisibilityPrefs(null);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [data?.wishlist?.user_id]);

  const isOwner = !isGifterMode && viewerId && data?.wishlist?.user_id === viewerId;
  const perWishlistRespected = visibilityPrefs ? (!visibilityPrefs.allowFollowersView && visibilityPrefs.enforceWishlistPrivacy) : true;
  const privacyToggleDisabled = visibilityPrefs ? visibilityPrefs.allowFollowersView : false;

  const handlePrivacyToggle = async (checked: boolean) => {
    if (!id) return;
    const nextLevel = checked ? 'private' : 'friends_only';
    setPrivacyUpdating(true);
    try {
      const { error } = await supabase
        .from('wishlists')
        .update({ privacy_level: nextLevel })
        .eq('id', id);
      if (error) throw error;
      setPrivacyLevel(nextLevel);
      await refetch();
      await queryClient.invalidateQueries({ queryKey: ['wishlists'] });
      await queryClient.invalidateQueries({
        predicate: (q) => Array.isArray(q.queryKey) && q.queryKey[0] === 'events'
      });
      toast.success(
        checked
          ? t('wishlist_detail.privacy_toast_private', 'Wishlist set to private')
          : t('wishlist_detail.privacy_toast_shared', 'Wishlist shared with followers')
      );
    } catch (e: any) {
      toast.error(e?.message || t('wishlist_detail.privacy_toast_error', 'Failed to update privacy'));
    } finally {
      setPrivacyUpdating(false);
    }
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
  }, [id, isGifterMode, data?.wishlist?.user_id]);

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
      {isGifterMode && !isMobile && (
        <div className="fixed inset-0 z-0">
          <FloatingLines
            enabledWaves={["top","middle","bottom"]}
            lineCount={[6,10,12] as any}
            lineDistance={[6,5,4] as any}
            bendRadius={5.0}
            bendStrength={-0.5}
            interactive={true}
            parallax={true}
            animationSpeed={0.85}
            parallaxStrength={0.12}
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
                  ? `${t('giftr.welcome_to','مرحبًا بكم في')} ${wlTitle} ${name}`
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
          <span className="mt-1 text-xs text-white drop-shadow-sm">{isAr ? t('giftr.days_left_ar','أيام متبقية') : t('giftr.days_left','days left')}</span>
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
                      style={{ textAlign: isAr ? 'right' : 'left', WebkitTextStroke: '0.6px rgba(0,0,0,0.9)' }}
                    >
                      {data?.wishlist?.title === "My Birthday Wishlist" 
                        ? t('wishlist_detail.my_birthday_wishlist', 'My Birthday Wishlist')
                        : (data?.wishlist?.title || t('wishlist_detail.wishlist','Wishlist'))}
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
                    {t('wishlist_detail.items_badge', '{{count}} items', { count: items.length })}
                  </span>
                </div>
              )}

              {isOwner && (
                <div className="mt-4 w-full space-y-1">
                  <div className="flex items-center justify-between rounded-full border border-white/40 bg-black/15 px-3 py-1.5">
                    <span className="text-xs font-semibold">
                      {privacyLevel === 'private'
                        ? t('wishlist_detail.privacy_label_private', 'Private wishlist')
                        : t('wishlist_detail.privacy_label_shared', 'Shared with followers')}
                    </span>
                    <label className="relative inline-flex items-center cursor-pointer select-none">
                      <input
                        type="checkbox"
                        className="sr-only peer"
                        checked={privacyLevel === 'private'}
                        onChange={(e) => handlePrivacyToggle(e.target.checked)}
                        disabled={privacyUpdating || privacyToggleDisabled}
                        aria-label={t('wishlist_detail.privacy_toggle_aria', 'Toggle wishlist privacy')}
                      />
                      <div className="group peer ring-0 bg-rose-400 rounded-full outline-none duration-300 after:duration-300 w-16 h-8 shadow-md peer-checked:bg-emerald-500 peer-focus:outline-none after:content-[''] after:rounded-full after:absolute after:bg-gray-50 after:outline-none after:h-7 after:w-7 after:top-0.5 after:left-0.5 after:flex after:justify-center after:items-center peer-checked:after:translate-x-8 peer-hover:after:scale-95">
                        <svg
                          className="absolute top-0.5 left-9 stroke-gray-900 w-7 h-7"
                          height="100"
                          preserveAspectRatio="xMidYMid meet"
                          viewBox="0 0 100 100"
                          width="100"
                          xmlns="http://www.w3.org/2000/svg"
                        >
                          <path
                            className="fill-current"
                            d="M50,18A19.9,19.9,0,0,0,30,38v8a8,8,0,0,0-8,8V74a8,8,0,0,0,8,8H70a8,8,0,0,0,8-8V54a8,8,0,0,0-8-8H38V38a12,12,0,0,1,23.6-3,4,4,0,1,0,7.8-2A20.1,20.1,0,0,0,50,18Z"
                          />
                        </svg>
                        <svg
                          className="absolute top-0.5 left-0.5 stroke-gray-900 w-7 h-7"
                          height="100"
                          preserveAspectRatio="xMidYMid meet"
                          viewBox="0 0 100 100"
                          width="100"
                          xmlns="http://www.w3.org/2000/svg"
                        >
                          <path
                            d="M30,46V38a20,20,0,0,1,40,0v8a8,8,0,0,1,8,8V74a8,8,0,0,1-8,8H30a8,8,0,0,1-8-8V54A8,8,0,0,1,30,46Zm32-8v8H38V38a12,12,0,0,1,24,0Z"
                            fillRule="evenodd"
                          />
                        </svg>
                      </div>
                    </label>
                  </div>
                  <p className="text-[11px] text-white/85 mt-1">
                    {privacyToggleDisabled
                      ? (
                        <>
                          {t('wishlist_detail.privacy_disabled_hint', 'Followers can currently see every wishlist because "Let followers see all my wishlists" is on.')}
                          {' '}
                          <Link to="/settings" className="underline text-white">
                            {t('wishlist_detail.privacy_go_to_settings', 'Adjust in Settings')}
                          </Link>
                        </>
                      )
                      : perWishlistRespected
                        ? t('wishlist_detail.privacy_hint', 'When "Respect each wishlist’s privacy setting" is on in Settings, this toggle keeps this wishlist private.')
                        : (
                          <>
                            {t('wishlist_detail.privacy_hint_disabled', 'Turn on "Respect each wishlist’s privacy setting" in Settings to control this per wishlist.')}
                            {' '}
                            <Link to="/settings" className="underline text-white">
                              {t('wishlist_detail.privacy_go_to_settings', 'Adjust in Settings')}
                            </Link>
                          </>
                        )}
                  </p>
                </div>
              )}

              <div className="mt-3 w-full">
                <div className="flex items-center justify-between">
                  <h3 className={`text-base font-semibold drop-shadow-[0_2px_6px_rgba(0,0,0,0.5)] ${isAr ? 'text-right' : ''}`}>
                    {activeTab === 'items'
                      ? t('wishlist_detail.items_title', 'Items')
                      : t('wishlist_detail.activity_title', 'Activity')}
                  </h3>
                  <div className="inline-flex rounded-full bg-white/20 p-[2px] text-[11px]">
                    <button
                      type="button"
                      className={`px-3 py-1 rounded-full font-semibold transition ${activeTab === 'items' ? 'bg-white text-slate-900 shadow-sm' : 'text-white/80'}`}
                      onClick={() => setActiveTab('items')}
                    >
                      {t('wishlist_detail.tab_items', 'Items')}
                    </button>
                    <button
                      type="button"
                      className={`px-3 py-1 rounded-full font-semibold transition ${activeTab === 'activity' ? 'bg-white text-slate-900 shadow-sm' : 'text-white/80'}`}
                      onClick={() => setActiveTab('activity')}
                    >
                      {t('wishlist_detail.tab_activity', 'Activity')}
                    </button>
                  </div>
                </div>

                {activeTab === 'items' && (
                  <>
                  {items.length > 0 ? (
                    <>
                    <Carousel opts={carouselOpts} className="mt-2 relative" setApi={setCarouselApi}>
                      <CarouselContent className={isAr ? 'ml-0' : '-ml-4'}>
                        {items.map((it) => {
                        const itemReservations = reservationsByItem[it.id] ?? [];
                        const pendingReservation = itemReservations.find((r) => r.status === "pending");
                        const approvedReservation = itemReservations.find((r) => r.status === "approved");
                        const isClaimedItem = Boolean(approvedReservation);
                        const hasPending = Boolean(pendingReservation);
                        const actingOnPending = pendingReservation && reservationAction?.id === pendingReservation.id;
                        const actingApprove = actingOnPending && reservationAction?.type === "approve";
                        const actingDecline = actingOnPending && reservationAction?.type === "decline";

                        return (
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
                                    <div className="text-base sm:text-lg font-extrabold text-white truncate drop-shadow-[0_2px_8px_rgba(0,0,0,0.6)]" dir="auto">{it.title || t('events.untitled','Untitled')}</div>
                                    <div className="text-lg" aria-hidden>{desireEmoji((it as any).desire)}</div>
                                  </div>
                                  {(it as any)?.brand && (
                                    <div className="mt-0.5 text-xs text-white/90 truncate drop-shadow-[0_2px_6px_rgba(0,0,0,0.5)]" dir="auto">{(it as any).brand}</div>
                                  )}
                                  {it.description && (
                                    <div className="mt-1 text-sm text-white/95 line-clamp-4 drop-shadow-[0_2px_6px_rgba(0,0,0,0.5)]" dir="auto">{it.description}</div>
                                  )}
                                  {it.item_url && (
                                    <a href={it.item_url} target="_blank" rel="noreferrer" className="mt-1 inline-block text-[11px] text-blue-200 underline">
                                      {t('giftr.view_link', 'View link')}
                                    </a>
                                  )}
                                  {itemSocialCounts[it.id] && (itemSocialCounts[it.id].likes > 0 || itemSocialCounts[it.id].comments > 0) && (
                                    <div className="mt-2 flex items-center gap-3 text-xs text-white/80">
                                      {itemSocialCounts[it.id].likes > 0 && (
                                        <div className="flex items-center gap-1">
                                          <Heart className="h-3.5 w-3.5 fill-[#be123c] text-[#be123c]" />
                                          <span>{itemSocialCounts[it.id].likes}</span>
                                        </div>
                                      )}
                                      {itemSocialCounts[it.id].comments > 0 && (
                                        <div className="flex items-center gap-1">
                                          <MessageCircle className="h-3.5 w-3.5 text-blue-400" />
                                          <span>{itemSocialCounts[it.id].comments}</span>
                                        </div>
                                      )}
                                    </div>
                                  )}
                                  {approvedReservation && (
                                    <Badge variant="secondary" className="mt-2 bg-white/90 text-emerald-700 flex items-center gap-1">
                                      <Check className="h-3 w-3" />
                                      {t('wishlist_detail.claimed_by_badge', 'Claimed by {{name}}', { name: getClaimerName(approvedReservation) })}
                                    </Badge>
                                  )}
                                  {!isOwner && hasPending && (
                                    <Badge variant="secondary" className="mt-2 bg-white/80 text-amber-700">
                                      {t('wishlist_detail.pending_claim_badge', 'Pending approval')}
                                    </Badge>
                                  )}
                                  <div className={`mt-2 flex items-center gap-2 ${isAr ? 'justify-end' : ''}`}>
                                    {isGifterMode ? (
                                      (owner?.allow_friends_claim ?? true) ? (
                                    <Button
                                      size="sm"
                                      className="h-8 px-3"
                                      disabled={isClaimedItem || hasPending}
                                      onClick={() => {
                                        toast.message(t('giftr.cta_title','Want to send a message or claim an item?'), {
                                          description: t('giftr.cta_sub','See your friends\' wishlists too.'),
                                          action: { label: t('giftr.cta_signup','Sign up'), onClick: () => navigate('/signup') },
                                          cancel: { label: t('giftr.cta_login','Log in'), onClick: () => navigate('/login') },
                                        } as any);
                                      }}
                                    >
                                      {isClaimedItem
                                        ? (isAr ? 'تم الحجز' : t('giftr.claimed_btn', 'Claimed'))
                                        : hasPending
                                          ? t('wishlist_detail.pending_claim_badge', 'Pending approval')
                                          : (isAr ? 'حجز' : t('giftr.claim_btn', 'Claim'))}
                                    </Button>
                                      ) : null
                                    ) : fromFriendsTab ? (
                                      (owner?.allow_friends_claim ?? true) ? (
                                    <Button
                                      size="sm"
                                      className="h-8 px-3"
                                      disabled={isClaimedItem || hasPending}
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
                                      {isClaimedItem
                                        ? (isAr ? 'تم الحجز' : t('giftr.claimed_btn', 'Claimed'))
                                        : hasPending
                                          ? t('wishlist_detail.pending_claim_badge', 'Pending approval')
                                          : (isAr ? 'حجز' : t('giftr.claim_btn','Claim'))}
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
                                  {isOwner && pendingReservation && (
                                <div className="mt-3 rounded-xl bg-white/90 text-foreground px-3 py-3 space-y-3">
                                  <div className="flex items-center gap-3">
                                    <Avatar className="h-10 w-10">
                                      <AvatarImage src={pendingReservation.claimer?.avatar_url || undefined} alt={getClaimerName(pendingReservation)} />
                                      <AvatarFallback>{getClaimerName(pendingReservation).charAt(0)}</AvatarFallback>
                                    </Avatar>
                                    <div className="min-w-0">
                                      <div className="font-semibold truncate">{getClaimerName(pendingReservation)}</div>
                                      {pendingReservation.claimer?.username && (
                                        <div className="text-xs text-muted-foreground truncate">@{pendingReservation.claimer.username}</div>
                                      )}
                                      <div className="text-xs text-muted-foreground">
                                        {t('wishlist_detail.pending_request_since', 'Requested {{time}}', { time: formatClaimTime(pendingReservation.created_at) })}
                                      </div>
                                    </div>
                                  </div>
                                  <div className="flex justify-end gap-2 flex-wrap">
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      disabled={Boolean(actingOnPending)}
                                      onClick={() => pendingReservation.id && handleReservationAction(pendingReservation.id, 'decline')}
                                    >
                                      {actingDecline ? <Loader2 className="h-4 w-4 animate-spin" /> : t('notifications.decline', 'Decline')}
                                    </Button>
                                    <Button
                                      size="sm"
                                      disabled={Boolean(actingOnPending)}
                                      onClick={() => pendingReservation.id && handleReservationAction(pendingReservation.id, 'approve')}
                                    >
                                      {actingApprove ? <Loader2 className="h-4 w-4 animate-spin" /> : t('notifications.approve', 'Approve')}
                                    </Button>
                                  </div>
                                </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          </CarouselItem>
                        );
                      })}
                    </CarouselContent>
                    <CarouselPrevious className={`absolute bg-black/20 border-none text-white hover:bg-black/40 z-10 ${isAr ? 'right-1 rotate-180' : 'left-1'}`} />
                    <CarouselNext className={`absolute bg-black/20 border-none text-white hover:bg-black/40 z-10 ${isAr ? 'left-1 rotate-180' : 'right-1'}`} />
                  </Carousel>
                  <div className="mt-2 text-center text-[11px] text-white/90 relative z-10">
                    {slide + 1}/{items.length}
                  </div>
                  {items.length > 1 && (
                    <div className="mt-2 flex justify-center relative z-10">
                      <span className="inline-flex items-center justify-center gap-1 px-3 py-0.5 rounded-full bg-black/20 border border-white/20 shadow-sm backdrop-blur-sm">
                        <span className="tracking-wide text-[10px] text-white/90">{isAr ? "< اسحب >" : "< Swipe >"}</span>
                        <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true" className="text-white/90">
                          <g>
                            <animateTransform attributeName="transform" type="translate" dur="1.5s" values="0 0; 3 0; 0 0" repeatCount="indefinite" />
                            <text x="2" y="11" fontSize="10" fill="currentColor">🤚</text>
                          </g>
                        </svg>
                      </span>
                    </div>
                  )}
                  {isGifterMode && items.length > 1 && (
                    <div className="mt-4 flex justify-center gap-1.5 text-white/85 relative z-10">
                      <span className="h-1.5 w-1.5 rounded-full bg-white/40" />
                      <span className="h-1.5 w-1.5 rounded-full bg-white" />
                      <span className="h-1.5 w-1.5 rounded-full bg-white/40" />
                    </div>
                  )}
                  </>
                ) : (
                  <p className="text-sm opacity-80 mt-1">{t('wishlist_detail.no_items', 'No items yet.')}</p>
                )}
                </>
                )}

                {activeTab === 'activity' && (
                  <div className="mt-2 space-y-4 text-sm">
                    <div>
                      <h4 className="text-xs font-semibold uppercase tracking-wide text-white/70 mb-1">
                        {t('wishlist_detail.activity_likes', 'Likes')}
                      </h4>
                      {wishlistLikes.length === 0 ? (
                        <p className="text-xs text-white/80">
                          {t('wishlist_detail.activity_likes_empty', 'No likes yet.')}
                        </p>
                      ) : (
                        <div className="flex flex-wrap items-center gap-2">
                          {wishlistLikes.map((row: any) => {
                            const prof = row.user_profiles as any;
                            const name = prof?.full_name || prof?.username || row.user_id;
                            return (
                              <div key={row.user_id} className="flex items-center gap-2 rounded-full bg-black/20 px-2 py-1">
                                <Avatar className="h-6 w-6 ring-1 ring-white/70">
                                  <AvatarImage src={prof?.avatar_url || ''} />
                                  <AvatarFallback className="text-[10px] bg-gradient-to-br from-[hsl(var(--brand-cool-start))] via-[hsl(var(--brand-cool-end))] to-[hsl(var(--brand-warm-end))] text-white">
                                    {name?.toString().charAt(0).toUpperCase()}
                                  </AvatarFallback>
                                </Avatar>
                                <span className="text-xs text-white/90 max-w-[120px] truncate">{name}</span>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    <div>
                      <h4 className="text-xs font-semibold uppercase tracking-wide text-white/70 mb-1">
                        {t('wishlist_detail.activity_comments', 'Comments')}
                      </h4>
                      {wishlistComments.length === 0 ? (
                        <p className="text-xs text-white/80">
                          {t('wishlist_detail.activity_comments_empty', 'No comments yet.')}
                        </p>
                      ) : (
                        <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                          {wishlistComments.map((c: any) => {
                            const prof = c.user_profiles as any;
                            const name = prof?.full_name || prof?.username || c.user_id || 'User';
                            return (
                              <div key={c.id} className="flex items-start gap-2 text-xs bg-black/15 rounded-xl px-2 py-1.5">
                                <Avatar className="h-6 w-6 mt-0.5">
                                  <AvatarImage src={prof?.avatar_url || ''} />
                                  <AvatarFallback className="text-[10px] bg-gradient-to-br from-[hsl(var(--brand-cool-start))] via-[hsl(var(--brand-cool-end))] to-[hsl(var(--brand-warm-end))] text-white">
                                    {name?.toString().charAt(0).toUpperCase()}
                                  </AvatarFallback>
                                </Avatar>
                                <div className="flex-1 min-w-0">
                                  <div className="font-semibold leading-tight truncate">{name}</div>
                                  <div className="leading-snug text-white/90 break-words">{c.content}</div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
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
      </div>
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
  );
};

export default WishlistDetail;

