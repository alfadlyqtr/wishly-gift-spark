import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Session } from "@supabase/supabase-js";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Ban, Clock, MessageCircle, Send, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

interface ProtectedRouteProps {
  children: React.ReactNode;
  mode?: "personal" | "business" | "admin";
}

// Suspension overlay component
const SuspensionOverlay = ({ message, suspendedUntil, session }: { message: string; suspendedUntil: string | null; session: Session | null }) => {
  const [timeLeft, setTimeLeft] = useState("");
  const [supportDialog, setSupportDialog] = useState(false);
  const [supportMessage, setSupportMessage] = useState("");
  const [canSendMessage, setCanSendMessage] = useState(true);
  const [cooldownTimeLeft, setCooldownTimeLeft] = useState("");

  // Fetch user profile and brand info for correct username
  const { data: userInfo } = useQuery({
    queryKey: ["user-info-for-support", session?.user?.id],
    queryFn: async () => {
      if (!session?.user?.id) return null;
      
      // First get user profile
      const { data: profile, error: profileError } = await (supabase as any)
        .from("user_profiles")
        .select("full_name, username, avatar_url, account_type")
        .eq("id", session.user.id)
        .single();
      
      if (profileError) return null;
      
      // If business account, get brand info
      if (profile?.account_type === 'business') {
        const { data: brand, error: brandError } = await (supabase as any)
          .from("brands")
          .select("name, logo_url")
          .eq("owner_id", session.user.id)
          .single();
        
        if (!brandError && brand) {
          return {
            ...profile,
            brandName: brand.name,
            brandLogo: brand.logo_url
          };
        }
      }
      
      return profile;
    },
    enabled: !!session?.user?.id,
  });

  // Check if user can send a message (24h cooldown)
  const { data: lastMessage, refetch: refetchLastMessage } = useQuery({
    queryKey: ["last-support-message", session?.user?.id],
    queryFn: async () => {
      if (!session?.user?.id) return null;
      
      const { data, error } = await (supabase as any)
        .from("support_messages")
        .select("created_at")
        .eq("user_id", session.user.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .single();
      
      if (error && error.code !== 'PGRST116') throw error; // PGRST116 = no rows
      return data;
    },
    enabled: !!session?.user?.id,
  });

  // Calculate cooldown
  useEffect(() => {
    if (!lastMessage?.created_at) {
      setCanSendMessage(true);
      setCooldownTimeLeft("");
      return;
    }

    const checkCooldown = () => {
      const lastSent = new Date(lastMessage.created_at).getTime();
      const now = new Date().getTime();
      const cooldownEnd = lastSent + (24 * 60 * 60 * 1000); // 24 hours
      const diff = cooldownEnd - now;

      if (diff <= 0) {
        setCanSendMessage(true);
        setCooldownTimeLeft("");
      } else {
        setCanSendMessage(false);
        const hours = Math.floor(diff / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        setCooldownTimeLeft(`${hours}h ${minutes}m`);
      }
    };

    checkCooldown();
    const interval = setInterval(checkCooldown, 60000); // Check every minute
    return () => clearInterval(interval);
  }, [lastMessage]);

  // Get the correct display name - for business accounts use brand name
  const displayName = userInfo?.brandName || userInfo?.full_name || userInfo?.username || session?.user?.email?.split('@')[0] || 'Unknown';

  // Send support message mutation
  const sendSupportMessage = useMutation({
    mutationFn: async (message: string) => {
      if (!session?.user?.id) throw new Error("Not authenticated");
      if (!canSendMessage) throw new Error("Please wait 24 hours between messages");
      
      const { error } = await (supabase as any)
        .from("support_messages")
        .insert({
          user_id: session.user.id,
          username: displayName,
          email: session.user.email || 'unknown@example.com',
          message: message.trim(),
        });
      
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Support message sent successfully");
      setSupportDialog(false);
      setSupportMessage("");
      refetchLastMessage(); // Refresh to update cooldown
    },
    onError: (err: any) => {
      toast.error(err?.message || "Failed to send support message");
    },
  });

  useEffect(() => {
    if (!suspendedUntil) return;
    
    const updateTimer = () => {
      const now = new Date().getTime();
      const until = new Date(suspendedUntil).getTime();
      const diff = until - now;
      
      if (diff <= 0) {
        setTimeLeft("Suspension expired - please refresh");
        return;
      }
      
      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);
      
      if (days > 0) {
        setTimeLeft(`${days}d ${hours}h ${minutes}m`);
      } else if (hours > 0) {
        setTimeLeft(`${hours}h ${minutes}m ${seconds}s`);
      } else {
        setTimeLeft(`${minutes}m ${seconds}s`);
      }
    };
    
    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [suspendedUntil]);

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center">
      {/* Blurred background */}
      <div className="absolute inset-0 bg-black/80 backdrop-blur-xl" />
      
      {/* Suspension card */}
      <div className="relative z-10 max-w-md w-full mx-4 bg-slate-900 border border-red-900/50 rounded-2xl p-8 shadow-2xl">
        <div className="text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-950/50 flex items-center justify-center">
            <Ban className="w-8 h-8 text-red-500" />
          </div>
          <h1 className="text-2xl font-bold text-red-400 mb-2">Account Suspended</h1>
          <p className="text-slate-400 mb-6">{message || "Your account has been suspended."}</p>
          
          {suspendedUntil && (
            <div className="bg-slate-800/50 rounded-xl p-4 mb-6">
              <div className="flex items-center justify-center gap-2 text-slate-300 mb-1">
                <Clock className="w-4 h-4" />
                <span className="text-sm">Suspension expires in:</span>
              </div>
              <div className="text-2xl font-mono font-bold text-amber-400">{timeLeft}</div>
            </div>
          )}
          
          <p className="text-xs text-slate-500 mb-4">
            If you believe this is a mistake, please contact support.
          </p>
          
          {canSendMessage ? (
            <Button
              className="w-full bg-blue-600 text-white hover:bg-blue-700 border-blue-500 shadow-lg"
              onClick={() => setSupportDialog(true)}
            >
              <MessageCircle className="w-4 h-4 mr-2" /> Contact Support
            </Button>
          ) : (
            <div className="text-center">
              <Button
                className="w-full bg-slate-700 text-slate-400 cursor-not-allowed"
                disabled
              >
                <Clock className="w-4 h-4 mr-2" /> Message Sent
              </Button>
              <p className="text-xs text-slate-500 mt-2">
                You can send another message in {cooldownTimeLeft}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Support Dialog */}
      <Dialog open={supportDialog} onOpenChange={setSupportDialog}>
        <DialogContent className="bg-slate-900 border-slate-700 z-[10000]">
          <DialogHeader>
            <DialogTitle className="text-white font-bold">Contact Support</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <div className="text-sm text-white">
                <strong>Username:</strong> {displayName}
              </div>
              <div className="text-sm text-white">
                <strong>Email:</strong> {session?.user?.email || 'unknown@example.com'}
              </div>
              {userInfo?.account_type && (
                <div className="text-sm text-white">
                  <strong>Account Type:</strong> {userInfo.account_type === 'business' ? 'Business' : 'Personal'}
                  {userInfo.brandName && <span className="ml-2 text-purple-400">({userInfo.brandName})</span>}
                </div>
              )}
            </div>
            
            <div>
              <label className="text-sm text-white mb-2 block">Message</label>
              <Textarea
                value={supportMessage}
                onChange={(e) => setSupportMessage(e.target.value)}
                placeholder="Please describe your issue or appeal your suspension..."
                className="bg-slate-800 border-slate-600 text-white min-h-[120px]"
                maxLength={1000}
              />
              <p className="text-xs text-gray-300 mt-1">
                {supportMessage.length}/1000 characters
              </p>
            </div>
          </div>
          
          <div className="flex justify-end gap-2">
            <Button
              className="bg-red-600 text-white hover:bg-red-700"
              onClick={() => {
                setSupportDialog(false);
                setSupportMessage("");
              }}
            >
              Cancel
            </Button>
            <Button
              className="bg-blue-600 text-white hover:bg-blue-700"
              disabled={!supportMessage.trim() || sendSupportMessage.isPending || !canSendMessage}
              onClick={() => {
                sendSupportMessage.mutate(supportMessage);
              }}
            >
              {sendSupportMessage.isPending ? (
                <>
                  <div className="w-4 h-4 mr-2 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4 mr-2" /> Send Message
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

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

  // Check suspension status and auto-unsuspend if expired
  const { data: suspensionData } = useQuery({
    queryKey: ["suspension-check", session?.user?.id],
    queryFn: async () => {
      if (!session?.user?.id) return null;
      const { data, error } = await (supabase as any)
        .from("user_profiles")
        .select("is_suspended, suspension_message, suspended_until")
        .eq("id", session.user.id)
        .maybeSingle();
      if (error) return null;
      
      // Auto-unsuspend if suspension has expired
      if (data?.is_suspended && data?.suspended_until) {
        const now = new Date().getTime();
        const until = new Date(data.suspended_until).getTime();
        if (now >= until) {
          // Suspension expired - clear it in the database
          await (supabase as any)
            .from("user_profiles")
            .update({ 
              is_suspended: false, 
              suspension_message: null, 
              suspended_until: null 
            })
            .eq("id", session.user.id);
          
          // Return unsuspended state
          return { ...data, is_suspended: false };
        }
      }
      
      return data;
    },
    enabled: !!session?.user?.id,
    refetchInterval: 30000, // Check every 30 seconds
  });

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

  // Check if user is suspended (skip for admin mode)
  if (mode !== "admin" && suspensionData?.is_suspended) {
    // Check if suspension has expired
    if (suspensionData.suspended_until) {
      const now = new Date().getTime();
      const until = new Date(suspensionData.suspended_until).getTime();
      if (now < until) {
        return (
          <>
            {children}
            <SuspensionOverlay 
              message={suspensionData.suspension_message} 
              suspendedUntil={suspensionData.suspended_until}
              session={session}
            />
          </>
        );
      }
    } else {
      // Indefinite suspension
      return (
        <>
          {children}
          <SuspensionOverlay 
            message={suspensionData.suspension_message} 
            suspendedUntil={null}
            session={session}
          />
        </>
      );
    }
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
