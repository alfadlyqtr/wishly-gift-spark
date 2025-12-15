import { useMemo, useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar, Pencil, Trash2, Loader2, Hourglass, Check, Users, Globe2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import WishlistStack from "@/components/wishes/WishlistStack";
import CreateWishlistModal from "@/components/wishes/CreateWishlistModal";
import FriendEventsList, { FriendEventsListFriend } from "@/components/events/FriendEventsList";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import AddButton from "@/components/AddButton";
import ReactCountryFlag from "react-country-flag";
import { useProfileData } from "@/hooks/use-profile";
import BackButton from "@/components/BackButton";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Carousel, CarouselContent, CarouselItem, CarouselPrevious, CarouselNext, type CarouselApi } from "@/components/ui/carousel";
import { toast } from "sonner";
import { approveReservation, declineReservation, requestUnclaim, approveUnclaim, declineUnclaim } from "@/lib/reservations";
// General events will be filtered by user's country and is_public_holiday

type MyEvent = {
  id: string;
  title: string | null;
  event_date: string | null;
  user_id: string;
  privacy_level: string | null;
  description: string | null;
};

type PublicEvent = any;

type FriendProfileRow = {
  id: string;
  username: string | null;
  full_name: string | null;
  avatar_url: string | null;
  allow_followers_view: boolean | null;
  enforce_wishlist_privacy: boolean | null;
};

type FriendWishlistItem = {
  id: string;
  title: string | null;
  description: string | null;
  image_url: string | null;
  item_url: string | null;
  brand?: string | null;
  desire?: number | null;
};

type FriendWishlistPreviewPayload = {
  wishlist: {
    id: string;
    user_id: string;
    title: string | null;
    event_date: string | null;
    description: string | null;
    owner?: {
      full_name?: string | null;
      username?: string | null;
      avatar_url?: string | null;
      allow_friends_claim?: boolean | null;
      show_countdown_timer?: boolean | null;
    } | null;
  } | null;
  items: FriendWishlistItem[];
};

type PendingReservation = {
  id: string;
  created_at: string | null;
  itemId: string;
  itemTitle: string | null;
  wishlistId: string | null;
  wishlistTitle: string | null;
  claimer: {
    id: string | null;
    name: string;
    username: string | null;
    avatarUrl: string | null;
  };
};

const pendingReservationsKey = ["wishlist-reservations", "pending"] as const;

const resolveCountryCode = (input?: string | null): string | null => {
  if (!input) return null;
  const raw = input.toString().trim();
  if (!raw) return null;
  if (/^[a-zA-Z]{2}$/.test(raw)) return raw.toUpperCase();
  const n = raw.toLowerCase();
  const map: Record<string, string> = {
    // GCC & MENA core
    qatar: "QA",
    "state of qatar": "QA",
    "saudi arabia": "SA",
    saudia: "SA",
    "saudia arabia": "SA",
    ksa: "SA",
    "kingdom of saudi arabia": "SA",
    "united arab emirates": "AE",
    uae: "AE",
    emirates: "AE",
    dubai: "AE",
    bahrain: "BH",
    kuwait: "KW",
    q8: "KW",
    oman: "OM",
    "sultanate of oman": "OM",
    egypt: "EG",
    "arab republic of egypt": "EG",
    jordan: "JO",
    "hashemite kingdom of jordan": "JO",
    lebanon: "LB",
    iraq: "IQ",
    syria: "SY",
    "syrian arab republic": "SY",
    yemen: "YE",
    "state of palestine": "PS",
    palestine: "PS",
    "west bank": "PS",

    // North Africa
    morocco: "MA",
    "kingdom of morocco": "MA",
    algeria: "DZ",
    tunisia: "TN",
    libya: "LY",
    sudan: "SD",

    // Europe
    france: "FR",
    germany: "DE",
    spain: "ES",
    italy: "IT",
    "united kingdom": "GB",
    uk: "GB",
    "great britain": "GB",
    england: "GB",
    scotland: "GB",
    wales: "GB",
    "northern ireland": "GB",
    ireland: "IE",
    "republic of ireland": "IE",
    netherlands: "NL",
    holland: "NL",
    belgium: "BE",
    switzerland: "CH",
    austria: "AT",
    sweden: "SE",
    norway: "NO",
    denmark: "DK",
    finland: "FI",
    iceland: "IS",
    portugal: "PT",
    greece: "GR",
    poland: "PL",
    romania: "RO",
    bulgaria: "BG",
    croatia: "HR",
    serbia: "RS",
    "czech republic": "CZ",
    czechia: "CZ",
    slovakia: "SK",
    slovenia: "SI",
    hungary: "HU",
    "bosnia and herzegovina": "BA",
    albania: "AL",
    macedonia: "MK",
    "north macedonia": "MK",
    estonia: "EE",
    latvia: "LV",
    lithuania: "LT",

    // Americas
    canada: "CA",
    "united states": "US",
    "united states of america": "US",
    usa: "US",
    us: "US",
    america: "US",
    mexico: "MX",
    brazil: "BR",
    argentina: "AR",
    chile: "CL",
    peru: "PE",
    colombia: "CO",
    venezuela: "VE",
    uruguay: "UY",
    paraguay: "PY",
    bolivia: "BO",
    ecuador: "EC",
    panama: "PA",
    "costa rica": "CR",
    guatemala: "GT",
    honduras: "HN",
    nicaragua: "NI",
    salvador: "SV",
    "el salvador": "SV",
    "dominican republic": "DO",
    jamaica: "JM",
    cuba: "CU",
    haiti: "HT",
    "puerto rico": "PR",

    // Asia
    india: "IN",
    pakistan: "PK",
    bangladesh: "BD",
    sri_lanka: "LK",
    "sri lanka": "LK",
    nepal: "NP",
    bhutan: "BT",
    maldives: "MV",
    china: "CN",
    "people's republic of china": "CN",
    taiwan: "TW",
    "hong kong": "HK",
    macau: "MO",
    japan: "JP",
    "south korea": "KR",
    korea: "KR",
    "republic of korea": "KR",
    "north korea": "KP",
    "democratic people's republic of korea": "KP",
    singapore: "SG",
    malaysia: "MY",
    thailand: "TH",
    vietnam: "VN",
    laos: "LA",
    cambodia: "KH",
    indonesia: "ID",
    philippines: "PH",
    "united arab emirates (uae)": "AE",

    // Africa (selected)
    nigeria: "NG",
    ghana: "GH",
    kenya: "KE",
    tanzania: "TZ",
    uganda: "UG",
    rwanda: "RW",
    ethiopia: "ET",
    somalia: "SO",
    senegal: "SN",
    "south africa": "ZA",
    "cote d'ivoire": "CI",
    "côte d'ivoire": "CI",
    cameroon: "CM",
    "democratic republic of the congo": "CD",
    "dr congo": "CD",
    congo: "CG",

    // Oceania
    australia: "AU",
    "new zealand": "NZ",
    "new caledonia": "NC",
    fiji: "FJ",
    samoa: "WS",
    "papua new guinea": "PG",

    // Generic / aliases
    "holy see": "VA",
    "vatican city": "VA",
  };
  return map[n] ?? null;
};

function useMyEvents() {
  return useQuery({
    queryKey: ["events", "me"],
    queryFn: async (): Promise<MyEvent[]> => {
      const { data: auth } = await supabase.auth.getUser();
      const user = auth.user;
      if (!user) return [];
      const { data, error } = await supabase
        .from("wishlists")
        .select("id, title, event_date, user_id, privacy_level, description")
        .eq("user_id", user.id)
        .not("event_date", "is", null)
        .order("event_date", { ascending: true });
      if (error) return [];
      return (data ?? []) as MyEvent[];
    },
    staleTime: 60_000,
  });
}

// Removed live AI fallback; backend Edge Function will populate DB periodically

function useFriendsEvents() {
  return useQuery({
    queryKey: ["events", "friends"],
    queryFn: async (): Promise<FriendEventsListFriend[]> => {
      const { data: auth } = await supabase.auth.getUser();
      const user = auth.user;
      if (!user) return [];

      const { data: followingRows, error: relErr } = await supabase
        .from("followers")
        .select("following_id, status")
        .eq("user_id", user.id)
        .eq("status", "accepted");
      if (relErr || !followingRows || followingRows.length === 0) return [];

      const followingIds = followingRows.map((row) => row.following_id as string);
      if (followingIds.length === 0) return [];

      const { data: reciprocalRows } = await supabase
        .from("followers")
        .select("user_id")
        .eq("status", "accepted")
        .eq("following_id", user.id)
        .in("user_id", followingIds);

      const mutualIds = new Set<string>((reciprocalRows ?? []).map((row) => row.user_id as string));

      const profileResponse = await (supabase as any)
        .from("user_profiles")
        .select("id, username, full_name, avatar_url, allow_followers_view, enforce_wishlist_privacy")
        .in("id", followingIds);
      const profileRows = (profileResponse?.data as any[]) ?? [];
      const profileErr = profileResponse?.error as Error | null;

      let fallbackWithoutPrefs = false;
      let resolvedProfileRows: any[] = profileRows ?? [];

      if (profileErr) {
        const missingPrefColumns = profileErr.message?.includes("allow_followers_view") || profileErr.message?.includes("enforce_wishlist_privacy");
        if (missingPrefColumns) {
          const fallbackResponse = await (supabase as any)
            .from("user_profiles")
            .select("id, username, full_name, avatar_url")
            .in("id", followingIds);
          const fallbackRows = (fallbackResponse?.data as any[]) ?? [];
          const fallbackErr = fallbackResponse?.error as Error | null;
          if (fallbackErr) return [];
          resolvedProfileRows = fallbackRows ?? [];
          fallbackWithoutPrefs = true;
        } else {
          return [];
        }
      }

      const profileMap = new Map<string, FriendProfileRow>();
      (resolvedProfileRows ?? []).forEach((row) => {
        profileMap.set(row.id, row as FriendProfileRow);
      });

      const visibilityPrefs = new Map<string, { allowFollowersView: boolean; respectPerWishlist: boolean }>();

      const friendMap = new Map<string, FriendEventsListFriend>();
      for (const id of followingIds) {
        const profile = profileMap.get(id);
        const username = profile?.username?.trim();
        const displayName = profile?.full_name?.trim() || username || "Friend";
        const allowFollowersView = !fallbackWithoutPrefs && Boolean(profile?.allow_followers_view);
        const respectPerWishlist = fallbackWithoutPrefs
          ? true
          : profile?.enforce_wishlist_privacy !== false && !allowFollowersView;
        visibilityPrefs.set(id, {
          allowFollowersView,
          respectPerWishlist,
        });
        friendMap.set(id, {
          friendId: id,
          avatarUrl: profile?.avatar_url ?? null,
          displayName,
          handle: username ? `@${username}` : displayName,
          wishlists: [],
        });
      }

      const { data, error } = await supabase
        .from("wishlists")
        .select("id, title, event_date, user_id, privacy_level, description")
        .in("user_id", followingIds)
        .not("event_date", "is", null)
        .order("event_date", { ascending: true });

      if (error) return [];

      for (const wl of (data ?? []) as MyEvent[]) {
        if (!wl.event_date) continue;
        const prefs = visibilityPrefs.get(wl.user_id) ?? { allowFollowersView: false, respectPerWishlist: true };
        const shouldRespectPrivacy = prefs.respectPerWishlist || !prefs.allowFollowersView;

        if (shouldRespectPrivacy) {
          const requiresMutual = wl.privacy_level === "private" || wl.privacy_level === "friends_only";
          if (requiresMutual && !mutualIds.has(wl.user_id)) continue;
        }

        const targetFriend = friendMap.get(wl.user_id);
        if (!targetFriend) continue;

        targetFriend.wishlists.push({
          id: wl.id,
          title: wl.title,
          event_date: wl.event_date,
          description: wl.description,
        });
      }

      return Array.from(friendMap.values()).sort((a, b) =>
        a.displayName.localeCompare(b.displayName, undefined, { sensitivity: "base" })
      );
    },
    staleTime: 60_000,
  });
}

function usePublicEvents() {
  return useQuery({
    queryKey: ["events", "public"],
    queryFn: async (): Promise<PublicEvent[]> => {
      try {
        const { data: auth } = await supabase.auth.getUser();
        const user = auth.user;

        const resolveCountryCode = (input?: string | null): string | null => {
          if (!input) return null;
          const raw = input.toString().trim();
          if (!raw) return null;
          if (/^[a-zA-Z]{2}$/.test(raw)) return raw.toUpperCase();
          const n = raw.toLowerCase();
          const map: Record<string, string> = {
            // GCC & MENA core
            qatar: "QA",
            "state of qatar": "QA",
            "saudi arabia": "SA",
            ksa: "SA",
            "kingdom of saudi arabia": "SA",
            "united arab emirates": "AE",
            uae: "AE",
            dubai: "AE",
            bahrain: "BH",
            kuwait: "KW",
            oman: "OM",
            "sultanate of oman": "OM",
            egypt: "EG",
            "arab republic of egypt": "EG",
            jordan: "JO",
            "hashemite kingdom of jordan": "JO",
            lebanon: "LB",
            iraq: "IQ",
            syria: "SY",
            "syrian arab republic": "SY",
            yemen: "YE",
            "state of palestine": "PS",
            palestine: "PS",
            "west bank": "PS",

            // North Africa
            morocco: "MA",
            "kingdom of morocco": "MA",
            algeria: "DZ",
            tunisia: "TN",
            libya: "LY",
            sudan: "SD",

            // Europe
            france: "FR",
            germany: "DE",
            spain: "ES",
            italy: "IT",
            "united kingdom": "GB",
            uk: "GB",
            "great britain": "GB",
            england: "GB",
            scotland: "GB",
            wales: "GB",
            "northern ireland": "GB",
            ireland: "IE",
            "republic of ireland": "IE",
            netherlands: "NL",
            holland: "NL",
            belgium: "BE",
            switzerland: "CH",
            austria: "AT",
            sweden: "SE",
            norway: "NO",
            denmark: "DK",
            finland: "FI",
            iceland: "IS",
            portugal: "PT",
            greece: "GR",
            poland: "PL",
            romania: "RO",
            bulgaria: "BG",
            croatia: "HR",
            serbia: "RS",
            "czech republic": "CZ",
            czechia: "CZ",
            slovakia: "SK",
            slovenia: "SI",
            hungary: "HU",
            "bosnia and herzegovina": "BA",
            albania: "AL",
            macedonia: "MK",
            "north macedonia": "MK",
            estonia: "EE",
            latvia: "LV",
            lithuania: "LT",

            // Americas
            canada: "CA",
            "united states": "US",
            "united states of america": "US",
            usa: "US",
            us: "US",
            america: "US",
            mexico: "MX",
            brazil: "BR",
            argentina: "AR",
            chile: "CL",
            peru: "PE",
            colombia: "CO",
            venezuela: "VE",
            uruguay: "UY",
            paraguay: "PY",
            bolivia: "BO",
            ecuador: "EC",
            panama: "PA",
            "costa rica": "CR",
            guatemala: "GT",
            honduras: "HN",
            nicaragua: "NI",
            salvador: "SV",
            "el salvador": "SV",
            "dominican republic": "DO",
            jamaica: "JM",
            cuba: "CU",
            haiti: "HT",
            "puerto rico": "PR",

            // Asia
            india: "IN",
            pakistan: "PK",
            bangladesh: "BD",
            sri_lanka: "LK",
            "sri lanka": "LK",
            nepal: "NP",
            bhutan: "BT",
            maldives: "MV",
            china: "CN",
            "people's republic of china": "CN",
            taiwan: "TW",
            "hong kong": "HK",
            macau: "MO",
            japan: "JP",
            "south korea": "KR",
            korea: "KR",
            "republic of korea": "KR",
            "north korea": "KP",
            "democratic people's republic of korea": "KP",
            singapore: "SG",
            malaysia: "MY",
            thailand: "TH",
            vietnam: "VN",
            laos: "LA",
            cambodia: "KH",
            indonesia: "ID",
            philippines: "PH",
            "united arab emirates (uae)": "AE",

            // Africa (selected)
            nigeria: "NG",
            ghana: "GH",
            kenya: "KE",
            tanzania: "TZ",
            uganda: "UG",
            rwanda: "RW",
            ethiopia: "ET",
            somalia: "SO",
            senegal: "SN",
            "south africa": "ZA",
            "cote d'ivoire": "CI",
            "côte d'ivoire": "CI",
            cameroon: "CM",
            "democratic republic of the congo": "CD",
            "dr congo": "CD",
            congo: "CG",

            // Oceania
            australia: "AU",
            "new zealand": "NZ",
            "new caledonia": "NC",
            fiji: "FJ",
            samoa: "WS",
            "papua new guinea": "PG",

            // Generic / aliases
            "holy see": "VA",
            "vatican city": "VA",
          };
          return map[n] ?? null;
        };

        let targetCountry: string | null = resolveCountryCode((user?.user_metadata as any)?.country);

        if (!targetCountry && user?.id) {
          const { data: profileRow } = await (supabase as any)
            .from("user_profiles")
            .select("country")
            .eq("id", user.id)
            .maybeSingle();
          targetCountry = resolveCountryCode((profileRow as any)?.country);
        }

        // If we still don't have a country after checking metadata and profile,
        // don't show any public holidays. The UI already instructs the user to
        // set their Country/Region first.
        if (!targetCountry) {
          return [];
        }

        const { data, error } = await (supabase as any)
          .from("events")
          .select("*")
          .eq("is_public_holiday", true)
          .eq("country_code", targetCountry)
          .order("date", { ascending: true });

        if (error) return [];
        const rows = (data ?? []) as any[];
        return rows;
      } catch {
        return [];
      }
    },
    staleTime: 60_000,
  });
}

const Events = () => {
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { data: myEvents, isLoading: loadingMy } = useMyEvents();
  const { data: friendsEvents, isLoading: loadingFriends } = useFriendsEvents();
  // Profile no longer needed for public holiday display
  const { data: publicEvents, isLoading: loadingPublic } = usePublicEvents();
  const [refreshing, setRefreshing] = useState(false);
  const [monthFilter, setMonthFilter] = useState<number | 'all'>('all');
  const { data: profileBundle } = useProfileData();
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [activeEventId, setActiveEventId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [cardSize, setCardSize] = useState<{ width: number; height: number }>({ width: 300, height: 170 });
  const [selectedFriendId, setSelectedFriendId] = useState<string | null>(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const friendParam = searchParams.get("friend");
  const [activeTab, setActiveTab] = useState<"mine" | "friends" | "public">(() =>
    friendParam ? "friends" : "mine"
  );
  const [friendsScrollNode, setFriendsScrollNode] = useState<HTMLDivElement | null>(null);
  const lastFriendsScrollRef = useRef(0);
  const lastSelectedFriendRef = useRef<string | null>(null);
  const shouldRestoreScrollRef = useRef(false);
  const [previewWishlistId, setPreviewWishlistId] = useState<string | null>(null);
  const [previewClaimedIds, setPreviewClaimedIds] = useState<Set<string>>(new Set());
  const [previewClaimingId, setPreviewClaimingId] = useState<string | null>(null);
  const [previewCarouselApi, setPreviewCarouselApi] = useState<CarouselApi | null>(null);
  const [previewSlide, setPreviewSlide] = useState(0);
  const [reservationAction, setReservationAction] = useState<{ id: string; type: "approve" | "decline" } | null>(null);
  const [previewUserReservations, setPreviewUserReservations] = useState<Map<string, { id: string; status: string }>>(new Map());
  const [previewAllReservations, setPreviewAllReservations] = useState<Map<string, { id: string; status: string; claimer_name: string; claimer_id: string }>>(new Map());
  const [previewUnclaimingId, setPreviewUnclaimingId] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  useEffect(() => {
    if (!friendsEvents || friendsEvents.length === 0) return;
    if (friendParam) {
      setActiveTab("friends");
    }
  }, [friendsEvents, friendParam]);

  const selectedFriend = useMemo(() => {
    if (!selectedFriendId || !friendsEvents) return null;
    return friendsEvents.find((f) => f.friendId === selectedFriendId) ?? null;
  }, [selectedFriendId, friendsEvents]);

  useEffect(() => {
    if (!friendsEvents) return;
    if (friendParam) {
      if (selectedFriendId === friendParam) return;
      const exists = friendsEvents.some((f) => f.friendId === friendParam);
      if (exists) {
        setSelectedFriendId(friendParam);
        setActiveTab("friends");
      }
    } else if (!friendParam && selectedFriendId) {
      setSelectedFriendId(null);
    }
  }, [friendParam, friendsEvents, selectedFriendId]);

  useEffect(() => {
    if (activeTab !== "friends" && selectedFriendId) {
      setSelectedFriendId(null);
      if (searchParams.has("friend")) {
        const next = new URLSearchParams(searchParams);
        next.delete("friend");
        setSearchParams(next, { replace: true });
      }
    }
  }, [activeTab, selectedFriendId, searchParams, setSearchParams]);

  const handleFriendSelect = (friendId: string) => {
    if (friendsScrollNode) {
      lastFriendsScrollRef.current = friendsScrollNode.scrollTop;
    }
    lastSelectedFriendRef.current = friendId;
    setSelectedFriendId(friendId);
    setActiveTab("friends");
    const next = new URLSearchParams(searchParams);
    next.set("friend", friendId);
    setSearchParams(next, { replace: true });
  };

  const handleFriendBack = () => {
    shouldRestoreScrollRef.current = true;
    setSelectedFriendId(null);
    setActiveTab("friends");
    if (searchParams.has("friend")) {
      const next = new URLSearchParams(searchParams);
      next.delete("friend");
      setSearchParams(next, { replace: true });
    }
  };

  const handleWishlistPreview = (wishlistId: string) => {
    setPreviewWishlistId(wishlistId);
  };

  useEffect(() => {
    if (selectedFriendId || !shouldRestoreScrollRef.current) return;
    let frame = requestAnimationFrame(() => {
      if (friendsScrollNode) {
        friendsScrollNode.scrollTop = lastFriendsScrollRef.current;
        if (lastSelectedFriendRef.current) {
          const target = friendsScrollNode.querySelector<HTMLButtonElement>(
            `[data-friend-id="${lastSelectedFriendRef.current}"]`
          );
          target?.focus();
        }
      }
      shouldRestoreScrollRef.current = false;
    });
    return () => cancelAnimationFrame(frame);
  }, [selectedFriendId, friendsScrollNode]);

  const today = useMemo(() => new Date(), []);
  const myEventsCount = useMemo(() => (myEvents?.length ?? 0), [myEvents]);

  const { data: pendingReservations = [], isLoading: pendingReservationsLoading } = useQuery<PendingReservation[]>({
    queryKey: pendingReservationsKey,
    queryFn: async () => {
      const { data: auth } = await supabase.auth.getUser();
      const userId = auth.user?.id;
      if (!userId) return [];
      const { data, error } = await (supabase as any)
        .from('wishlist_reservations')
        .select(`
          id,
          status,
          created_at,
          item_id,
          wishlist_items!inner (
            id,
            title,
            wishlist_id,
            wishlists!inner (
              id,
              title,
              user_id
            )
          ),
          reserved_by:user_profiles (
            id,
            full_name,
            username,
            avatar_url
          )
        `)
        .eq('status', 'pending')
        .eq('wishlist_items.wishlists.user_id', userId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []).map((row: any) => {
        const claimer = row?.reserved_by ?? {};
        const item = row?.wishlist_items ?? {};
        const wishlist = item?.wishlists ?? {};
        return {
          id: row.id as string,
          created_at: row.created_at ?? null,
          itemId: row.item_id as string,
          itemTitle: item?.title ?? null,
          wishlistId: item?.wishlist_id ?? wishlist?.id ?? null,
          wishlistTitle: wishlist?.title ?? null,
          claimer: {
            id: claimer?.id ?? null,
            name: claimer?.full_name || claimer?.username || 'Friend',
            username: claimer?.username ?? null,
            avatarUrl: claimer?.avatar_url ?? null,
          },
        } satisfies PendingReservation;
      });
    },
  });

  const { data: previewData, isLoading: previewLoading } = useQuery<FriendWishlistPreviewPayload | null>({
    queryKey: ["wishlist-preview", previewWishlistId],
    enabled: Boolean(previewWishlistId),
    queryFn: async () => {
      if (!previewWishlistId) return null;
      const [{ data: wl, error: wlErr }, { data: items, error: itemsErr }] = await Promise.all([
        (supabase as any)
          .from("wishlists")
          .select("id,user_id,title,description,event_date,owner:user_profiles(full_name,username,avatar_url,allow_friends_claim,show_countdown_timer)")
          .eq("id", previewWishlistId)
          .maybeSingle(),
        supabase
          .from("wishlist_items")
          .select("id,title,description,image_url,item_url,brand,desire")
          .eq("wishlist_id", previewWishlistId)
          .order("added_at", { ascending: false }),
      ]);
      if (wlErr) throw wlErr;
      if (itemsErr) throw itemsErr;
      const typedItems = ((items ?? []) as unknown) as FriendWishlistItem[];
      return {
        wishlist: wl as FriendWishlistPreviewPayload["wishlist"],
        items: typedItems,
      };
    },
  });

  const previewWishlist = previewData?.wishlist;
  const previewOwner = previewWishlist?.owner;
  const previewItems = previewData?.items ?? [];
  const previewOpen = Boolean(previewWishlistId);
  const previewEventDate = useMemo(() => {
    if (!previewWishlist?.event_date) return null;
    const d = new Date(previewWishlist.event_date);
    if (Number.isNaN(d.getTime())) return null;
    if (i18n.language === "ar") {
      return d.toLocaleDateString("ar-EG", {
        weekday: "long",
        day: "2-digit",
        month: "long",
        year: "numeric",
      });
    }
    return d.toLocaleDateString("en-GB", {
      weekday: "long",
      day: "2-digit",
      month: "long",
      year: "numeric",
    });
  }, [previewWishlist?.event_date, i18n.language]);
  const handleClosePreview = () => setPreviewWishlistId(null);

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
      await queryClient.invalidateQueries({ queryKey: pendingReservationsKey });
    } catch (err: any) {
      toast.error(err?.message || t('events.claim_action_error', 'Unable to update claim. Please try again.'));
    } finally {
      setReservationAction(null);
    }
  };

  useEffect(() => {
    if (!previewOpen) {
      setPreviewClaimingId(null);
      setPreviewUnclaimingId(null);
      setPreviewClaimedIds((prev) => (prev.size === 0 ? prev : new Set<string>()));
      setPreviewUserReservations(new Map());
      setPreviewAllReservations(new Map());
      setCurrentUserId(null);
    }
  }, [previewOpen]);

  useEffect(() => {
    if (!previewOpen) return;
    const itemIds = previewItems.map((item) => item.id).filter(Boolean);
    if (itemIds.length === 0) {
      setPreviewClaimedIds((prev) => (prev.size === 0 ? prev : new Set<string>()));
      setPreviewUserReservations(new Map());
      setPreviewAllReservations(new Map());
      setCurrentUserId(null);
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          if (!cancelled) {
            setPreviewClaimedIds((prev) => (prev.size === 0 ? prev : new Set<string>()));
            setPreviewUserReservations(new Map());
            setCurrentUserId(null);
          }
          return;
        }
        setCurrentUserId(user.id);
        const { data, error} = await (supabase as any)
          .from('wishlist_reservations')
          .select(`
            item_id, 
            id, 
            status, 
            reserved_by_id,
            reserved_by:user_profiles!wishlist_reservations_reserved_by_id_fkey (
              id,
              full_name,
              username
            )
          `)
          .in('item_id', itemIds);
        if (error) throw error;
        if (!cancelled) {
          const nextIds = new Set<string>((data || []).map((row: any) => String(row.item_id)));
          const userReservations = new Map<string, { id: string; status: string }>();
          const allReservations = new Map<string, { id: string; status: string; claimer_name: string; claimer_id: string }>();
          
          (data || []).forEach((row: any) => {
            const itemId = String(row.item_id);
            
            // Track current user's reservations
            if (row.reserved_by_id === user.id) {
              userReservations.set(itemId, { id: row.id, status: row.status });
            }
            
            // Track ALL approved reservations with claimer info
            if (row.status === 'approved') {
              const claimerName = row.reserved_by?.full_name || row.reserved_by?.username || 'Someone';
              allReservations.set(itemId, {
                id: row.id,
                status: row.status,
                claimer_name: claimerName,
                claimer_id: row.reserved_by_id
              });
            }
          });
          
          setPreviewClaimedIds((prev) => {
            if (prev.size === nextIds.size && Array.from(nextIds).every((id) => prev.has(id))) {
              return prev;
            }
            return nextIds;
          });
          setPreviewUserReservations(userReservations);
          setPreviewAllReservations(allReservations);
        }
      } catch {
        if (!cancelled) {
          setPreviewClaimedIds((prev) => (prev.size === 0 ? prev : new Set<string>()));
          setPreviewUserReservations(new Map());
          setPreviewAllReservations(new Map());
          setCurrentUserId(null);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [previewOpen, previewItems]);

  const previewCountdown = useMemo(() => {
    if (!previewWishlist?.event_date) return null;
    const target = new Date(previewWishlist.event_date);
    if (Number.isNaN(target.getTime())) return null;
    const diff = target.getTime() - Date.now();
    if (diff <= 0) return null;
    const mins = Math.floor(diff / 60000);
    const days = Math.floor(mins / (60 * 24));
    const hours = Math.floor((mins % (60 * 24)) / 60);
    const minutes = mins % 60;
    if (days > 0) return `${days}d ${hours}h`;
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  }, [previewWishlist?.event_date]);

  const desireEmoji = (d?: number | null) => {
    const arr = ["😐","😌","🙂","😊","😍"] as const;
    const idx = typeof d === "number" ? Math.max(0, Math.min(4, d)) : 3;
    return arr[idx];
  };

  useEffect(() => {
    if (!previewCarouselApi) return;
    const onSelect = () => setPreviewSlide(previewCarouselApi.selectedScrollSnap());
    onSelect();
    previewCarouselApi.on("select", onSelect);
    return () => {
      try {
        previewCarouselApi.off("select", onSelect);
      } catch {}
    };
  }, [previewCarouselApi]);

  useEffect(() => {
    setPreviewSlide(0);
    if (previewCarouselApi) {
      try {
        previewCarouselApi.scrollTo(0, true);
      } catch {}
    }
  }, [previewItems.length, previewCarouselApi]);

  const handlePreviewClaim = async (itemId: string) => {
    if (!itemId) return;
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        if (previewWishlist?.user_id === user.id) {
          toast.error(t('giftr.claim_own_error','You cannot claim your own wish.'));
          return;
        }
        if (!(previewOwner?.allow_friends_claim ?? true)) {
          toast.error(t('giftr.claim_disabled','This friend has disabled claiming.'));
          return;
        }
        setPreviewClaimingId(itemId);
        try {
          const { error } = await (supabase as any)
            .from('wishlist_reservations')
            .insert({ item_id: itemId, reserved_by_id: user.id, is_anonymous: false, status: 'pending' });
          if (error) {
            if (error.code === '23505') {
              toast.info(t('giftr.claim_already','Looks like someone already claimed this item.'));
            } else {
              throw error;
            }
          } else {
            setPreviewClaimedIds((prev) => new Set(prev).add(itemId));
            if (previewWishlist?.user_id && previewWishlist.user_id !== user.id) {
              await supabase.from('activities').insert({
                user_id: previewWishlist.user_id,
                activity_type: 'wish_claimed',
                target_id: user.id,
              } as any);
            }
            toast.success(t('giftr.claim_success','Claim request sent — waiting for approval'));
          }
        } catch (err: any) {
          if (!err?.code || err.code !== '23505') {
            toast.error(err?.message || t('giftr.error','Something went wrong'));
          }
        } finally {
          setPreviewClaimingId(null);
        }
        return;
      }
    } catch {
      toast.error(t('giftr.error','Something went wrong'));
      return;
    }

    toast.message(t('giftr.cta_title','Want to send a message or claim an item?'), {
      description: t('giftr.cta_sub',"See your friends' wishlists too."),
      action: { label: t('giftr.cta_signup','Sign up'), onClick: () => navigate('/signup') },
      cancel: { label: t('giftr.cta_login','Log in'), onClick: () => navigate('/login') },
    } as any);
  };

  const handlePreviewUnclaim = async (itemId: string) => {
    if (!itemId) return;
    const reservation = previewUserReservations.get(itemId);
    if (!reservation) return;
    
    setPreviewUnclaimingId(itemId);
    try {
      const result = await requestUnclaim(reservation.id);
      
      if (result.autoApproved) {
        // Auto-approved, remove from UI
        setPreviewClaimedIds((prev) => {
          const next = new Set(prev);
          next.delete(itemId);
          return next;
        });
        setPreviewUserReservations((prev) => {
          const next = new Map(prev);
          next.delete(itemId);
          return next;
        });
        toast.success(t('giftr.unclaim_success', 'Claim removed'));
      } else {
        // Pending approval, update status
        setPreviewUserReservations((prev) => {
          const next = new Map(prev);
          next.set(itemId, { id: reservation.id, status: 'unclaim_requested' });
          return next;
        });
        toast.success(t('giftr.unclaim_requested', 'Unclaim request sent — waiting for approval'));
      }
    } catch (err: any) {
      toast.error(err?.message || t('giftr.error', 'Something went wrong'));
    } finally {
      setPreviewUnclaimingId(null);
    }
  };

  const eventBadge = (title?: string | null) => {
    const t = (title || '').toLowerCase();
    let glyph = '📅';
    if (/birth/.test(t)) glyph = '🎂';
    else if (/party|celebrat/.test(t)) glyph = '🎉';
    else if (/meet|coffee|dinner/.test(t)) glyph = '🗓️';
    return (
      <span
        className="inline-flex h-8 w-8 items-center justify-center rounded-xl text-base text-white shadow-[0_8px_18px_rgba(200,80,192,0.28)] ring-1 ring-white/50 bg-gradient-to-br from-[hsl(var(--brand-warm-end))] via-[hsl(var(--brand-cool-end))] to-[hsl(var(--brand-cool-start))]"
        aria-hidden="true"
      >
        {glyph}
      </span>
    );
  };

  useEffect(() => {
    (async () => {
      const dobIso = profileBundle?.profile?.dob as string | null | undefined;
      if (!dobIso) return;
      const { data: auth } = await supabase.auth.getUser();
      const user = auth.user;
      if (!user) return;
      const dob = new Date(dobIso);
      if (isNaN(dob.getTime())) return;
      const now = new Date();
      const targetYear = (now.getMonth() > dob.getMonth() || (now.getMonth() === dob.getMonth() && now.getDate() > dob.getDate())) ? now.getFullYear() + 1 : now.getFullYear();
      const nextBirthday = new Date(targetYear, dob.getMonth(), dob.getDate());
      const yyyy = nextBirthday.getFullYear();
      const mm = String(nextBirthday.getMonth() + 1).padStart(2, '0');
      const dd = String(nextBirthday.getDate()).padStart(2, '0');
      const nextBirthdayIso = `${yyyy}-${mm}-${dd}`;
      const title = 'My Birthday Wishlist';
      const { data: exists, error: selErr } = await (supabase as any)
        .from('wishlists')
        .select('id, event_date, privacy_level')
        .eq('user_id', user.id)
        .eq('title', title)
        .limit(1);
      if (selErr) return;
      if (exists && exists.length > 0) {
        const current = exists[0];
        const needsDateUpdate = (current as any)?.event_date !== nextBirthdayIso;
        const needsPrivacyUpdate = (current as any)?.privacy_level !== 'friends_only';
        if (needsDateUpdate || needsPrivacyUpdate) {
          await (supabase as any)
            .from('wishlists')
            .update({ event_date: nextBirthdayIso, description: 'My Birthday Wishlist', privacy_level: 'friends_only' })
            .eq('id', (current as any).id);
        }
      } else {
        await (supabase as any)
          .from('wishlists')
          .insert({
            user_id: user.id,
            title,
            description: 'My Birthday Wishlist',
            event_date: nextBirthdayIso,
            privacy_level: 'friends_only'
          });
      }
      await queryClient.invalidateQueries({ queryKey: ['events', 'me'] });
    })();
  }, [profileBundle?.profile?.dob, queryClient]);

  // Responsive card size for mobile-first view
  useEffect(() => {
    const compute = () => {
      const vw = typeof window !== 'undefined' ? Math.min(window.innerWidth, 480) : 360;
      const pad = vw < 380 ? 24 : 32; // mirror container paddings
      const width = Math.max(260, Math.min(340, vw - pad * 2));
      const height = Math.round(width * 0.57);
      setCardSize({ width, height });
    };
    compute();
    window.addEventListener('resize', compute);
    return () => window.removeEventListener('resize', compute);
  }, []);

  return (
    <div className="container mx-auto max-w-md px-3 py-4 space-y-4 sm:max-w-2xl sm:px-4 sm:py-6 sm:space-y-6">
      <div className="flex items-center gap-3">
        <div className="relative inline-flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[hsl(var(--brand-cool-start))] via-[hsl(var(--brand-cool-end))] to-[hsl(var(--brand-warm-end))] shadow-[0_12px_30px_rgba(200,80,192,0.45)] ring-1 ring-white/40">
          <Calendar className="h-4 w-4 sm:h-5 sm:w-5 text-white drop-shadow" />
          <span className="absolute -inset-1 rounded-[14px] blur-md bg-gradient-to-br from-[hsl(var(--brand-warm-end))]/20 to-[hsl(var(--brand-cool-end))]/10" aria-hidden="true" />
        </div>
        <h2 
          className="text-xl sm:text-2xl font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-[hsl(var(--brand-cool-start))] via-[hsl(var(--brand-cool-end))] to-[hsl(var(--brand-warm-end))] drop-shadow-[0_1px_1px_rgba(0,0,0,0.6)]"
          style={{ WebkitTextStroke: '0.5px rgba(0,0,0,0.85)' }}
        >
          {t('events.title', 'Events')}
        </h2>
      </div>

      <Tabs value={activeTab} onValueChange={(val) => setActiveTab(val as "mine" | "friends" | "public")} className="w-full">
        <div className="mx-auto w-full max-w-md">
          <div className="relative mx-auto rounded-full p-[2px] bg-gradient-to-r from-[hsl(var(--brand-cool-start))] via-[hsl(var(--brand-cool-end))] to-[hsl(var(--brand-warm-end))] shadow-[0_12px_28px_rgba(0,0,0,0.10)]">
            <TabsList className="relative flex w-full items-center rounded-full bg-white/70 backdrop-blur px-1 py-1 ring-1 ring-white/70 shadow-[inset_0_1px_3px_rgba(255,255,255,0.55),_0_6px_14px_rgba(0,0,0,0.06)] overflow-hidden h-10 sm:h-11">
              <span className="pointer-events-none absolute inset-x-6 -top-1 h-5 rounded-full bg-white/60 blur-md opacity-60" />
              <span
                className="pointer-events-none absolute top-1 bottom-1 rounded-full p-[1px] bg-gradient-to-r from-[hsl(var(--brand-cool-start))]/40 via-[hsl(var(--brand-cool-end))]/35 to-[hsl(var(--brand-warm-end))]/40 shadow-[0_6px_16px_rgba(200,80,192,0.14)] transition-all duration-300 ease-out z-0"
                style={{
                  width: '33.3333%',
                  left:
                    activeTab === 'mine'
                      ? '0%'
                      : activeTab === 'friends'
                      ? '33.3333%'
                      : '66.6666%',
                }}
              >
                <span className="absolute inset-0 rounded-full ring-1 ring-white/60" />
                <span className="relative block h-full w-full rounded-full bg-white/20 backdrop-blur-[2px] shadow-[inset_0_1px_3px_rgba(255,255,255,0.6),_0_4px_10px_rgba(0,0,0,0.06)]" />
              </span>
              <TabsTrigger
                value="mine"
                className="relative z-10 flex-1 rounded-full px-3 py-2 text-[11px] sm:text-sm font-semibold transition-colors duration-200 flex items-center justify-center gap-1 data-[state=active]:bg-transparent data-[state=active]:text-foreground data-[state=inactive]:text-muted-foreground"
              >
                <Calendar className="h-4 w-4" />
                <span>{t('events.tab_my', 'My Events')}</span>
              </TabsTrigger>
              <TabsTrigger
                value="friends"
                className="relative z-10 flex-1 rounded-full px-3 py-2 text-[11px] sm:text-sm font-semibold transition-colors duration-200 flex items-center justify-center gap-1 data-[state=active]:bg-transparent data-[state=active]:text-foreground data-[state=inactive]:text-muted-foreground"
              >
                <Users className="h-4 w-4" />
                <span>{t('events.tab_friends', "Friends' Events")}</span>
              </TabsTrigger>
              <TabsTrigger
                value="public"
                className="relative z-10 flex-1 rounded-full px-3 py-2 text-[11px] sm:text-sm font-semibold transition-colors duration-200 flex items-center justify-center gap-1 data-[state=active]:bg-transparent data-[state=active]:text-foreground data-[state=inactive]:text-muted-foreground"
              >
                <Globe2 className="h-4 w-4" />
                <span>{t('events.tab_general', 'General Events')}</span>
              </TabsTrigger>
            </TabsList>
          </div>
        </div>

        <TabsContent value="mine" className="pt-4">
          <Card className="border-0 rounded-2xl ring-0 shadow-none bg-transparent sm:ring-1 sm:bg-gradient-to-br sm:from-[hsl(var(--brand-cool-start))]/10 sm:via-[hsl(var(--brand-cool-end))]/10 sm:to-[hsl(var(--brand-warm-end))]/10 sm:shadow-[0_18px_40px_rgba(0,0,0,0.20)] overflow-visible">
            <CardHeader className="pb-2 sm:pb-3">
              <div className="relative flex items-center justify-center">
                <div className="absolute left-0">
                  <CreateWishlistModal>
                    <AddButton ariaLabel="Add Wishlist" />
                  </CreateWishlistModal>
                </div>
                <CardTitle 
                  className="text-base sm:text-lg font-extrabold bg-gradient-to-r from-[hsl(var(--brand-cool-start))] via-[hsl(var(--brand-cool-end))] to-[hsl(var(--brand-warm-end))] bg-clip-text text-transparent drop-shadow-[0_1px_1px_rgba(0,0,0,0.6)]"
                  style={{ WebkitTextStroke: '0.5px rgba(0,0,0,0.85)' }}
                >
                  {t('events.tab_my', 'My Events')}
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent className="pt-2">
              {myEventsCount > 0 && (
                <>
                  <div className="w-full flex justify-center pt-16 pb-4 sm:pt-16 sm:pb-6 relative">
                    <WishlistStack
                      randomRotation={true}
                      sensitivity={180}
                      sendToBackOnClick={false}
                      cardDimensions={{ width: cardSize.width, height: cardSize.height }}
                      cards={(myEvents || []).map((e) => ({ id: e.id, title: e.title || 'Untitled' }))}
                      disableBirthdayOpen={!profileBundle?.profile?.dob}
                      className="-translate-x-4 sm:-translate-x-6"
                    />
                    {!profileBundle?.profile?.dob && (
                      <div className="pointer-events-none absolute -bottom-2 left-1/2 -translate-x-1/2 text-[11px] sm:text-xs text-muted-foreground/90">
                        <span className="inline-flex items-center gap-1 px-3 py-[3px] rounded-full bg-white/85 border border-white/80 shadow-sm">
                          <span>🎂</span>
                          <span>{t('events.birthday_overlay_chip', 'Add your birthday in Settings so we can keep this wishlist in sync.')}</span>
                        </span>
                      </div>
                    )}
                  </div>
                  {(myEvents?.length ?? 0) > 1 && (
                    <div className="absolute bottom-[-2.5rem] left-1/2 -translate-x-1/2 text-center text-[11px] text-muted-foreground z-10">
                      <span className="inline-flex items-center justify-center gap-1 px-4 py-[3px] rounded-full bg-muted/40 border border-border/60 shadow-sm">
                        <span className="tracking-wide text-[10px]">{"<"} Swipe cards {">"}</span>
                        <svg
                          width="16"
                          height="16"
                          viewBox="0 0 16 16"
                          aria-hidden="true"
                          className="overflow-visible"
                        >
                          <g>
                            <animateTransform
                              attributeName="transform"
                              type="translate"
                              dur="1.1s"
                              values="0 0; 3 0; 0 0"
                              repeatCount="indefinite"
                            />
                            <text
                              x="2"
                              y="11"
                              fontSize="10"
                            >
                              🤚
                            </text>
                          </g>
                        </svg>
                      </span>
                    </div>
                  )}
                </>
              )}
              {loadingMy ? (
                <p className="text-sm text-muted-foreground">{t('common.loading', 'Loading...')}</p>
              ) : myEventsCount === 0 ? (
                profileBundle?.profile?.dob ? (
                  <p className="text-sm text-muted-foreground">{t('events.empty_my', 'No upcoming events.')}</p>
                ) : (
                  <div className="space-y-4 py-4">
                    <div className="w-full flex justify-center">
                      <div
                        className="relative rounded-3xl shadow-[0_18px_40px_rgba(0,0,0,0.22)] border border-white/70 bg-gradient-to-br from-[hsl(var(--brand-warm-start))] via-[hsl(var(--brand-cool-end))] to-[hsl(var(--brand-cool-start))] overflow-hidden"
                        style={{ width: cardSize.width, height: cardSize.height }}
                      >
                        <div className="absolute inset-0 opacity-35 bg-[radial-gradient(circle_at_0_0,#ffffff_0,transparent_55%),radial-gradient(circle_at_100%_100%,#ffffff_0,transparent_55%)]" aria-hidden="true" />
                        <div className="relative z-10 h-full flex flex-col justify-between p-4">
                          <div className="flex items-center justify-between text-xs text-white/90">
                            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-black/20 backdrop-blur">
                              <span>🎂</span>
                              <span>{t('events.birthday_label', 'Birthday')}</span>
                            </span>
                          </div>
                          <div className="flex-1 flex items-center">
                            <h3 className="text-xl sm:text-2xl font-extrabold text-white drop-shadow-[0_2px_6px_rgba(0,0,0,0.6)]">
                              {t('events.default_birthday_title', 'My Birthday Wishlist')}
                            </h3>
                          </div>
                          <div className="flex items-center justify-between text-xs text-white/90">
                            <span className="inline-flex items-center gap-1">
                              <span>💡</span>
                              <span>{t('events.birthday_hint_short', 'Set your birthday to let Wishly celebrate with you.')}</span>
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="rounded-2xl bg-white/80 border border-white/70 px-4 py-3 text-xs sm:text-sm text-muted-foreground text-center">
                      <p className="font-medium mb-1">
                        {t('events.birthday_overlay_title', 'Let friends know when to celebrate you 🎉')}
                      </p>
                      <p>
                        {t('events.birthday_overlay_body', 'Add your Date of Birth in Settings so we can highlight your birthday and build this wishlist for you automatically.')}
                      </p>
                    </div>
                  </div>
                )
              ) : null}
            </CardContent>
          </Card>
          {(pendingReservationsLoading || pendingReservations.length > 0) && (
            <Card className="mt-6 border-0 rounded-2xl ring-1 ring-white/40 bg-white/70 backdrop-blur shadow-[0_18px_40px_rgba(0,0,0,0.08)]">
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-semibold">
                  {t('events.pending_claims_title', 'Pending claim requests')}
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                  {t('events.pending_claims_caption', 'Approve or decline to let friends know their claim status.')}
                </p>
              </CardHeader>
              <CardContent className="space-y-3">
                {pendingReservationsLoading ? (
                  <p className="text-sm text-muted-foreground">{t('common.loading', 'Loading...')}</p>
                ) : pendingReservations.length === 0 ? (
                  <p className="text-sm text-muted-foreground">{t('events.pending_claims_empty', 'No pending claims right now.')}</p>
                ) : (
                  pendingReservations.map((reservation) => {
                    const isActing = reservationAction?.id === reservation.id;
                    const actingApprove = isActing && reservationAction?.type === 'approve';
                    const actingDecline = isActing && reservationAction?.type === 'decline';
                    return (
                      <div
                        key={reservation.id}
                        className="rounded-2xl bg-white/80 border border-white/60 px-3 py-3 shadow-sm space-y-3"
                      >
                        <div className="flex items-start gap-3">
                          <Avatar className="h-10 w-10">
                            <AvatarImage src={reservation.claimer.avatarUrl || undefined} alt={reservation.claimer.name} />
                            <AvatarFallback>{reservation.claimer.name?.charAt(0) || 'F'}</AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2">
                              <div className="text-sm font-semibold truncate">
                                {reservation.claimer.name}
                                {reservation.claimer.username && (
                                  <span className="ml-1 text-xs text-muted-foreground truncate">
                                    @{reservation.claimer.username}
                                  </span>
                                )}
                              </div>
                              <span className="text-[11px] text-muted-foreground whitespace-nowrap">
                                {formatClaimTime(reservation.created_at)}
                              </span>
                            </div>
                            <div className="text-xs text-muted-foreground truncate">
                              {t('events.claim_request_item', 'Item: {{item}}', { item: reservation.itemTitle || t('events.untitled', 'Untitled') })}
                            </div>
                            <div className="text-xs text-muted-foreground truncate">
                              {t('events.claim_request_wishlist', 'Wishlist: {{wishlist}}', { wishlist: reservation.wishlistTitle || t('events.untitled', 'Untitled') })}
                            </div>
                          </div>
                        </div>
                        <div className="flex flex-wrap items-center justify-end gap-2">
                          {reservation.wishlistId && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => navigate(`/wishlist/${reservation.wishlistId}`)}
                            >
                              {t('events.view_wishlist', 'View wishlist')}
                            </Button>
                          )}
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={isActing}
                            onClick={() => handleReservationAction(reservation.id, 'decline')}
                          >
                            {actingDecline ? <Loader2 className="h-4 w-4 animate-spin" /> : t('notifications.decline', 'Decline')}
                          </Button>
                          <Button
                            size="sm"
                            disabled={isActing}
                            onClick={() => handleReservationAction(reservation.id, 'approve')}
                          >
                            {actingApprove ? <Loader2 className="h-4 w-4 animate-spin" /> : t('notifications.approve', 'Approve')}
                          </Button>
                        </div>
                      </div>
                    );
                  })
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="friends" className="pt-4">
          <Card className="border-0 rounded-2xl ring-1 ring-white/30 bg-gradient-to-br from-[#4158D0]/10 via-[#C850C0]/10 to-[#FFCC70]/10 shadow-[0_18px_40px_rgba(0,0,0,0.20)]">
            <CardHeader className="pb-3 flex items-center justify-between">
              {selectedFriend ? (
                <div className="flex items-center gap-3">
                  <Avatar className="h-16 w-16 ring-2 ring-white/60">
                    <AvatarImage src={selectedFriend.avatarUrl || undefined} alt={selectedFriend.displayName} />
                    <AvatarFallback>{selectedFriend.displayName?.charAt(0) || 'F'}</AvatarFallback>
                  </Avatar>
                  <div className="flex items-center gap-3 flex-wrap">
                    <CardTitle
                      className="text-lg font-extrabold bg-gradient-to-r from-[hsl(var(--brand-cool-start))] via-[hsl(var(--brand-cool-end))] to-[hsl(var(--brand-warm-end))] bg-clip-text text-transparent drop-shadow-[0_1px_1px_rgba(0,0,0,0.6)]"
                      style={{ WebkitTextStroke: '0.6px rgba(0,0,0,0.9)' }}
                    >
                      {selectedFriend.displayName}
                    </CardTitle>
                    <span
                      className="text-base sm:text-lg font-semibold bg-gradient-to-r from-[hsl(var(--brand-cool-start))] via-[hsl(var(--brand-cool-end))] to-[hsl(var(--brand-warm-end))] bg-clip-text text-transparent drop-shadow-[0_1px_1px_rgba(0,0,0,0.6)]"
                      style={{ WebkitTextStroke: '0.4px rgba(0,0,0,0.8)' }}
                    >
                      {selectedFriend.handle}
                    </span>
                  </div>
                </div>
              ) : (
                <CardTitle 
                  className="text-base sm:text-lg font-extrabold bg-gradient-to-r from-[hsl(var(--brand-cool-start))] via-[hsl(var(--brand-cool-end))] to-[hsl(var(--brand-warm-end))] bg-clip-text text-transparent drop-shadow-[0_1px_1px_rgba(0,0,0,0.6)]"
                  style={{ WebkitTextStroke: '0.5px rgba(0,0,0,0.85)' }}
                >
                  {t('events.tab_friends', "Friends' Events")}
                </CardTitle>
              )}

            </CardHeader>
            <CardContent>
              {loadingFriends ? (
                <p className="text-sm text-muted-foreground">{t('common.loading', 'Loading...')}</p>
              ) : (friendsEvents?.length ?? 0) === 0 ? (
                <p className="text-sm text-muted-foreground">{t('events.empty_friends', "No friends' events.")}</p>
              ) : selectedFriend ? (
                <div className="space-y-4">
                  <BackButton onClick={handleFriendBack}>{t('common.back', 'Back')}</BackButton>
                  {selectedFriend.wishlists.length > 0 ? (
                    <div className="w-full flex flex-col items-center py-2 space-y-2 relative">
                      <WishlistStack
                        viewerMode
                        cardDimensions={{ width: cardSize.width, height: cardSize.height }}
                        cards={selectedFriend.wishlists.map((wl) => ({ id: wl.id, title: wl.title || 'Wishlist' }))}
                        className="-translate-x-2"
                        onCardOpen={handleWishlistPreview}
                      />
                      {selectedFriend.wishlists.length > 1 && (
                        <div className="absolute bottom-[-2.5rem] left-1/2 -translate-x-1/2 text-center text-[11px] text-muted-foreground z-10">
                          <span className="inline-flex items-center justify-center gap-1 px-4 py-[3px] rounded-full bg-muted/40 border border-border/60 shadow-sm">
                            <span className="tracking-wide text-[10px]">{"<"} Swipe cards {">"}</span>
                            <svg
                              width="16"
                              height="16"
                              viewBox="0 0 16 16"
                              aria-hidden="true"
                              className="overflow-visible"
                            >
                              <g>
                                <animateTransform
                                  attributeName="transform"
                                  type="translate"
                                  dur="1.1s"
                                  values="0 0; 3 0; 0 0"
                                  repeatCount="indefinite"
                                />
                                <text
                                  x="2"
                                  y="11"
                                  fontSize="10"
                                >
                                  🤚
                                </text>
                              </g>
                            </svg>
                          </span>
                        </div>
                      )}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground text-center">
                      {t('events.friend_no_wishlists', 'This friend has no upcoming wishlists yet.')}
                    </p>
                  )}
                </div>
              ) : (
                <FriendEventsList
                  friends={friendsEvents!}
                  onSelect={handleFriendSelect}
                  onScrollContainerReady={setFriendsScrollNode}
                />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="public" className="pt-4">
          <Card className="border-0 rounded-2xl ring-1 ring-white/30 bg-gradient-to-br from-[#4158D0]/10 via-[#C850C0]/10 to-[#FFCC70]/10 shadow-[0_18px_40px_rgba(0,0,0,0.20)]">
            <CardHeader className="pb-3 flex flex-row items-center justify-between">
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2">
                  <CardTitle 
                    className="text-base sm:text-lg font-extrabold bg-gradient-to-r from-[hsl(var(--brand-cool-start))] via-[hsl(var(--brand-cool-end))] to-[hsl(var(--brand-warm-end))] bg-clip-text text-transparent drop-shadow-[0_1px_1px_rgba(0,0,0,0.6)]"
                    style={{ WebkitTextStroke: '0.5px rgba(0,0,0,0.85)' }}
                  >
                    {t('events.tab_general', 'General Events')}
                  </CardTitle>
                  {profileBundle?.country && (
                    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                      {(() => {
                        const raw = (profileBundle.country || '').toString();
                        const cc = resolveCountryCode(raw) ?? '';
                        return cc ? (
                          <ReactCountryFlag svg countryCode={cc} style={{ width: '16px', height: '12px' }} aria-label={cc} />
                        ) : null;
                      })()}
                      <span>{(profileBundle.country || '').toString()}</span>
                    </span>
                  )}
                </div>
                <span className="text-xs text-muted-foreground">{t('events.public_holiday_disclaimer', 'Public holiday dates can vary.')}</span>
                {!profileBundle?.country && (
                  <span className="text-[11px] text-muted-foreground/80">
                    {t('events.no_country_set', 'Set your Country/Region in your profile or Settings to see holidays for your country.')}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <select
                  className="border rounded-md px-2 py-1 text-sm"
                  value={monthFilter === 'all' ? 'all' : String(monthFilter)}
                  onChange={(e) => {
                    const v = e.target.value;
                    setMonthFilter(v === 'all' ? 'all' : Number(v));
                  }}
                  aria-label={t('events.month_filter_aria', 'Filter by month')}
                >
                  <option value="all">{t('events.month_all', 'All months')}</option>
                  <option value="1">{t('events.month_1', 'January')}</option>
                  <option value="2">{t('events.month_2', 'February')}</option>
                  <option value="3">{t('events.month_3', 'March')}</option>
                  <option value="4">{t('events.month_4', 'April')}</option>
                  <option value="5">{t('events.month_5', 'May')}</option>
                  <option value="6">{t('events.month_6', 'June')}</option>
                  <option value="7">{t('events.month_7', 'July')}</option>
                  <option value="8">{t('events.month_8', 'August')}</option>
                  <option value="9">{t('events.month_9', 'September')}</option>
                  <option value="10">{t('events.month_10', 'October')}</option>
                  <option value="11">{t('events.month_11', 'November')}</option>
                  <option value="12">{t('events.month_12', 'December')}</option>
                </select>
              <Button
                variant="outline"
                size="sm"
                disabled={refreshing}
                onClick={async () => {
                  try {
                    setRefreshing(true);
                    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
                    const supabaseAnon = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
                    if (supabaseUrl && supabaseAnon) {
                      await fetch(`${supabaseUrl}/functions/v1/update-public-events`, {
                        method: 'POST',
                        headers: {
                          'Content-Type': 'application/json',
                          apikey: supabaseAnon,
                          Authorization: `Bearer ${supabaseAnon}`,
                        },
                      });
                    } else {
                      await supabase.functions.invoke('update-public-events');
                    }
                    await queryClient.invalidateQueries({
                      predicate: (q) => Array.isArray(q.queryKey) && q.queryKey[0] === 'events' && q.queryKey[1] === 'public'
                    });
                    await queryClient.invalidateQueries({
                      predicate: (q) => Array.isArray(q.queryKey) && q.queryKey[0] === 'events'
                    });
                  } finally {
                    setRefreshing(false);
                  }
                }}
              >
                {refreshing ? t('common.loading', 'Loading...') : t('events.refresh_holidays', 'Refresh Holidays')}
              </Button>
              </div>
            </CardHeader>
            <CardContent>
              {loadingPublic ? (
                <p className="text-sm text-muted-foreground">{t('common.loading', 'Loading...')}</p>
              ) : (
                (() => {
                  const rows = publicEvents ?? [];
                  // Group Eid holidays into ranges by country/year
                  const isFitr = (s: string) => /eid\s*al[- ]fitr/i.test(s);
                  const isAdha = (s: string) => /eid\s*al[- ]adha/i.test(s);
                  type Row = any;
                  type GroupKey = string;
                  const groups = new Map<GroupKey, { name: string; country_tag: string; dates: string[] }>();
                  const passthrough: Row[] = [];
                  for (const e of rows as Row[]) {
                    const name = String(e?.name || e?.title || '');
                    const cc = String(e?.country_code || e?.country || '');
                    const d = String(e?.date || e?.event_date || '');
                    const year = d.slice(0, 4);
                    if ((isFitr(name) || isAdha(name)) && /\d{4}-\d{2}-\d{2}/.test(d)) {
                      const kind = isFitr(name) ? 'fitr' : 'adha';
                      const key: GroupKey = `${cc}__${year}__${kind}`;
                      if (!groups.has(key)) groups.set(key, { name: isFitr(name) ? 'Eid al-Fitr' : 'Eid al-Adha', country_tag: cc, dates: [] });
                      groups.get(key)!.dates.push(d);
                    } else {
                      passthrough.push(e);
                    }
                  }
                  const grouped: Row[] = Array.from(groups.values()).map((g) => {
                    const sorted = g.dates.sort();
                    const start = sorted[0];
                    const end = sorted[sorted.length - 1];
                    return { id: `${g.country_tag}-${g.name}-${start}-${end}`, name: g.name, country_code: g.country_tag, date_start: start, date_end: end };
                  });
                  // Merge and sort by start date
                  let merged: Row[] = [...passthrough, ...grouped].sort((a, b) => {
                    const da = new Date(a.date_start || a.date || a.event_date || 0).getTime();
                    const db = new Date(b.date_start || b.date || b.event_date || 0).getTime();
                    return da - db;
                  });
                  if (monthFilter !== 'all') {
                    const m = Number(monthFilter) - 1; // JS months are 0-based
                    merged = merged.filter((e: any) => {
                      const dRef = e.date_start || e.date || e.event_date;
                      if (!dRef) return false;
                      const d = new Date(dRef);
                      return d.getMonth() === m;
                    });
                  }
                  const formatDate = (iso: string) => {
                    const d = new Date(iso);
                    if (Number.isNaN(d.getTime())) return '';
                    if (i18n.language === 'ar') {
                      return d.toLocaleDateString('ar-EG', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' });
                    }
                    return d.toLocaleDateString('en-GB', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' });
                  };
                  const mapTitle = (name: string) => {
                    if (i18n.language !== 'ar') return name;
                    const n = name.trim().toLowerCase();
                    if (/new year'?s\s+day/.test(n)) return 'يوم السنة الجديدة';
                    if (/new year'?s\s+eve/.test(n)) return 'ليلة رأس السنة';
                    if (/new year'?s.*holiday/.test(n)) return 'عطلة رأس السنة';
                    if (/national\s+sports?\s+day/.test(n)) return 'اليوم الرياضي الوطني';
                    if (/ramadan/.test(n) && /start/.test(n)) return 'بداية رمضان';
                    if (/march/.test(n) && /bank/.test(n)) return 'عطلة مصرفية في مارس';
                    if (/march/.test(n) && /equinox/.test(n)) return 'الاعتدال الربيعي';
                    if (/eid/.test(n) && /fitr/.test(n)) return 'عيد الفطر';
                    if (/eid/.test(n) && /adha/.test(n)) return 'عيد الأضحى';
                    if (/june/.test(n) && /solstice/.test(n)) return 'الانقلاب الصيفي';
                    if (/september/.test(n) && /equinox/.test(n)) return 'الاعتدال الخريفي';
                    if (/national/.test(n) && /day/.test(n)) return 'اليوم الوطني';
                    if (/december/.test(n) && /solstice/.test(n)) return 'الانقلاب الشتوي';
                    return name;
                  };
                  return rows.length === 0 ? (
                    <p className="text-sm text-muted-foreground">{t('events.empty_general', 'No public events.')}</p>
                  ) : (
                    <div className="divide-y divide-white/20">
                      {merged.map((e: any) => (
                        <div key={e.id || `${e.name}-${e.date}-${e.country_code || e.country}`} className="py-2">
                          <div className="flex items-center justify-between rounded-xl bg-white/50 backdrop-blur px-3 py-2 ring-1 ring-white/60 shadow-sm">
                            <div className="min-w-0">
                              <div className="font-medium truncate">{mapTitle(String(e?.name || e?.title || t('events.untitled', 'Untitled')))}</div>
                              {(() => {
                                const raw = (e?.name || e?.title || '').toString();
                                const name = raw.toLowerCase();
                                const countryRaw = (e?.country_code || e?.country || '').toString();
                                const cc = resolveCountryCode(countryRaw) ?? '';
                                let iconNode: any = <span>📅</span>;
                                let text = 'Mark the date';
                                // prioritize sports before national so National Sports Day shows sports remark
                                if (/sports?|sport/.test(name)) { iconNode = <span>🏃</span>; text = t('events.helper_keep_in_shape', "Let's keep in shape"); }
                                else if (/ramadan/.test(name)) { iconNode = <span>🌙</span>; text = t('events.helper_month_of_reflection', 'Month of reflection'); }
                                else if (/eid\s*al[- ]fitr/.test(name)) { iconNode = <span>🎉</span>; text = t('events.helper_feast_after_fasting', 'Feast after fasting'); }
                                else if (/eid\s*al[- ]adha/.test(name)) { iconNode = <span>🕋</span>; text = t('events.helper_festival_of_sacrifice', 'Festival of sacrifice'); }
                                else if (/(national|independence).*day/.test(name)) {
                                  iconNode = cc ? (
                                    <ReactCountryFlag svg countryCode={cc} style={{ width: '18px', height: '14px' }} aria-label={cc} />
                                  ) : (
                                    <span>🏛️</span>
                                  );
                                  text = t('events.helper_celebrate_the_nation', 'Celebrate the nation');
                                }
                                else if (/bank/.test(name)) { iconNode = <span>🏦</span>; text = t('events.helper_banks_closed', 'Banks closed'); }
                                else if (/(labor|labour)\s*day/.test(name)) { iconNode = <span>🛠️</span>; text = t('events.helper_workers_day', 'Workers’ day'); }
                                else if (/christmas/.test(name)) { iconNode = <span>🎄</span>; text = t('events.helper_merry_and_bright', 'Merry and bright'); }
                                else if (/equinox|solstice/.test(name)) { iconNode = <span>🌌</span>; text = t('events.helper_seasonal_balance', 'Seasonal balance'); }
                                else if (/new year'?s\s+day/.test(name)) { iconNode = <span>🎉</span>; text = t('events.helper_fresh_start', 'Fresh start'); }
                                else if (/new year'?s/.test(name)) { iconNode = <span>🎉</span>; text = t('events.helper_new_beginnings', 'New beginnings'); }
                                return (
                                  <div className="text-sm text-muted-foreground line-clamp-1 flex items-center gap-1">
                                    {iconNode}
                                    <span>{text}</span>
                                  </div>
                                );
                              })()}
                              {(() => {
                                const countryRaw = (e?.country_code || e?.country || '').toString();
                                if (!countryRaw.trim()) return null;
                                const cc = resolveCountryCode(countryRaw) ?? '';
                                return (
                                  <div className="text-sm text-muted-foreground flex items-center gap-1">
                                    {cc && (
                                      <ReactCountryFlag svg countryCode={cc} style={{ width: '16px', height: '12px' }} aria-label={cc} />
                                    )}
                                    <span>{countryRaw}</span>
                                  </div>
                                );
                              })()}
                            </div>
                            <div className="text-sm text-muted-foreground">
                              {(() => {
                                const dStart = e?.date_start || e?.date || e?.event_date || '';
                                const dEnd = e?.date_end || '';
                                const fmt = (iso: string) => formatDate(iso);
                                if (dStart && dEnd && dStart !== dEnd) {
                                  return `${fmt(dStart)} → ${fmt(dEnd)}`;
                                }
                                return (e?.date || e?.event_date) ? fmt(e?.date || e?.event_date) : '';
                              })()}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                })()
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
      <Dialog open={previewOpen} onOpenChange={(state) => !state && handleClosePreview()}>
        <DialogContent className="sm:max-w-lg border-0 bg-transparent shadow-none p-0" aria-describedby={undefined}>
          <DialogHeader className="sr-only">
            <DialogTitle>{t('wishlist_detail.wishlist','Wishlist')}</DialogTitle>
          </DialogHeader>
          {previewLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" aria-label={t('common.loading', 'Loading...')} />
            </div>
          ) : previewWishlist ? (
            <div className="mx-auto w-full max-w-[420px]">
              <div className="wl-card w-full">
                <div className="wl-card-surface p-5 text-white" style={{ alignItems: 'flex-start', justifyContent: 'flex-start' }}>
                  <div className="w-full">
                    <h2
                      className="text-3xl font-extrabold bg-gradient-to-r from-[hsl(var(--brand-cool-start))] via-[hsl(var(--brand-cool-end))] to-[hsl(var(--brand-warm-end))] bg-clip-text text-transparent drop-shadow-[0_2px_2px_rgba(0,0,0,0.75)] wl-card-title"
                      style={{ textAlign: 'left', WebkitTextStroke: '0.6px rgba(0,0,0,0.9)' }}
                    >
                      {previewWishlist.title || t('wishlist_detail.wishlist', 'Wishlist')}
                    </h2>
                    {previewEventDate && (
                      <div className="mt-1 flex flex-wrap items-center gap-2">
                        <p className="mt-2 text-xs font-semibold opacity-90 drop-shadow-[0_2px_8px_rgba(0,0,0,0.6)]">{previewEventDate}</p>
                        <span className="inline-flex items-center rounded-full bg-white/80 px-2 py-0.5 text-[11px] ring-1 ring-black/10 text-blue-900">
                          {previewItems.length} {t('giftr.items', 'items')}
                        </span>
                        {(previewOwner?.show_countdown_timer ?? true) && previewCountdown && (
                          <span
                            className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-semibold tracking-wide text-white ring-1 ring-white/30 shadow-[0_8px_18px_rgba(0,0,0,0.25)] bg-gradient-to-r from-[rgba(15,23,42,0.8)] via-[rgba(79,70,229,0.85)] to-[rgba(236,72,153,0.85)]"
                            aria-label={t('giftr.days_left','days left')}
                          >
                            <Hourglass className="h-3.5 w-3.5 text-white/85" aria-hidden />
                            <span>{previewCountdown}</span>
                            <span className="text-[10px] text-white/80 uppercase tracking-[0.12em]">
                              {t('giftr.days_left','days left')}
                            </span>
                          </span>
                        )}
                      </div>
                    )}
                    {previewWishlist.description && (
                      <p className="mt-3 text-sm text-white/90 drop-shadow-[0_2px_6px_rgba(0,0,0,0.5)]">{previewWishlist.description}</p>
                    )}
                    <div className="mt-4 w-full">
                      <h3 className="text-base font-semibold drop-shadow-[0_2px_6px_rgba(0,0,0,0.5)]">{t('wishlist_detail.items_title', 'Items')}</h3>
                      {previewItems.length > 0 ? (
                        <>
                          <Carousel opts={{ align: 'start', loop: false }} className="mt-2" setApi={setPreviewCarouselApi}>
                            <CarouselContent>
                              {previewItems.map((item) => (
                                <CarouselItem key={item.id}>
                                  <div className="rounded-2xl p-[2px] bg-gradient-to-br from-[hsl(var(--brand-cool-start))] via-[hsl(var(--brand-cool-end))] to-[hsl(var(--brand-warm-end))] shadow-[0_8px_18px_rgba(0,0,0,0.22)]">
                                    <div className="rounded-xl bg-black/30 backdrop-blur-sm px-3 py-3 flex items-start gap-3 select-none">
                                      {item.image_url ? (
                                        <img
                                          src={item.image_url}
                                          alt={item.title || 'Preview'}
                                          className="h-[80px] w-[80px] rounded-full object-contain bg-white/90 ring-2 ring-white/30 shadow-[0_6px_18px_rgba(0,0,0,0.35)] p-1"
                                        />
                                      ) : (
                                        <div className="h-[80px] w-[80px] rounded-full bg-white/20 ring-2 ring-white/30" />
                                      )}
                                      <div className="min-w-0 flex-1">
                                        <div className="flex items-center justify-between gap-2">
                                          <div className="text-base sm:text-lg font-extrabold text-white truncate drop-shadow-[0_2px_8px_rgba(0,0,0,0.6)]">{item.title || t('events.untitled','Untitled')}</div>
                                          <div className="text-lg" aria-hidden>{desireEmoji((item as any).desire)}</div>
                                        </div>
                                        {item.brand && (
                                          <div className="mt-0.5 text-xs text-white/90 truncate drop-shadow-[0_2px_6px_rgba(0,0,0,0.5)]">{item.brand}</div>
                                        )}
                                        {item.description && (
                                          <div className="mt-1 text-sm text-white/95 line-clamp-4 drop-shadow-[0_2px_6px_rgba(0,0,0,0.5)]">{item.description}</div>
                                        )}
                                        {item.item_url && (
                                          <a href={item.item_url} target="_blank" rel="noreferrer" className="mt-1 inline-block text-[11px] text-blue-200 underline">
                                            {t('giftr.view_link', 'View link')}
                                          </a>
                                        )}
                                        {(previewOwner?.allow_friends_claim ?? true) && (
                                          <div className="mt-2 flex flex-col items-start gap-2">
                                            {(() => {
                                              const userReservation = previewUserReservations.get(item.id);
                                              const otherReservation = previewAllReservations.get(item.id);
                                              const isClaimedByOther = otherReservation && otherReservation.claimer_id !== currentUserId;
                                              const isClaimed = previewClaimedIds.has(item.id);
                                              const isClaiming = previewClaimingId === item.id;
                                              const isUnclaiming = previewUnclaimingId === item.id;
                                              
                                              // Show "Claimed by [Name]" badge if someone else claimed it
                                              if (isClaimedByOther && otherReservation) {
                                                return (
                                                  <span className="text-xs text-white/90 bg-emerald-500/30 px-3 py-1.5 rounded-full flex items-center gap-1.5">
                                                    <Check className="h-3 w-3" />
                                                    {t('giftr.claimed_by', 'Claimed by {{name}}', { name: otherReservation.claimer_name })}
                                                  </span>
                                                );
                                              }
                                              
                                              if (userReservation) {
                                                return (
                                                  <>
                                                    {userReservation.status === 'pending' && (
                                                      <span className="text-xs text-white/80 bg-white/10 px-2 py-1 rounded">
                                                        {t('wishlist_detail.pending_claim_badge', 'Pending approval')}
                                                      </span>
                                                    )}
                                                    {userReservation.status === 'approved' && (
                                                      <>
                                                        <span className="text-xs text-white/80 bg-emerald-500/20 px-2 py-1 rounded">
                                                          {t('giftr.claimed_btn', 'Claimed')}
                                                        </span>
                                                        <Button
                                                          size="sm"
                                                          variant="outline"
                                                          className="h-8 px-3 bg-white/10 text-white border-white/40"
                                                          disabled={isUnclaiming}
                                                          onClick={() => handlePreviewUnclaim(item.id)}
                                                        >
                                                          {isUnclaiming ? t('common.loading', 'Loading...') : t('giftr.request_unclaim_btn', 'Request Unclaim')}
                                                        </Button>
                                                      </>
                                                    )}
                                                    {userReservation.status === 'unclaim_requested' && (
                                                      <span className="text-xs text-white/80 bg-amber-500/20 px-2 py-1 rounded">
                                                        {t('giftr.unclaim_pending', 'Unclaim pending approval')}
                                                      </span>
                                                    )}
                                                    {userReservation.status === 'pending' && (
                                                      <Button
                                                        size="sm"
                                                        variant="outline"
                                                        className="h-8 px-3 bg-white/10 text-white border-white/40"
                                                        disabled={isUnclaiming}
                                                        onClick={() => handlePreviewUnclaim(item.id)}
                                                      >
                                                        {isUnclaiming ? t('common.loading', 'Loading...') : t('giftr.unclaim_btn', 'Unclaim')}
                                                      </Button>
                                                    )}
                                                  </>
                                                );
                                              }
                                              
                                              return (
                                                <Button
                                                  size="sm"
                                                  className="h-8 px-3 bg-white/20 text-white border border-white/40"
                                                  disabled={isClaimed || isClaiming}
                                                  onClick={() => handlePreviewClaim(item.id)}
                                                >
                                                  {isClaimed
                                                    ? t('giftr.claimed_btn', 'Claimed')
                                                    : isClaiming
                                                      ? t('common.loading', 'Loading...')
                                                      : t('giftr.claim_btn', 'Claim')}
                                                </Button>
                                              );
                                            })()}
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                </CarouselItem>
                              ))}
                            </CarouselContent>
                            <CarouselPrevious className="hidden sm:flex" />
                            <CarouselNext className="hidden sm:flex" />
                          </Carousel>
                          <div className="mt-2 text-center text-[11px] text-white/90">
                            {previewSlide + 1}/{previewItems.length}
                          </div>
                        </>
                      ) : (
                        <p className="text-sm opacity-80 mt-1 text-white">{t('wishlist_detail.no_items', 'No items yet.')}</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center py-12">
              <p className="text-sm text-muted-foreground">{t('wishlist_detail.load_error', 'Unable to load wishlist.')}</p>
            </div>
          )}
        </DialogContent>
      </Dialog>
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Event</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="evt-title">Title</Label>
              <Input id="evt-title" value={editTitle} onChange={(e) => setEditTitle(e.target.value)} placeholder="Event title" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="evt-desc">Description</Label>
              <Input id="evt-desc" value={editDesc} onChange={(e) => setEditDesc(e.target.value)} placeholder="Description" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>Cancel</Button>
            <Button
              onClick={async () => {
                try {
                  if (!activeEventId) return;
                  const payload: any = {};
                  payload.title = editTitle;
                  payload.description = editDesc;
                  await (supabase as any)
                    .from('wishlists')
                    .update(payload)
                    .eq('id', activeEventId);
                  setEditOpen(false);
                  setActiveEventId(null);
                  await queryClient.invalidateQueries({ queryKey: ['events', 'me'] });
                } catch {}
              }}
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete this event?</DialogTitle>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={async () => {
                try {
                  if (!activeEventId) return;
                  await (supabase as any)
                    .from('wishlists')
                    .delete()
                    .eq('id', activeEventId);
                  setDeleteOpen(false);
                  setActiveEventId(null);
                  await queryClient.invalidateQueries({ queryKey: ['events', 'me'] });
                } catch {}
              }}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Events;
