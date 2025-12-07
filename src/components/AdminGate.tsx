import { useEffect, useState } from "react";
import { Outlet, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import type { Session } from "@supabase/supabase-js";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import AdminLayout from "./AdminLayout";

const ADMIN_EMAIL = "admin@tmw.qa";

const AdminGate = () => {
  const [session, setSession] = useState<Session | null>(null);
  const [loadingSession, setLoadingSession] = useState(true);
  const [email, setEmail] = useState(ADMIN_EMAIL);
  const [password, setPassword] = useState("");
  const [loggingIn, setLoggingIn] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoadingSession(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoggingIn(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });

      if (error) {
        toast.error(error.message || "Invalid credentials");
        return;
      }

      if (data.user?.email !== ADMIN_EMAIL) {
        toast.error("This area is only for the Wishly superadmin.");
        await supabase.auth.signOut();
        return;
      }
      
      navigate("/mqtr", { replace: true });
    } finally {
      setLoggingIn(false);
    }
  };

  if (loadingSession) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  const emailInSession = session?.user?.email;

  if (session && emailInSession === ADMIN_EMAIL) {
    // Full admin experience
    return <AdminLayout />;
  }

  if (session && emailInSession && emailInSession !== ADMIN_EMAIL) {
    // Logged in, but not the admin account
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-slate-50">
        <Card className="w-full max-w-md bg-slate-900/80 border-slate-800 text-slate-50">
          <CardHeader>
            <CardTitle className="text-base">No access to God mode</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-slate-300">
            <p>This /mqtr space is reserved for the internal Wishly superadmin only.</p>
            <div className="flex gap-2 pt-1">
              <Button size="sm" variant="outline" className="border-slate-700" onClick={() => navigate("/")}>Back to home</Button>
              <Button
                size="sm"
                variant="destructive"
                onClick={async () => {
                  await supabase.auth.signOut();
                  navigate("/mqtr", { replace: true });
                }}
              >
                Sign out
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Not logged in: dedicated dark admin login
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-slate-50">
      <Card className="w-full max-w-md bg-slate-900/80 border-slate-800 text-slate-50">
        <CardHeader className="space-y-1">
          <div className="flex items-center gap-3 mb-1">
            <img
              src="/wishly logo trans.png"
              alt="Wishly"
              className="h-9 w-9 rounded-full object-cover opacity-80"
            />
            <div className="leading-tight">
              <CardTitle className="text-base font-semibold">Wishly Admin console</CardTitle>
              <p className="text-[11px] text-slate-400">Internal superadmin access · /mqtr</p>
            </div>
          </div>
          <p className="text-xs text-amber-300/80">
            This space is for TMW/Wishly operators only. If you are not supposed to be here, please close this page.
          </p>
        </CardHeader>
        <CardContent>
          <form className="space-y-3" onSubmit={handleAdminLogin}>
            <div className="space-y-1.5 text-xs">
              <label htmlFor="admin-email" className="text-slate-200">
                Email
              </label>
              <Input
                id="admin-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="bg-slate-900/60 border-slate-700 text-slate-50 placeholder:text-slate-500"
                autoComplete="username"
              />
            </div>
            <div className="space-y-1.5 text-xs">
              <label htmlFor="admin-password" className="text-slate-200">
                Password
              </label>
              <Input
                id="admin-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="bg-slate-900/60 border-slate-700 text-slate-50 placeholder:text-slate-500"
                autoComplete="current-password"
              />
            </div>
            <Button
              type="submit"
              className="w-full mt-2 bg-primary text-primary-foreground hover:opacity-90"
              disabled={loggingIn}
            >
              {loggingIn ? "Entering…" : "Enter admin"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminGate;
