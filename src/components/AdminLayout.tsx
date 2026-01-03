import { Outlet, Link, useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Mail, Users, Activity, LogOut, Menu, X, MessageCircle, Brain } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";

export const AdminLayout = () => {
  const { t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Fetch pending support messages count
  const { data: pendingCount = 0 } = useQuery({
    queryKey: ["admin-support-messages-pending"],
    queryFn: async () => {
      const { count, error } = await (supabase as any)
        .from("support_messages")
        .select("*", { count: "exact", head: true })
        .eq("status", "pending");
      
      if (error) throw error;
      return count || 0;
    },
    refetchInterval: 30000, // Check every 30 seconds
  });

  const navItems = [
    { to: "/mqtr", label: "Overview", icon: Activity },
    { to: "/mqtr/users", label: "Users", icon: Users },
    { to: "/mqtr/support-messages", label: "Support Messages", icon: MessageCircle, badge: pendingCount },
    { to: "/mqtr/contact", label: "Contact inbox", icon: Mail },
    { to: "/mqtr/ai-usage", label: "AI Usage", icon: Brain },
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50 flex font-sans antialiased">
      {/* Sidebar */}
      <aside className="hidden md:flex w-64 flex-col border-r border-slate-800 bg-slate-900/80 backdrop-blur">
        <div className="px-5 py-5 flex items-center gap-3 border-b border-slate-800/60">
          <img
            src="/wishly logo trans.png"
            alt="Wishly"
            className="h-9 w-9 rounded-full object-cover opacity-90"
          />
          <div className="leading-tight">
            <div className="text-sm font-semibold tracking-tight text-slate-100">Wishly Admin</div>
            <div className="text-[10px] uppercase tracking-wider text-slate-500 font-medium mt-0.5">Superadmin</div>
          </div>
        </div>
        <nav className="flex-1 px-3 py-6 space-y-1 text-sm">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = location.pathname === item.to;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={`flex items-center gap-3 rounded-lg px-3 py-2.5 transition-all duration-200 ${
                  active
                    ? "bg-primary/10 text-primary font-medium shadow-[inset_3px_0_0_0_hsl(var(--primary))]"
                    : "text-slate-400 hover:bg-slate-800/50 hover:text-slate-200"
                }`}
              >
                <Icon className={`w-4 h-4 ${active ? "text-primary" : "text-slate-500"}`} />
                <span className="flex-1">{item.label}</span>
                {item.badge && item.badge > 0 && (
                  <Badge className="bg-amber-900/50 text-amber-400 border-amber-900/50 text-xs h-5 min-w-[20px]">
                    {item.badge}
                  </Badge>
                )}
              </Link>
            );
          })}
        </nav>
        <div className="px-4 py-4 border-t border-slate-800/60">
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start text-slate-400 hover:text-red-400 hover:bg-red-950/20 gap-2"
            onClick={async () => {
              await supabase.auth.signOut();
              navigate("/mqtr");
            }}
          >
            <LogOut className="w-4 h-4" />
            Sign out
          </Button>
        </div>
      </aside>

      {/* Mobile Menu Overlay */}
      {mobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 md:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Mobile Sidebar */}
      <aside className={`fixed inset-y-0 left-0 z-50 w-64 flex flex-col border-r border-slate-800 bg-slate-900 backdrop-blur transform transition-transform duration-300 md:hidden ${
        mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
      }`}>
        <div className="px-5 py-5 flex items-center justify-between border-b border-slate-800/60">
          <div className="flex items-center gap-3">
            <img
              src="/wishly logo trans.png"
              alt="Wishly"
              className="h-9 w-9 rounded-full object-cover opacity-90"
            />
            <div className="leading-tight">
              <div className="text-sm font-semibold tracking-tight text-slate-100">Wishly Admin</div>
              <div className="text-[10px] uppercase tracking-wider text-slate-500 font-medium mt-0.5">Superadmin</div>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-slate-400 hover:text-slate-200"
            onClick={() => setMobileMenuOpen(false)}
          >
            <X className="h-5 w-5" />
          </Button>
        </div>
        <nav className="flex-1 px-3 py-6 space-y-1 text-sm">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = location.pathname === item.to;
            return (
              <Link
                key={item.to}
                to={item.to}
                onClick={() => setMobileMenuOpen(false)}
                className={`flex items-center gap-3 rounded-lg px-3 py-2.5 transition-all duration-200 ${
                  active
                    ? "bg-primary/10 text-primary font-medium shadow-[inset_3px_0_0_0_hsl(var(--primary))]"
                    : "text-slate-400 hover:bg-slate-800/50 hover:text-slate-200"
                }`}
              >
                <Icon className={`w-4 h-4 ${active ? "text-primary" : "text-slate-500"}`} />
                <span className="flex-1">{item.label}</span>
                {item.badge && item.badge > 0 && (
                  <Badge className="bg-amber-900/50 text-amber-400 border-amber-900/50 text-xs h-5 min-w-[20px]">
                    {item.badge}
                  </Badge>
                )}
              </Link>
            );
          })}
        </nav>
        <div className="px-4 py-4 border-t border-slate-800/60">
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start text-slate-400 hover:text-red-400 hover:bg-red-950/20 gap-2"
            onClick={async () => {
              await supabase.auth.signOut();
              navigate("/mqtr");
            }}
          >
            <LogOut className="w-4 h-4" />
            Sign out
          </Button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-14 border-b border-slate-800 bg-slate-900/40 backdrop-blur px-4 sm:px-6 flex items-center justify-between fixed top-0 right-0 left-0 md:left-64 z-[100]">
          <div className="flex items-center gap-2 sm:gap-3">
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden h-9 w-9 text-slate-400 hover:text-slate-200 hover:bg-slate-800"
              onClick={() => setMobileMenuOpen(true)}
            >
              <Menu className="h-5 w-5" />
            </Button>
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <span className="font-mono text-xs bg-slate-800 px-2 py-1 rounded text-slate-400">/mqtr</span>
              <span className="hidden sm:inline">Console</span>
            </div>
          </div>
          <Button asChild variant="outline" size="sm" className="h-8 rounded-full bg-slate-900 border-slate-700 text-slate-300 hover:bg-slate-800 hover:text-white text-xs sm:text-sm">
            <Link to="/">{t("footer.back_home", "Back to home")}</Link>
          </Button>
        </header>

        <main className="flex-1 p-4 sm:p-6 pt-20 bg-gradient-to-br from-slate-950 via-slate-950 to-slate-900/50">
          <div className="max-w-6xl mx-auto space-y-6 sm:space-y-8">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
};

export default AdminLayout;
