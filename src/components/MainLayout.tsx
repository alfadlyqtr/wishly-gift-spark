import { useEffect, useState } from "react";
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

  return (
    <div className="flex min-h-screen flex-col bg-background">
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
          isGifterShared ? '' : 'pb-32'
        }`}
        style={{
          paddingBottom: isGifterShared
            ? undefined
            : 'calc(env(safe-area-inset-bottom, 0px) + 6rem)',
        }}
      >
        <Outlet />
      </main>

      {/* Bottom Navigation (hidden on shared gifter view) */}
      {!isGifterShared && (
      <nav
        className="fixed bottom-0 left-0 right-0 z-50 bg-gradient-to-t from-white/95 via-white/90 to-transparent pt-4 pb-2"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 0.5rem)' }}
      >
        <div className="mx-auto w-[min(720px,95%)] p-[2px] rounded-3xl bg-gradient-to-r from-[hsl(var(--brand-cool-start))] via-[hsl(var(--brand-cool-end))] to-[hsl(var(--brand-warm-end))]">
          <div className="flex items-end justify-between gap-2 px-3 py-2 rounded-3xl bg-white/85 backdrop-blur shadow-[0_12px_32px_rgba(0,0,0,0.12)] touch-manipulation">
          <Link to="/dashboard" className="flex flex-1 justify-center min-w-0" style={{ WebkitTapHighlightColor: 'transparent' }}>
            <Button
              variant="ghost"
              size="sm"
              className={`w-full max-w-[82px] flex flex-col items-center gap-1 h-auto py-2 -mt-2 touch-manipulation select-none ${
                isActive("/dashboard") ? "text-primary" : "text-muted-foreground"
              }`}
            >
              <img src={wishlyLogo} alt="Dash" className="h-8 w-8 rounded-full ring-1 ring-white/70 object-cover" />
              <span
                className="text-[11px] sm:text-sm font-extrabold bg-gradient-to-r from-[hsl(var(--brand-cool-start))] via-[hsl(var(--brand-cool-end))] to-[hsl(var(--brand-warm-end))] bg-clip-text text-transparent drop-shadow-[0_1px_1px_rgba(0,0,0,0.6)]"
                style={{ WebkitTextStroke: '0.5px rgba(0,0,0,0.85)' }}
              >
                {t('nav.dash', 'Dash')}
              </span>
            </Button>
          </Link>

          <Link to="/explore" className="flex flex-1 justify-center min-w-0" style={{ WebkitTapHighlightColor: 'transparent' }}>
            <Button
              variant="ghost"
              size="sm"
              className={`w-full max-w-[82px] flex flex-col items-center gap-1 h-auto py-2 -mt-3 touch-manipulation select-none ${
                isActive("/explore") ? "text-primary" : "text-muted-foreground"
              }`}
            >
              <Store className="h-9 w-9 drop-shadow-[0_1px_1px_rgba(0,0,0,0.45)]" strokeWidth={2.4} />
              <span
                className="text-[11px] sm:text-sm font-extrabold bg-gradient-to-r from-[hsl(var(--brand-cool-start))] via-[hsl(var(--brand-cool-end))] to-[hsl(var(--brand-warm-end))] bg-clip-text text-transparent drop-shadow-[0_1px_1px_rgba(0,0,0,0.6)]"
                style={{ WebkitTextStroke: '0.5px rgba(0,0,0,0.85)' }}
              >
                {t('nav.explore', 'Explore')}
              </span>
            </Button>
          </Link>

          <div className="flex flex-1 justify-center min-w-0">
            <Button
              onClick={() => setAddOpen(true)}
              size="lg"
              className="relative w-full max-w-[92px] sm:max-w-none -mt-9 px-3 py-2 bg-transparent shadow-none ring-0 transition-all touch-manipulation select-none"
              style={{ WebkitTapHighlightColor: 'transparent' }}
            >
              <div className="flex flex-col items-center">
                <span
                  className="text-[30px] font-extrabold bg-gradient-to-r from-[hsl(var(--brand-cool-start))] via-[hsl(var(--brand-cool-end))] to-[hsl(var(--brand-warm-end))] bg-clip-text text-transparent drop-shadow-[0_1px_1px_rgba(0,0,0,0.6)]"
                  style={{ WebkitTextStroke: '0.6px rgba(0,0,0,0.9)' }}
                >
                  +
                </span>
                <span
                  className="text-[11px] sm:text-sm font-extrabold bg-gradient-to-r from-[hsl(var(--brand-cool-start))] via-[hsl(var(--brand-cool-end))] to-[hsl(var(--brand-warm-end))] bg-clip-text text-transparent drop-shadow-[0_1px_1px_rgba(0,0,0,0.6)]"
                  style={{ WebkitTextStroke: '0.5px rgba(0,0,0,0.85)' }}
                >
                  {t('nav.add_wish', 'Add Wish')}
                </span>
              </div>
            </Button>
          </div>

          <Link to="/events" className="flex flex-1 justify-center min-w-0" style={{ WebkitTapHighlightColor: 'transparent' }}>
            <Button
              variant="ghost"
              size="sm"
              className={`w-full max-w-[82px] flex flex-col items-center gap-1 h-auto py-2 -mt-3 touch-manipulation select-none ${
                isActive("/events") ? "text-primary" : "text-muted-foreground"
              }`}
            >
              <Calendar className="h-9 w-9 drop-shadow-[0_1px_1px_rgba(0,0,0,0.45)]" strokeWidth={2.4} />
              <span
                className="text-[11px] sm:text-sm font-extrabold bg-gradient-to-r from-[hsl(var(--brand-cool-start))] via-[hsl(var(--brand-cool-end))] to-[hsl(var(--brand-warm-end))] bg-clip-text text-transparent drop-shadow-[0_1px_1px_rgba(0,0,0,0.6)]"
                style={{ WebkitTextStroke: '0.5px rgba(0,0,0,0.85)' }}
              >
                {t('nav.events', 'Events')}
              </span>
            </Button>
          </Link>

          <Link to="/profile" className="flex flex-1 justify-center min-w-0" style={{ WebkitTapHighlightColor: 'transparent' }}>
            <Button
              variant="ghost"
              size="sm"
              className={`w-full max-w-[82px] flex flex-col items-center gap-1 h-auto py-2 -mt-2 touch-manipulation select-none ${
                isActive("/profile") ? "text-primary" : "text-muted-foreground"
              }`}
            >
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt="Profile"
                  className="h-9 w-9 rounded-full object-cover ring-2 ring-white/80"
                  onError={(e: any) => { e.currentTarget.style.display = 'none'; }}
                />
              ) : (
                <User className="h-8 w-8" />
              )}
              <span
                className="text-xs sm:text-base font-extrabold bg-gradient-to-r from-[hsl(var(--brand-cool-start))] via-[hsl(var(--brand-cool-end))] to-[hsl(var(--brand-warm-end))] bg-clip-text text-transparent drop-shadow-[0_1px_1px_rgba(0,0,0,0.6)]"
                style={{ WebkitTextStroke: '0.6px rgba(0,0,0,0.9)' }}
              >
                {t('nav.profile', 'Profile')}
              </span>
            </Button>
          </Link>
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
            toast.success("Wish saved");
          } catch (e: any) {
            toast.error(e?.message || "Failed to save wish");
          }
        }}
      />
      )}
    </div>
  );
};
