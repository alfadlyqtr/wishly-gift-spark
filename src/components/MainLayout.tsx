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
// reverted: no avatar in bottom nav

export const MainLayout = () => {
  const location = useLocation();
  const [addOpen, setAddOpen] = useState(false);
  const [pendingCount, setPendingCount] = useState<number>(0);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const { data: wishlistsData } = useWishlists();
  const { t } = useTranslation();

  const isActive = (path: string) => location.pathname === path;
  const isGifterShared = new URLSearchParams(location.search).get('mode')?.toLowerCase() === 'gifter';

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        const uid = user?.id;
        if (!uid) return;
        const { count } = await supabase
          .from("followers")
          .select("id", { count: "exact", head: true })
          .eq("following_id", uid)
          .eq("status", "pending");
        if (mounted) setPendingCount((count as number | null) ?? 0);
        const { data: profile } = await supabase
          .from('user_profiles')
          .select('avatar_url')
          .eq('id', uid)
          .maybeSingle();
        if (mounted) setAvatarUrl((profile as any)?.avatar_url || null);
      } catch {
        if (mounted) setPendingCount(0);
      }
    })();
    return () => { mounted = false; };
  }, []);

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
              {pendingCount > 0 ? (
                <span className="absolute -right-1 -top-1 min-w-[18px] h-[18px] px-1 rounded-full bg-gradient-to-br from-[hsl(var(--brand-cool-start))] to-[hsl(var(--brand-warm-end))] text-[10px] leading-[18px] text-white text-center ring-1 ring-white/70 shadow-[0_6px_14px_rgba(0,0,0,0.15)]">
                  {Math.min(pendingCount, 9)}{pendingCount > 9 ? "+" : ""}
                </span>
              ) : (
                <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-secondary" />
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
      <main className={`flex-1 overflow-y-auto ${isGifterShared ? '' : 'pb-20'}`}>
        <Outlet />
      </main>

      {/* Bottom Navigation (hidden on shared gifter view) */}
      {!isGifterShared && (
      <nav className="fixed bottom-3 left-0 right-0 z-50">
        <div className="mx-auto w-[min(720px,92%)]">
          <div className="flex items-center justify-around px-3 py-2 rounded-2xl bg-white/75 backdrop-blur ring-1 ring-white/70 shadow-[0_10px_30px_rgba(0,0,0,0.12)]">
          <Link to="/dashboard">
            <Button
              variant="ghost"
              size="sm"
              className={`flex flex-col items-center gap-1 h-auto py-2 -mt-2 ${
                isActive("/dashboard") ? "text-primary" : "text-muted-foreground"
              }`}
            >
              <img src={wishlyLogo} alt="Dash" className="h-8 w-8 rounded-full ring-1 ring-white/70 object-cover" />
              <span
                className="text-base font-extrabold bg-gradient-to-r from-[hsl(var(--brand-cool-start))] via-[hsl(var(--brand-cool-end))] to-[hsl(var(--brand-warm-end))] bg-clip-text text-transparent drop-shadow-[0_1px_1px_rgba(0,0,0,0.6)]"
                style={{ WebkitTextStroke: '0.6px rgba(0,0,0,0.9)' }}
              >
                {t('nav.dash', 'Dash')}
              </span>
            </Button>
          </Link>

          <Link to="/explore">
            <Button
              variant="ghost"
              size="sm"
              className={`flex flex-col items-center gap-1 h-auto py-2 -mt-4 ${
                isActive("/explore") ? "text-primary" : "text-muted-foreground"
              }`}
            >
              <Store className="h-10 w-10 drop-shadow-[0_1px_1px_rgba(0,0,0,0.6)]" strokeWidth={2.4} />
              <span
                className="text-base font-extrabold bg-gradient-to-r from-[hsl(var(--brand-cool-start))] via-[hsl(var(--brand-cool-end))] to-[hsl(var(--brand-warm-end))] bg-clip-text text-transparent drop-shadow-[0_1px_1px_rgba(0,0,0,0.6)]"
                style={{ WebkitTextStroke: '0.6px rgba(0,0,0,0.9)' }}
              >
                {t('nav.explore', 'Explore')}
              </span>
            </Button>
          </Link>

          <Button
            onClick={() => setAddOpen(true)}
            size="lg"
            className="relative -mt-10 px-3 py-2 bg-transparent shadow-none ring-0 transition-all"
          >
            <div className="flex flex-col items-center">
              <span
                className="text-3xl font-extrabold bg-gradient-to-r from-[hsl(var(--brand-cool-start))] via-[hsl(var(--brand-cool-end))] to-[hsl(var(--brand-warm-end))] bg-clip-text text-transparent drop-shadow-[0_1px_1px_rgba(0,0,0,0.6)]"
                style={{ WebkitTextStroke: '0.6px rgba(0,0,0,0.9)' }}
              >
                +
              </span>
              <span
                className="text-base font-extrabold bg-gradient-to-r from-[hsl(var(--brand-cool-start))] via-[hsl(var(--brand-cool-end))] to-[hsl(var(--brand-warm-end))] bg-clip-text text-transparent drop-shadow-[0_1px_1px_rgba(0,0,0,0.6)]"
                style={{ WebkitTextStroke: '0.6px rgba(0,0,0,0.9)' }}
              >
                {t('nav.add_wish', 'Add Wish')}
              </span>
            </div>
          </Button>

          <Link to="/events">
            <Button
              variant="ghost"
              size="sm"
              className={`flex flex-col items-center gap-1 h-auto py-2 -mt-4 ${
                isActive("/events") ? "text-primary" : "text-muted-foreground"
              }`}
            >
              <Calendar className="h-10 w-10 drop-shadow-[0_1px_1px_rgba(0,0,0,0.6)]" strokeWidth={2.4} />
              <span
                className="text-base font-extrabold bg-gradient-to-r from-[hsl(var(--brand-cool-start))] via-[hsl(var(--brand-cool-end))] to-[hsl(var(--brand-warm-end))] bg-clip-text text-transparent drop-shadow-[0_1px_1px_rgba(0,0,0,0.6)]"
                style={{ WebkitTextStroke: '0.6px rgba(0,0,0,0.9)' }}
              >
                {t('nav.events', 'Events')}
              </span>
            </Button>
          </Link>

          <Link to="/profile">
            <Button
              variant="ghost"
              size="sm"
              className={`flex flex-col items-center gap-1 h-auto py-2 -mt-2 ${
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
                className="text-base font-extrabold bg-gradient-to-r from-[hsl(var(--brand-cool-start))] via-[hsl(var(--brand-cool-end))] to-[hsl(var(--brand-warm-end))] bg-clip-text text-transparent drop-shadow-[0_1px_1px_rgba(0,0,0,0.6)]"
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
              description: description || (brand ? `Brand: ${brand}` : null),
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
