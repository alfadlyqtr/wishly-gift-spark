import { useEffect, useState } from "react";
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import { LayoutDashboard, Package, Store, Building2, Bell, MessageSquare, BadgeCheck, Heart } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import wishlyLogo from "@/assets/wishly-logo.png";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { usePresence } from "@/hooks/usePresence";
import { AddProductModal } from "@/components/brands/AddProductModal";

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
      <header className="fixed top-0 left-0 right-0 z-[100] bg-white/80 backdrop-blur-md border-b border-slate-200 shadow-sm">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            {/* Combined brand avatar + Wishly logo for verified, or just Wishly logo */}
            {isVerified && logoUrl ? (
              <div className="relative flex items-center">
                {/* Brand avatar with golden ring */}
                <div className="relative p-[2px] rounded-full bg-gradient-to-tr from-[#FFD700] via-[#FDB931] to-[#FFD700] shadow-[0_0_15px_rgba(253,185,49,0.4)] ring-1 ring-[#FDB931]/50">
                  <img 
                    src={logoUrl} 
                    alt={brandName} 
                    className="h-10 w-10 rounded-full object-cover border-2 border-white" 
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
                  <span className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-amber-50 text-[10px] font-bold text-amber-600 border border-amber-200 shadow-sm animate-in fade-in zoom-in duration-300">
                    <BadgeCheck className="h-3 w-3 fill-amber-500 text-white" />
                    {t("brand.verified", "Verified")}
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
      <main className="flex-1 pt-16 pb-[calc(env(safe-area-inset-bottom,0px)+6.5rem)]">
        <Outlet />
      </main>

      {/* Bottom navigation - Brand specific */}
      <nav
        className="fixed bottom-0 left-0 right-0 z-50 pt-3 pb-[calc(env(safe-area-inset-bottom,0px)+0.5rem)]"
      >
        <div className="mx-auto w-[min(720px,95%)] px-2">
          <div className="relative flex items-center justify-between gap-2 px-3 py-2 h-[72px] touch-manipulation">
            <svg
              className="pointer-events-none absolute inset-0 h-full w-full drop-shadow-[0_16px_40px_rgba(0,0,0,0.25)]"
              viewBox="0 0 400 80"
              preserveAspectRatio="none"
              aria-hidden="true"
            >
              <defs>
                <linearGradient id="brandNavGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="hsl(240, 50%, 30%)" />
                  <stop offset="50%" stopColor="hsl(260, 60%, 40%)" />
                  <stop offset="100%" stopColor="hsl(35, 90%, 50%)" />
                </linearGradient>
              </defs>
              <path
                d="M0,28 Q0,8 20,8 L150,8 Q165,8 172,20 Q185,44 200,44 Q215,44 228,20 Q235,8 250,8 L380,8 Q400,8 400,28 L400,60 Q400,80 380,80 L20,80 Q0,80 0,60 Z"
                fill="url(#brandNavGradient)"
              />
            </svg>
            <div className="relative z-10 flex w-full items-center justify-between gap-2">
            <Link to="/brand/dashboard" className="flex flex-1 justify-center min-w-0 [-webkit-tap-highlight-color:transparent]">
              <Button
                variant="ghost"
                size="sm"
                className={`w-full max-w-[82px] flex flex-col items-center gap-1 h-auto py-2 touch-manipulation select-none hover:bg-white/10 ${
                  isActive("/brand/dashboard") ? "text-white" : "text-white/70"
                }`}
              >
                <LayoutDashboard className="h-9 w-9" strokeWidth={2.5} />
              </Button>
            </Link>

            <Link to="/brand/products" className="flex flex-1 justify-center min-w-0 [-webkit-tap-highlight-color:transparent]">
              <Button
                variant="ghost"
                size="sm"
                className={`w-full max-w-[82px] flex flex-col items-center gap-1 h-auto py-2 touch-manipulation select-none hover:bg-white/10 ${
                  isActivePrefix("/brand/products") ? "text-white" : "text-white/70"
                }`}
              >
                <Package className="h-9 w-9" strokeWidth={2.5} />
              </Button>
            </Link>

            <div className="flex flex-1 justify-center min-w-0">
              <AddProductModal>
                <Button
                  type="button"
                  size="icon"
                  className="relative -mt-14 h-[68px] w-[68px] rounded-full bg-transparent shadow-none ring-0 transition-all touch-manipulation select-none [-webkit-tap-highlight-color:transparent]"
                  aria-label={t("brand.product.add_title", "Add Product")}
                >
                  <span className="absolute inset-0 rounded-full bg-gradient-to-r from-[hsl(var(--brand-cool-start))] via-[hsl(var(--brand-cool-end))] to-[hsl(var(--brand-warm-end))]" />
                  <span className="absolute inset-[3px] rounded-full bg-black" />
                  <span
                    className="relative text-white text-[38px] leading-none font-extrabold"
                    style={{ WebkitTextStroke: '0.6px rgba(0,0,0,0.9)' }}
                    aria-hidden="true"
                  >
                    +
                  </span>
                </Button>
              </AddProductModal>
            </div>

            <Link to="/brand/explore" className="flex flex-1 justify-center min-w-0 [-webkit-tap-highlight-color:transparent]">
              <Button
                variant="ghost"
                size="sm"
                className={`w-full max-w-[82px] flex flex-col items-center gap-1 h-auto py-2 touch-manipulation select-none hover:bg-white/10 ${
                  isActive("/brand/explore") ? "text-white" : "text-white/70"
                }`}
              >
                <Store className="h-9 w-9" strokeWidth={2.5} />
              </Button>
            </Link>

            <Link to="/brand/profile" className="flex flex-1 justify-center min-w-0 [-webkit-tap-highlight-color:transparent]">
              <Button
                variant="ghost"
                size="sm"
                className={`w-full max-w-[82px] flex flex-col items-center gap-1 h-auto py-2 touch-manipulation select-none hover:bg-white/10 ${
                  isActive("/brand/profile") ? "text-white" : "text-white/70"
                }`}
              >
                {logoUrl ? (
                  <div className={isVerified ? "relative p-[1.5px] rounded-full bg-gradient-to-tr from-[#FFD700] via-[#FDB931] to-[#FFD700] shadow-[0_0_10px_rgba(253,185,49,0.3)]" : ""}>
                    <img 
                      src={logoUrl} 
                      alt={brandName} 
                      className={`h-11 w-11 rounded-full object-cover ring-2 ring-white/25 ${isVerified ? "border-2 border-white" : ""}`} 
                    />
                  </div>
                ) : (
                  <Building2 className="h-9 w-9" strokeWidth={2.5} />
                )}
              </Button>
            </Link>
            </div>
          </div>
        </div>
      </nav>
    </div>
  );
};

export default BrandLayout;
