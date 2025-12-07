import { Outlet, Link, useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Mail, Users, Activity, LogOut } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export const AdminLayout = () => {
  const { t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();

  const navItems = [
    { to: "/mqtr", label: "Overview", icon: Activity },
    { to: "/mqtr/users", label: "Users", icon: Users },
    { to: "/mqtr/contact", label: "Contact inbox", icon: Mail },
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
                <span>{item.label}</span>
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
        <header className="h-14 border-b border-slate-800 bg-slate-900/40 backdrop-blur px-6 flex items-center justify-between sticky top-0 z-10">
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <span className="font-mono text-xs bg-slate-800 px-2 py-1 rounded text-slate-400">/mqtr</span>
            <span>Console</span>
          </div>
          <Button asChild variant="outline" size="sm" className="h-8 rounded-full bg-slate-900 border-slate-700 text-slate-300 hover:bg-slate-800 hover:text-white">
            <Link to="/">{t("footer.back_home", "Back to home")}</Link>
          </Button>
        </header>

        <main className="flex-1 p-6 overflow-y-auto bg-gradient-to-br from-slate-950 via-slate-950 to-slate-900/50">
          <div className="max-w-6xl mx-auto space-y-8">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
};

export default AdminLayout;
