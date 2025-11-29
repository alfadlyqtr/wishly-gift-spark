import { useEffect, useState } from "react";
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import { LayoutDashboard, Package, BarChart3, Building2, Bell, LogOut } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import wishlyLogo from "@/assets/wishly-logo.png";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const BrandLayout = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [brandName, setBrandName] = useState<string>("");
  const [logoUrl, setLogoUrl] = useState<string | null>(null);

  const isActive = (path: string) => location.pathname === path;
  const isActivePrefix = (prefix: string) => location.pathname.startsWith(prefix);

  useEffect(() => {
    const fetchBrandInfo = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Get brand info from brands table (cast to any since types may not be generated yet)
      const { data: brand } = await (supabase as any)
        .from("brands")
        .select("brand_name, logo_url")
        .eq("user_id", user.id)
        .maybeSingle();

      if (brand) {
        setBrandName(brand.brand_name || "");
        setLogoUrl(brand.logo_url || null);
      }
    };

    fetchBrandInfo();
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    toast.success(t("auth.logout_success", "Logged out successfully"));
    navigate("/login");
  };

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-slate-50 via-white to-slate-100">
      {/* Top header bar */}
      <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-md border-b border-slate-200 shadow-sm">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            {logoUrl ? (
              <img src={logoUrl} alt={brandName} className="h-9 w-9 rounded-lg object-cover" />
            ) : (
              <img src={wishlyLogo} alt="Wishly" className="h-9 w-auto" />
            )}
            <div className="flex flex-col">
              <span className="text-sm font-bold text-slate-800">
                {brandName || t("brand.header_title", "Brand Portal")}
              </span>
              <span className="text-[10px] text-slate-500">
                {t("brand.header_subtitle", "Business Dashboard")}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" className="text-slate-600">
              <Bell className="h-5 w-5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="text-slate-600"
              onClick={handleLogout}
            >
              <LogOut className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 pb-24">
        <Outlet />
      </main>

      {/* Bottom navigation - Brand specific */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-md border-t border-slate-200 shadow-[0_-4px_20px_rgba(0,0,0,0.08)]">
        <div className="flex items-center justify-around px-2 py-2 max-w-lg mx-auto">
          <Link to="/brand/dashboard" className="flex-1">
            <Button
              variant="ghost"
              size="sm"
              className={`w-full flex flex-col items-center gap-1 h-auto py-2 ${
                isActive("/brand/dashboard")
                  ? "text-primary bg-primary/10"
                  : "text-slate-500"
              }`}
            >
              <LayoutDashboard className="h-6 w-6" strokeWidth={2} />
              <span className="text-[10px] font-semibold">
                {t("brand.nav_dashboard", "Dashboard")}
              </span>
            </Button>
          </Link>

          <Link to="/brand/products" className="flex-1">
            <Button
              variant="ghost"
              size="sm"
              className={`w-full flex flex-col items-center gap-1 h-auto py-2 ${
                isActivePrefix("/brand/products")
                  ? "text-primary bg-primary/10"
                  : "text-slate-500"
              }`}
            >
              <Package className="h-6 w-6" strokeWidth={2} />
              <span className="text-[10px] font-semibold">
                {t("brand.nav_products", "Products")}
              </span>
            </Button>
          </Link>

          <Link to="/brand/insights" className="flex-1">
            <Button
              variant="ghost"
              size="sm"
              className={`w-full flex flex-col items-center gap-1 h-auto py-2 ${
                isActive("/brand/insights")
                  ? "text-primary bg-primary/10"
                  : "text-slate-500"
              }`}
            >
              <BarChart3 className="h-6 w-6" strokeWidth={2} />
              <span className="text-[10px] font-semibold">
                {t("brand.nav_insights", "Insights")}
              </span>
            </Button>
          </Link>

          <Link to="/brand/profile" className="flex-1">
            <Button
              variant="ghost"
              size="sm"
              className={`w-full flex flex-col items-center gap-1 h-auto py-2 ${
                isActive("/brand/profile")
                  ? "text-primary bg-primary/10"
                  : "text-slate-500"
              }`}
            >
              <Building2 className="h-6 w-6" strokeWidth={2} />
              <span className="text-[10px] font-semibold">
                {t("brand.nav_profile", "Brand")}
              </span>
            </Button>
          </Link>
        </div>
      </nav>
    </div>
  );
};

export default BrandLayout;
