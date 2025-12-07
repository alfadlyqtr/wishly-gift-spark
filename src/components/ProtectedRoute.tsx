import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Session } from "@supabase/supabase-js";

interface ProtectedRouteProps {
  children: React.ReactNode;
  mode?: "personal" | "business" | "admin";
}

export const ProtectedRoute = ({ children, mode }: ProtectedRouteProps) => {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Use the configured Supabase client (auth required)
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/login" replace />;
  }

  const accountType = (session.user?.user_metadata as any)?.account_type as string | undefined;
  const email = session.user?.email;

  if (mode === "business" && accountType !== "business") {
    return <Navigate to="/dashboard" replace />;
  }

  if (mode === "personal" && accountType === "business") {
    return <Navigate to="/brand/dashboard" replace />;
  }

  if (mode === "admin") {
    if (email !== "admin@tmw.qa") {
      return <Navigate to="/login" replace />;
    }
  }

  return <>{children}</>;
};
