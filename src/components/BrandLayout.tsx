import { useEffect, useState } from "react";
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import { LayoutDashboard, Package, Store, Building2, Bell, MessageSquare, BadgeCheck } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import wishlyLogo from "@/assets/wishly-logo.png";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { usePresence } from "@/hooks/usePresence";

export const BrandLayout = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [brandName, setBrandName] = useState<string>("");
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [isVerified, setIsVerified] = useState<boolean>(false);
  const [userId, setUserId] = useState<string | undefined>(undefined);
  
  // Track user presence for real-time online status
  usePresence(userId);

  const isActive = (path: string) => location.pathname === path;
  const isActivePrefix = (prefix: string) => location.pathname.startsWith(prefix);

  const fetchBrandInfo = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return user;
    
    // Set userId for presence tracking
    setUserId(user.id);

    // Get brand info from brands table
    const { data: brand } = await (supabase as any)
      .from("brands")
      .select("brand_name, logo_url, is_verified")
      .eq("user_id", user.id)
      .maybeSingle();

    if (brand) {
      setBrandName(brand.brand_name || "");
      setLogoUrl(brand.logo_url || null);
      setIsVerified(brand.is_verified === true);
    }
    
    return user;
  };

  useEffect(() => {
    fetchBrandInfo();
  }, []);

  // Real-time listener for is_verified changes from admin
  useEffect(() => {
    let channel: any;

    const setupRealtime = async () => {
      const user = await fetchBrandInfo();
      if (!user) return;

      channel = (supabase as any)
        .channel(`admin-master-control-${user.id}`)
        .on(
          'broadcast',
          { event: 'refresh' },
          () => {
            // Admin triggered a refresh - refetch brand info
            fetchBrandInfo();
          }
        )
        .subscribe();
    };

    setupRealtime();

    return () => {
      if (channel) {
        (supabase as any).removeChannel(channel);
      }
    };
  }, []);

  const handleMessages = () => {
    navigate("/brand/messages");
  };

  const handleNotifications = () => {
    navigate("/brand/notifications");
  };

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-slate-50 via-white to-slate-100">
      {/* Top header bar */}
      <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-md border-b border-slate-200 shadow-sm">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            {/* Combined brand avatar + Wishly logo for verified, or just Wishly logo */}
            {isVerified && logoUrl ? (
              <div className="relative flex items-center">
                {/* Brand avatar with ring */}
                <div className="verified-avatar-sm">
                  <img 
                    src={logoUrl} 
                    alt={brandName} 
                    className="h-10 w-10 rounded-full object-cover border-2 border-white shadow-md" 
                  />
                </div>
                {/* Wishly logo overlapping */}
                <img 
                  src={wishlyLogo} 
                  alt="Wishly" 
                  className="h-6 w-6 rounded-full object-contain bg-white border border-slate-200 shadow-sm -ml-3 z-10" 
                />
              </div>
            ) : (
              <img src={wishlyLogo} alt="Wishly" className="h-9 w-auto" />
            )}
            <div className="flex flex-col">
              <span className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                {brandName || t("brand.header_title", "Brand Portal")}
                {isVerified && (
                  <span className="verified-chip">
                    <BadgeCheck className="h-3 w-3" />
                    Verified
                  </span>
                )}
              </span>
              <span className="text-[10px] text-slate-500">
                {t("brand.header_subtitle", "Business Dashboard")}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              className="text-slate-600"
              onClick={handleNotifications}
            >
              <Bell className="h-5 w-5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="text-slate-600"
              onClick={handleMessages}
            >
              <MessageSquare className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 pb-24">
        <Outlet />
      </main>

      {/* Bottom navigation - Brand specific */}
      <nav
        className="fixed bottom-0 left-0 right-0 z-50 bg-gradient-to-t from-white/95 via-white/90 to-transparent pt-4 pb-2"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 0.5rem)' }}
      >
        <div className="mx-auto w-[min(720px,95%)] p-[2px] rounded-3xl bg-gradient-to-r from-[hsl(var(--brand-cool-start))] via-[hsl(var(--brand-cool-end))] to-[hsl(var(--brand-warm-end))]">
          <div className="flex items-end justify-between gap-2 px-3 py-2 rounded-3xl bg-white/85 backdrop-blur shadow-[0_12px_32px_rgba(0,0,0,0.12)] touch-manipulation">
            <Link to="/brand/dashboard" className="flex flex-1 justify-center min-w-0" style={{ WebkitTapHighlightColor: 'transparent' }}>
              <Button
                variant="ghost"
                size="sm"
                className={`w-full max-w-[82px] flex flex-col items-center gap-1 h-auto py-2 -mt-3 touch-manipulation select-none ${
                  isActive("/brand/dashboard") ? "text-primary" : "text-muted-foreground"
                }`}
              >
                <LayoutDashboard className="h-9 w-9 drop-shadow-[0_1px_1px_rgba(0,0,0,0.45)]" strokeWidth={2.4} />
                <span
                  className="text-[11px] sm:text-sm font-extrabold bg-gradient-to-r from-[hsl(var(--brand-cool-start))] via-[hsl(var(--brand-cool-end))] to-[hsl(var(--brand-warm-end))] bg-clip-text text-transparent drop-shadow-[0_1px_1px_rgba(0,0,0,0.6)]"
                  style={{ WebkitTextStroke: '0.5px rgba(0,0,0,0.85)' }}
                >
                  {t("brand.nav_dashboard", "الرئيسية")}
                </span>
              </Button>
            </Link>

            <Link to="/brand/products" className="flex flex-1 justify-center min-w-0" style={{ WebkitTapHighlightColor: 'transparent' }}>
              <Button
                variant="ghost"
                size="sm"
                className={`w-full max-w-[82px] flex flex-col items-center gap-1 h-auto py-2 -mt-3 touch-manipulation select-none ${
                  isActivePrefix("/brand/products") ? "text-primary" : "text-muted-foreground"
                }`}
              >
                <Package className="h-9 w-9 drop-shadow-[0_1px_1px_rgba(0,0,0,0.45)]" strokeWidth={2.4} />
                <span
                  className="text-[11px] sm:text-sm font-extrabold bg-gradient-to-r from-[hsl(var(--brand-cool-start))] via-[hsl(var(--brand-cool-end))] to-[hsl(var(--brand-warm-end))] bg-clip-text text-transparent drop-shadow-[0_1px_1px_rgba(0,0,0,0.6)]"
                  style={{ WebkitTextStroke: '0.5px rgba(0,0,0,0.85)' }}
                >
                  {t("brand.nav_products", "المنتجات")}
                </span>
              </Button>
            </Link>

            <Link to="/brand/explore" className="flex flex-1 justify-center min-w-0" style={{ WebkitTapHighlightColor: 'transparent' }}>
              <Button
                variant="ghost"
                size="sm"
                className={`w-full max-w-[82px] flex flex-col items-center gap-1 h-auto py-2 -mt-3 touch-manipulation select-none ${
                  isActive("/brand/explore") ? "text-primary" : "text-muted-foreground"
                }`}
              >
                <Store className="h-9 w-9 drop-shadow-[0_1px_1px_rgba(0,0,0,0.45)]" strokeWidth={2.4} />
                <span
                  className="text-[11px] sm:text-sm font-extrabold bg-gradient-to-r from-[hsl(var(--brand-cool-start))] via-[hsl(var(--brand-cool-end))] to-[hsl(var(--brand-warm-end))] bg-clip-text text-transparent drop-shadow-[0_1px_1px_rgba(0,0,0,0.6)]"
                  style={{ WebkitTextStroke: '0.5px rgba(0,0,0,0.85)' }}
                >
                  {t("brand.nav_explore", "Explore")}
                </span>
              </Button>
            </Link>

            <Link to="/brand/profile" className="flex flex-1 justify-center min-w-0" style={{ WebkitTapHighlightColor: 'transparent' }}>
              <Button
                variant="ghost"
                size="sm"
                className={`w-full max-w-[82px] flex flex-col items-center gap-1 h-auto py-2 -mt-3 touch-manipulation select-none ${
                  isActive("/brand/profile") ? "text-primary" : "text-muted-foreground"
                }`}
              >
                {logoUrl ? (
                  <div className={isVerified ? "verified-avatar-sm" : ""}>
                    <img 
                      src={logoUrl} 
                      alt={brandName} 
                      className="h-9 w-9 rounded-full object-cover drop-shadow-[0_1px_1px_rgba(0,0,0,0.45)]" 
                    />
                  </div>
                ) : (
                  <Building2 className="h-9 w-9 drop-shadow-[0_1px_1px_rgba(0,0,0,0.45)]" strokeWidth={2.4} />
                )}
                <span
                  className="text-[11px] sm:text-sm font-extrabold bg-gradient-to-r from-[hsl(var(--brand-cool-start))] via-[hsl(var(--brand-cool-end))] to-[hsl(var(--brand-warm-end))] bg-clip-text text-transparent drop-shadow-[0_1px_1px_rgba(0,0,0,0.6)]"
                  style={{ WebkitTextStroke: '0.5px rgba(0,0,0,0.85)' }}
                >
                  {t("brand.nav_profile", "العلامة")}
                </span>
              </Button>
            </Link>
          </div>
        </div>
      </nav>
    </div>
  );
};

export default BrandLayout;
