import { Suspense, useCallback, useEffect, useState } from "react";
import { Link, Outlet, useLocation } from "react-router-dom";
import { Home, Store, Calendar, User, Plus, Bell, MessageSquare } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import wishlyLogo from "@/assets/wishly-logo.png";
import WishAddDialog from "@/components/wishes/WishAddDialog";
import { useWishlists } from "@/hooks/use-wishlists";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { usePresence } from "@/hooks/usePresence";

export const MainLayout = () => {
  const location = useLocation();
  const [addOpen, setAddOpen] = useState(false);
  const [pendingCount, setPendingCount] = useState<number>(0);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | undefined>(undefined);
  const { data: wishlistsData } = useWishlists();
  const { t } = useTranslation();
  
  // Track user presence for real-time online status
  usePresence(userId);

  const isActive = (path: string) => location.pathname === path;
  const isGifterShared = new URLSearchParams(location.search).get('mode')?.toLowerCase() === 'gifter';

  const prefetchRoute = useCallback((path: string) => {
    if (typeof window === "undefined") return;

    // Prefetch only the routes that are relevant to the bottom nav / common flows.
    // These imports correspond to the route-level lazy() modules in App.tsx.
    switch (path) {
      case "/dashboard":
        void import("@/pages/Dashboard");
        break;
      case "/explore":
        void import("@/pages/Explore");
        break;
      case "/events":
        void import("@/pages/Events");
        break;
      case "/profile":
        void import("@/pages/Profile");
        break;
      case "/notifications":
        void import("@/pages/Notifications");
        break;
      case "/messages":
        void import("@/pages/Messages");
        break;
      case "/wishlists":
        void import("@/pages/Wishlists");
        break;
      case "/settings":
        void import("@/pages/Settings");
        break;
      default:
        break;
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const run = () => {
      prefetchRoute("/dashboard");
      prefetchRoute("/explore");
      prefetchRoute("/events");
      prefetchRoute("/profile");
      prefetchRoute("/notifications");
      prefetchRoute("/messages");
    };

    // Prefetch when the browser is idle so it doesn't compete with initial paint.
    const ric = (window as any).requestIdleCallback as
      | ((cb: () => void, opts?: { timeout?: number }) => number)
      | undefined;

    if (ric) {
      const id = ric(run, { timeout: 1500 });
      return () => {
        const cancel = (window as any).cancelIdleCallback as ((id: number) => void) | undefined;
        cancel?.(id);
      };
    }

    const t = window.setTimeout(run, 600);
    return () => window.clearTimeout(t);
  }, [prefetchRoute]);

  // Extract wishlist ID from path if we are on a wishlist detail page
  const currentWishlistId = location.pathname.match(/^\/wishlist\/([^/]+)/)?.[1];

  useEffect(() => {
    if (typeof window === "undefined") return;
    let mounted = true;
    let followersChannel: ReturnType<typeof supabase.channel> | null = null;
    let activitiesChannel: ReturnType<typeof supabase.channel> | null = null;

    const fetchPendingCount = async (uid: string) => {
      try {
        const { count } = await supabase
          .from("followers")
          .select("id", { count: "exact", head: true })
          .eq("following_id", uid)
          .eq("status", "pending");
        if (mounted) setPendingCount((count as number | null) ?? 0);
      } catch {
        if (mounted) setPendingCount(0);
      }
    };

    const fetchAvatar = async (uid: string) => {
      const { data: profile } = await supabase
        .from("user_profiles")
        .select("avatar_url")
        .eq("id", uid)
        .maybeSingle();
      if (mounted) setAvatarUrl((profile as any)?.avatar_url || null);
    };

    const formatToastMessage = (type: string, name: string | null) => {
      if (type === "new_follower") {
        return name
          ? `${t("notifications.activity_new_follower", "You have a new follower")} · ${name}`
          : t("notifications.activity_new_follower", "You have a new follower");
      }
      if (type === "follow_accepted") {
        return name
          ? `${t("notifications.activity_follow_accepted", "Your follow request was accepted")} · ${name}`
          : t("notifications.activity_follow_accepted", "Your follow request was accepted");
      }
      if (type === "wish_claimed") {
        const base = t('notifications.activity_wish_claimed', 'New claim request');
        return name ? `${base} · ${name}` : base;
      }
      return null;
    };

    const ensureLastSeenInitialized = async (uid: string) => {
      const storageKey = `wishly:lastSeenActivityId:${uid}`;
      if (localStorage.getItem(storageKey)) return;
      const { data } = await supabase
        .from("activities")
        .select("id")
        .eq("user_id", uid)
        .order("created_at", { ascending: false })
        .limit(1);
      if (data && data[0]) {
        localStorage.setItem(storageKey, data[0].id as string);
      }
    };

    const subscribe = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      const uid = user?.id;
      if (!uid || !mounted) return;
      
      // Set userId for presence tracking
      setUserId(uid);

      await fetchPendingCount(uid);
      await fetchAvatar(uid);
      await ensureLastSeenInitialized(uid);

      followersChannel = supabase
        .channel(`followers-pending-${uid}`)
        .on("postgres_changes", { event: "*", schema: "public", table: "followers", filter: `following_id=eq.${uid}` }, () => {
          fetchPendingCount(uid);
        })
        .subscribe();

      activitiesChannel = supabase
        .channel(`activities-${uid}`)
        .on("postgres_changes", { event: "INSERT", schema: "public", table: "activities", filter: `user_id=eq.${uid}` }, async (payload) => {
          const activity = payload.new as any;
          const storageKey = `wishly:lastSeenActivityId:${uid}`;
          if (localStorage.getItem(storageKey) === activity.id) return;

          let name: string | null = null;
          if (activity.target_id) {
            const { data: profile } = await supabase
              .from("user_profiles")
              .select("full_name, username")
              .eq("id", activity.target_id as string)
              .maybeSingle();
            name = (profile as any)?.full_name || (profile as any)?.username || null;
          }

          const message = formatToastMessage(String(activity.activity_type || ""), name);
          if (message) {
            toast(message);
            localStorage.setItem(storageKey, activity.id as string);
          }
        })
        .subscribe();
    };

    subscribe();

    return () => {
      mounted = false;
      if (followersChannel) supabase.removeChannel(followersChannel);
      if (activitiesChannel) supabase.removeChannel(activitiesChannel);
    };
  }, [t]);

  // Real-time listener for admin control changes (LiveSync with admin panel)
  useEffect(() => {
    let adminChannel: ReturnType<typeof supabase.channel> | null = null;

    const setupAdminListener = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      adminChannel = supabase
        .channel(`admin-master-control-${user.id}`)
        .on(
          'broadcast',
          { event: 'refresh' },
          async () => {
            // Admin triggered a refresh - refetch user profile/settings
            const { data: profile } = await supabase
              .from("user_profiles")
              .select("avatar_url")
              .eq("id", user.id)
              .maybeSingle();
            setAvatarUrl((profile as any)?.avatar_url || null);
            
            // Also refetch pending count
            const { count } = await supabase
              .from("followers")
              .select("id", { count: "exact", head: true })
              .eq("following_id", user.id)
              .eq("status", "pending");
            setPendingCount((count as number | null) ?? 0);
          }
        )
        .subscribe();
    };

    setupAdminListener();

    return () => {
      if (adminChannel) {
        supabase.removeChannel(adminChannel);
      }
    };
  }, []);

  return (
    <div dir="ltr" className="flex min-h-screen flex-col bg-background">
      {/* Top Bar (hidden on shared gifter view) */}
      {!isGifterShared && (
      <header className="sticky top-0 z-50 flex h-16 items-center justify-between border-b bg-card px-4 shadow-sm">
        <Link to="/" className="flex items-center">
          <img src={wishlyLogo} alt="Wishly" className="h-12 md:h-14" />
        </Link>
        <div className="flex items-center gap-2">
          <Link to="/notifications">
            <Button variant="ghost" size="icon" className="relative">
              <Bell className="h-5 w-5" />
              {pendingCount > 0 && (
                <span className="absolute -right-1 -top-1 min-w-[18px] h-[18px] px-1 rounded-full bg-gradient-to-br from-[hsl(var(--brand-cool-start))] to-[hsl(var(--brand-warm-end))] text-[10px] leading-[18px] text-white text-center ring-1 ring-white/70 shadow-[0_6px_14px_rgba(0,0,0,0.15)]">
                  {Math.min(pendingCount, 9)}{pendingCount > 9 ? "+" : ""}
                </span>
              )}
            </Button>
          </Link>
          <Link to="/messages">
            <Button variant="ghost" size="icon">
              <MessageSquare className="h-5 w-5" />
            </Button>
          </Link>
        </div>
      </header>
      )}

      {/* Main Content */}
      <main
        className={`flex-1 overflow-y-auto ${
          isGifterShared ? '' : 'pb-[calc(env(safe-area-inset-bottom,0px)+6rem)]'
        }`}
      >
        <Suspense
          fallback={
            <div className="container max-w-2xl mx-auto px-4 py-8 space-y-6">
              <div className="h-4 w-44 rounded-full bg-muted" />
              <div className="h-3 w-64 rounded-full bg-muted" />
              <div className="h-24 w-full rounded-2xl bg-muted/60" />
              <div className="h-24 w-full rounded-2xl bg-muted/60" />
              <div className="h-24 w-full rounded-2xl bg-muted/60" />
            </div>
          }
        >
          <Outlet />
        </Suspense>
      </main>

      {/* Bottom Navigation (hidden on shared gifter view) */}
      {!isGifterShared && (
      <nav
        dir="ltr"
        className="fixed bottom-0 left-0 right-0 z-50 pt-3 pb-[calc(env(safe-area-inset-bottom,0px)+0.5rem)]"
      >
        <div className="mx-auto w-[min(720px,95%)] px-2">
          <div
            dir="ltr"
            className="relative flex flex-row items-center justify-between gap-1 sm:gap-2 px-3 py-2 h-[72px] touch-manipulation"
          >
            <svg
              className="pointer-events-none absolute inset-0 h-full w-full drop-shadow-[0_16px_40px_rgba(0,0,0,0.25)]"
              viewBox="0 0 400 80"
              preserveAspectRatio="none"
              aria-hidden="true"
            >
              <defs>
                <linearGradient id="navGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="hsl(240, 50%, 30%)" />
                  <stop offset="50%" stopColor="hsl(260, 60%, 40%)" />
                  <stop offset="100%" stopColor="hsl(35, 90%, 50%)" />
                </linearGradient>
              </defs>
              <path
                d="M0,28 Q0,8 20,8 L150,8 Q165,8 172,20 Q185,44 200,44 Q215,44 228,20 Q235,8 250,8 L380,8 Q400,8 400,28 L400,60 Q400,80 380,80 L20,80 Q0,80 0,60 Z"
                fill="url(#navGradient)"
              />
            </svg>
            <div className="relative z-10 flex w-full items-center justify-between gap-1 sm:gap-2">
          <Link
            to="/dashboard"
            className="flex flex-1 justify-center min-w-0 [-webkit-tap-highlight-color:transparent]"
            onMouseEnter={() => prefetchRoute('/dashboard')}
            onTouchStart={() => prefetchRoute('/dashboard')}
          >
            <Button
              variant="ghost"
              size="sm"
              className={`w-full max-w-[64px] sm:max-w-[82px] flex flex-col items-center gap-1 h-auto py-2 touch-manipulation select-none hover:bg-white/10 ${
                isActive("/dashboard") ? "text-white" : "text-white/70"
              }`}
            >
              <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-white">
                <img src={wishlyLogo} alt="Dash" className="h-10 w-10 rounded-full object-cover" />
              </span>
            </Button>
          </Link>

          <Link
            to="/explore"
            className="flex flex-1 justify-center min-w-0 [-webkit-tap-highlight-color:transparent]"
            onMouseEnter={() => prefetchRoute('/explore')}
            onTouchStart={() => prefetchRoute('/explore')}
          >
            <Button
              variant="ghost"
              size="sm"
              className={`w-full max-w-[64px] sm:max-w-[82px] flex flex-col items-center gap-1 h-auto py-2 touch-manipulation select-none hover:bg-white/10 ${
                isActive("/explore") ? "text-white" : "text-white/70"
              }`}
            >
              <Store className="h-9 w-9" strokeWidth={2.5} />
            </Button>
          </Link>

          <div className="flex flex-1 justify-center min-w-0">
            <Button
              onClick={() => setAddOpen(true)}
              size="icon"
              className="relative -mt-14 h-[68px] w-[68px] rounded-full bg-transparent shadow-none ring-0 transition-all touch-manipulation select-none [-webkit-tap-highlight-color:transparent]"
              aria-label={t('nav.add_wish', 'Add Wish')}
            >
              <span className="absolute inset-0 rounded-full bg-gradient-to-r from-[hsl(var(--brand-cool-start))] via-[hsl(var(--brand-cool-end))] to-[hsl(var(--brand-warm-end))]" />
              <span className="absolute inset-[3px] rounded-full bg-black" />
              <Plus className="relative h-10 w-10 text-white" strokeWidth={3} />
            </Button>
          </div>

          <Link
            to="/events"
            className="flex flex-1 justify-center min-w-0 [-webkit-tap-highlight-color:transparent]"
            onMouseEnter={() => prefetchRoute('/events')}
            onTouchStart={() => prefetchRoute('/events')}
          >
            <Button
              variant="ghost"
              size="sm"
              className={`w-full max-w-[64px] sm:max-w-[82px] flex flex-col items-center gap-1 h-auto py-2 touch-manipulation select-none hover:bg-white/10 ${
                isActive("/events") ? "text-white" : "text-white/70"
              }`}
            >
              <Calendar className="h-9 w-9" strokeWidth={2.5} />
            </Button>
          </Link>

          <Link
            to="/profile"
            className="flex flex-1 justify-center min-w-0 [-webkit-tap-highlight-color:transparent]"
            onMouseEnter={() => prefetchRoute('/profile')}
            onTouchStart={() => prefetchRoute('/profile')}
          >
            <Button
              variant="ghost"
              size="sm"
              className={`w-full max-w-[64px] sm:max-w-[82px] flex flex-col items-center gap-1 h-auto py-2 touch-manipulation select-none hover:bg-white/10 ${
                isActive("/profile") ? "text-white" : "text-white/70"
              }`}
            >
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt="Profile"
                  className="h-11 w-11 rounded-full object-cover ring-2 ring-white/25"
                  onError={(e: any) => { e.currentTarget.style.display = 'none'; }}
                />
              ) : (
                <User className="h-9 w-9" strokeWidth={2.5} />
              )}
            </Button>
          </Link>
            </div>
          </div>
        </div>
      </nav>
      )}

      {/* Simplified Add Wish dialog */}
      {!isGifterShared && (
      <WishAddDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        wishlists={(wishlistsData ?? []).map(w => ({ id: w.id, name: w.title || w.id }))}
        initialWishlistId={currentWishlistId}
        onSubmit={async ({ wishlistId, title, brand, description, desire, imageFile }) => {
          try {
            // Get current user
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
              toast.error("You must be signed in");
              return;
            }

            // Optional image upload to Storage (bucket must exist)
            let publicImageUrl: string | null = null;
            if (imageFile) {
              const bucket = "wishlist_images"; // correct bucket name
              const filePath = `wishlist-items/${user.id}/${Date.now()}_${imageFile.name}`;
              const { error: uploadError } = await supabase.storage
                .from(bucket)
                .upload(filePath, imageFile, { upsert: false, contentType: imageFile.type });
              if (uploadError) throw uploadError;
              const { data: pub } = supabase.storage.from(bucket).getPublicUrl(filePath);
              publicImageUrl = pub.publicUrl;
            }

            // Save to wishlist_items (existing table)
            const payload: any = {
              title,
              description: description || null,
              brand: brand || null,
              image_url: publicImageUrl,
              item_url: null,
              price: null,
              status: null,
              wishlist_id: wishlistId,
              added_at: new Date().toISOString(),
              desire, // 0..5
            };
            const { error } = await supabase.from("wishlist_items").insert([payload]);
            if (error) throw error;
            toast.success(t("success.wish_saved", "Wish saved"));
          } catch (e: any) {
            toast.error(e?.message || t("errors.failed_save_wish", "Failed to save wish"));
          }
        }}
      />
      )}
    </div>
  );
};
