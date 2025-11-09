import { Link, Outlet, useLocation } from "react-router-dom";
import { Home, Store, Calendar, User, Plus, Bell, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import wishlyLogo from "@/assets/wishly-logo.png";

export const MainLayout = () => {
  const location = useLocation();

  const isActive = (path: string) => location.pathname === path;

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Top Bar */}
      <header className="sticky top-0 z-50 flex h-16 items-center justify-between border-b bg-card px-4 shadow-sm">
        <Link to="/" className="flex items-center">
          <img src={wishlyLogo} alt="Wishly" className="h-10" />
        </Link>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" className="relative">
            <Bell className="h-5 w-5" />
            <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-secondary" />
          </Button>
          <Button variant="ghost" size="icon">
            <MessageSquare className="h-5 w-5" />
          </Button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto pb-20">
        <Outlet />
      </main>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 border-t bg-card shadow-lg">
        <div className="flex items-center justify-around px-2 py-2">
          <Link to="/">
            <Button
              variant="ghost"
              size="sm"
              className={`flex flex-col items-center gap-1 h-auto py-2 ${
                isActive("/") ? "text-primary" : "text-muted-foreground"
              }`}
            >
              <Home className="h-5 w-5" />
              <span className="text-xs">Home</span>
            </Button>
          </Link>

          <Link to="/explore">
            <Button
              variant="ghost"
              size="sm"
              className={`flex flex-col items-center gap-1 h-auto py-2 ${
                isActive("/explore") ? "text-primary" : "text-muted-foreground"
              }`}
            >
              <Store className="h-5 w-5" />
              <span className="text-xs">Explore</span>
            </Button>
          </Link>

          <Button
            size="lg"
            className="relative -mt-6 h-14 w-14 rounded-full shadow-lg bg-gradient-to-br from-brand-warm-start to-brand-warm-end hover:shadow-xl transition-all"
          >
            <div className="flex flex-col items-center">
              <Plus className="h-6 w-6" />
              <span className="text-[10px] font-medium">Add Wish</span>
            </div>
          </Button>

          <Link to="/events">
            <Button
              variant="ghost"
              size="sm"
              className={`flex flex-col items-center gap-1 h-auto py-2 ${
                isActive("/events") ? "text-primary" : "text-muted-foreground"
              }`}
            >
              <Calendar className="h-5 w-5" />
              <span className="text-xs">Events</span>
            </Button>
          </Link>

          <Link to="/profile">
            <Button
              variant="ghost"
              size="sm"
              className={`flex flex-col items-center gap-1 h-auto py-2 ${
                isActive("/profile") ? "text-primary" : "text-muted-foreground"
              }`}
            >
              <User className="h-5 w-5" />
              <span className="text-xs">Profile</span>
            </Button>
          </Link>
        </div>
      </nav>
    </div>
  );
};
