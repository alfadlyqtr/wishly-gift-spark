import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Switch } from "@/components/ui/switch";
import { 
  ArrowLeft, Building2, User, Shield, Calendar, Mail, Phone, Globe, 
  Package, Users, Eye, CirclePlus, Clock, Copy, Check, ExternalLink,
  Instagram, Activity, Heart, LayoutGrid, List, X, AlertTriangle, Trash2,
  Ban, Power, Settings, Edit, Wifi, WifiOff, Bell
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { useState } from "react";
import ReactCountryFlag from "react-country-flag";
import { toast } from "sonner";

// Helper to convert country name to ISO code for flag
const getCountryCode = (country: string | null | undefined): string => {
  if (!country) return "";
  const n = country.toString().trim().toLowerCase();
  // If already a 2-letter code
  if (/^[A-Za-z]{2}$/.test(n)) return n.toUpperCase();
  // Map common country names to ISO codes
  const m: Record<string, string> = {
    qatar: "QA",
    uae: "AE",
    "united arab emirates": "AE",
    "saudi arabia": "SA",
    bahrain: "BH",
    kuwait: "KW",
    oman: "OM",
    egypt: "EG",
    jordan: "JO",
    lebanon: "LB",
    "united states": "US",
    usa: "US",
    "united kingdom": "GB",
    uk: "GB",
    canada: "CA",
    germany: "DE",
    france: "FR",
    italy: "IT",
    spain: "ES",
    australia: "AU",
    japan: "JP",
    china: "CN",
    india: "IN",
    brazil: "BR",
    mexico: "MX",
    russia: "RU",
    "south korea": "KR",
    korea: "KR",
    singapore: "SG",
    malaysia: "MY",
    indonesia: "ID",
    thailand: "TH",
    vietnam: "VN",
    philippines: "PH",
    pakistan: "PK",
    bangladesh: "BD",
    turkey: "TR",
    iran: "IR",
    iraq: "IQ",
    syria: "SY",
    yemen: "YE",
    morocco: "MA",
    algeria: "DZ",
    tunisia: "TN",
    libya: "LY",
    sudan: "SD",
    nigeria: "NG",
    "south africa": "ZA",
    kenya: "KE",
    netherlands: "NL",
    belgium: "BE",
    switzerland: "CH",
    austria: "AT",
    sweden: "SE",
    norway: "NO",
    denmark: "DK",
    finland: "FI",
    poland: "PL",
    portugal: "PT",
    greece: "GR",
    ireland: "IE",
    "new zealand": "NZ",
  };
  return m[n] ?? "";
};

const AdminUserDetail = () => {
  const { userId } = useParams<{ userId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [copiedText, setCopiedText] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("account");
  const [productViewMode, setProductViewMode] = useState<"grid" | "list">("grid");
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [realtimeSyncEnabled, setRealtimeSyncEnabled] = useState(false);
  
  // Admin Controls dialogs
  const [deleteAccountDialog, setDeleteAccountDialog] = useState(false);
  const [deleteProductDialog, setDeleteProductDialog] = useState<string | null>(null);
  const [confirmText, setConfirmText] = useState("");
  const [suspendDialog, setSuspendDialog] = useState(false);
  const [suspendMessage, setSuspendMessage] = useState("");
  const [suspendDuration, setSuspendDuration] = useState(24); // preset hours
  const [suspendCustomHours, setSuspendCustomHours] = useState("");

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedText(label);
    setTimeout(() => setCopiedText(null), 2000);
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "—";
    return new Date(dateStr).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const formatDateTime = (dateStr: string | null) => {
    if (!dateStr) return "—";
    return new Date(dateStr).toLocaleString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // Fetch complete user data - with real-time polling when sync is enabled
  const { data: userData, isLoading } = useQuery({
    queryKey: ["admin-user-detail", userId],
    enabled: !!userId,
    refetchOnWindowFocus: false, // Prevent refetch from overwriting optimistic updates
    staleTime: realtimeSyncEnabled ? 0 : 30000, // No stale time when syncing
    refetchInterval: realtimeSyncEnabled ? 2000 : false, // Poll every 2s when sync enabled
    queryFn: async () => {
      if (!userId) return null;

      // Helper to safely run queries
      const safeQuery = async <T,>(fn: () => Promise<{ data: T | null; error: any }>): Promise<T | null> => {
        try {
          const { data, error } = await fn();
          if (error) console.warn("Query error:", error);
          return data;
        } catch (e) {
          console.warn("Query failed:", e);
          return null;
        }
      };

      // Fetch all data in parallel
      const [
        authData,
        profileData,
        brandData,
        followersData,
        followingData,
        activitiesData,
      ] = await Promise.all([
        // Auth data
        safeQuery(() => (supabase as any).rpc("get_user_auth_info", { user_uuid: userId })),
        // Profile data
        safeQuery(() => (supabase as any).from("user_profiles").select("*").eq("id", userId).maybeSingle()),
        // Brand data
        safeQuery(() => (supabase as any).from("brands").select("*").eq("user_id", userId).maybeSingle()),
        // Followers - people who follow this user (user_id is the follower)
        safeQuery(() => (supabase as any)
          .from("followers")
          .select("id, user_id, status, created_at")
          .eq("following_id", userId)),
        // Following - people this user follows (following_id is who they follow)
        safeQuery(() => (supabase as any)
          .from("followers")
          .select("id, following_id, status, created_at")
          .eq("user_id", userId)),
        // Activities
        safeQuery(() => (supabase as any)
          .from("activities")
          .select("*")
          .eq("user_id", userId)
          .order("created_at", { ascending: false })
          .limit(20)),
      ]);

      const auth = Array.isArray(authData) && authData.length > 0 ? authData[0] : null;
      const profile = profileData as any;
      const brand = brandData as any;
      const followers = (followersData as any[]) ?? [];
      const following = (followingData as any[]) ?? [];
      const activities = (activitiesData as any[]) ?? [];

      // Debug: Log brand data to see what's being fetched
      console.log('[AdminUserDetail] Brand data fetched:', brand);
      console.log('[AdminUserDetail] Brand allow_likes:', brand?.allow_likes);
      console.log('[AdminUserDetail] Brand allow_messages:', brand?.allow_messages);

      // Fetch follower profiles
      const followerIds = followers.map((f: any) => f.user_id).filter(Boolean);
      let followerProfiles: any[] = [];
      if (followerIds.length > 0) {
        const { data: profiles } = await (supabase as any)
          .from("user_profiles")
          .select("id, username, full_name, avatar_url")
          .in("id", followerIds);
        followerProfiles = profiles ?? [];
      }

      // Fetch following profiles
      const followingIds = following.map((f: any) => f.following_id).filter(Boolean);
      let followingProfiles: any[] = [];
      if (followingIds.length > 0) {
        const { data: profiles } = await (supabase as any)
          .from("user_profiles")
          .select("id, username, full_name, avatar_url")
          .in("id", followingIds);
        followingProfiles = profiles ?? [];
      }

      // Merge profiles with follower/following data
      const followersWithProfiles = followers.map((f: any) => ({
        ...f,
        profile: followerProfiles.find((p: any) => p.id === f.user_id) || null,
      }));

      const followingWithProfiles = following.map((f: any) => ({
        ...f,
        profile: followingProfiles.find((p: any) => p.id === f.following_id) || null,
      }));

      // Fetch brand products and followers if brand exists
      let brandProducts: any[] = [];
      let brandFollowersList: any[] = [];
      let brandAnalytics = { views: 0, wishlistAdds: 0, likes: 0 };

      if (brand?.id) {
        // Products
        const { data: products } = await (supabase as any)
          .from("brand_products")
          .select("*")
          .eq("brand_id", brand.id);
        brandProducts = products ?? [];

        // Brand followers
        const { data: bfData } = await (supabase as any)
          .from("brand_followers")
          .select("id, follower_id, status, created_at")
          .eq("brand_id", brand.id);
        
        const bfIds = ((bfData as any[]) ?? []).map((f: any) => f.follower_id).filter(Boolean);
        let bfProfiles: any[] = [];
        if (bfIds.length > 0) {
          const { data: profiles } = await (supabase as any)
            .from("user_profiles")
            .select("id, username, full_name, avatar_url")
            .in("id", bfIds);
          bfProfiles = profiles ?? [];
        }

        brandFollowersList = ((bfData as any[]) ?? []).map((f: any) => ({
          ...f,
          profile: bfProfiles.find((p: any) => p.id === f.follower_id) || null,
        }));

        // Analytics
        try {
          const { data: analyticsData } = await (supabase as any).rpc(
            "brand_dashboard_analytics",
            { brand_uuid: brand.id }
          );
          const rows = (analyticsData || []) as any[];
          brandAnalytics = {
            views: rows.reduce((sum, row) => sum + (row.views_count ?? 0), 0),
            wishlistAdds: rows.reduce((sum, row) => sum + (row.adds_count ?? 0), 0),
            likes: rows.reduce((sum, row) => sum + (row.likes_count ?? 0), 0),
          };
        } catch (e) {
          console.warn("Failed to get brand analytics:", e);
        }
      }

      return {
        auth,
        profile,
        brand,
        followers: followersWithProfiles,
        following: followingWithProfiles,
        activities,
        brandProducts,
        brandFollowersList,
        brandAnalytics,
        isBusiness: !!brand,
      };
    },
  });

  // === ADMIN CONTROLS MUTATIONS ===
  
  // Update user profile setting with optimistic update
  const updateProfileSetting = useMutation({
    mutationFn: async ({ field, value }: { field: string; value: any }) => {
      const { error } = await (supabase as any)
        .from("user_profiles")
        .update({ [field]: value })
        .eq("id", userId);
      if (error) throw error;
      return { field, value };
    },
    onMutate: async ({ field, value }) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: ["admin-user-detail", userId] });
      // Snapshot previous value
      const previousData = queryClient.getQueryData(["admin-user-detail", userId]);
      // Optimistically update
      queryClient.setQueryData(["admin-user-detail", userId], (old: any) => {
        if (!old) return old;
        return { ...old, profile: { ...old.profile, [field]: value } };
      });
      return { previousData };
    },
    onSuccess: () => {
      toast.success("Setting updated");
    },
    onError: (err: any, variables, context) => {
      // Rollback on error
      if (context?.previousData) {
        queryClient.setQueryData(["admin-user-detail", userId], context.previousData);
      }
      toast.error(err?.message || "Failed to update");
    },
    // Removed onSettled invalidation - optimistic update is sufficient
  });

  // Update brand setting with optimistic update
  const updateBrandSetting = useMutation({
    mutationFn: async ({ field, value, brandId }: { field: string; value: any; brandId: string }) => {
      const { error } = await (supabase as any)
        .from("brands")
        .update({ [field]: value })
        .eq("id", brandId);
      if (error) throw error;
      return { field, value };
    },
    onMutate: async ({ field, value }) => {
      await queryClient.cancelQueries({ queryKey: ["admin-user-detail", userId] });
      const previousData = queryClient.getQueryData(["admin-user-detail", userId]);
      queryClient.setQueryData(["admin-user-detail", userId], (old: any) => {
        if (!old) return old;
        return { ...old, brand: { ...old.brand, [field]: value } };
      });
      return { previousData };
    },
    onSuccess: () => {
      toast.success("Brand setting updated");
    },
    onError: (err: any, variables, context) => {
      if (context?.previousData) {
        queryClient.setQueryData(["admin-user-detail", userId], context.previousData);
      }
      toast.error(err?.message || "Failed to update");
    },
    // Removed onSettled invalidation - optimistic update is sufficient
    // and invalidation was causing the toggle to reset
  });

  const selectedSuspendHours = suspendCustomHours.trim()
    ? Math.max(0, parseFloat(suspendCustomHours))
    : suspendDuration;

  // Suspend user account
  const suspendAccount = useMutation({
    mutationFn: async ({ message, durationHours }: { message: string; durationHours: number }) => {
      const suspendedUntil = new Date(Date.now() + durationHours * 60 * 60 * 1000).toISOString();
      const { error } = await (supabase as any)
        .from("user_profiles")
        .update({ 
          is_suspended: true, 
          suspension_message: message,
          suspended_until: suspendedUntil 
        })
        .eq("id", userId);
      if (error) throw error;
    },
    onMutate: async ({ message, durationHours }) => {
      await queryClient.cancelQueries({ queryKey: ["admin-user-detail", userId] });
      const previousData = queryClient.getQueryData(["admin-user-detail", userId]);
      const suspendedUntil = new Date(Date.now() + durationHours * 60 * 60 * 1000).toISOString();
      queryClient.setQueryData(["admin-user-detail", userId], (old: any) => {
        if (!old) return old;
        return {
          ...old,
          profile: {
            ...old.profile,
            is_suspended: true,
            suspension_message: message,
            suspended_until: suspendedUntil,
          },
        };
      });
      return { previousData };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-user-detail", userId] });
      toast.success("Account suspended");
      setSuspendDialog(false);
      setSuspendMessage("");
      setSuspendCustomHours("");
    },
    onError: (err: any, _vars, context) => {
      if (context?.previousData) {
        queryClient.setQueryData(["admin-user-detail", userId], context.previousData);
      }
      toast.error(err?.message || "Failed to suspend account");
    },
  });

  // Unsuspend user account
  const unsuspendAccount = useMutation({
    mutationFn: async () => {
      const { error } = await (supabase as any)
        .from("user_profiles")
        .update({ 
          is_suspended: false, 
          suspension_message: null,
          suspended_until: null 
        })
        .eq("id", userId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-user-detail", userId] });
      toast.success("Account unsuspended");
    },
    onError: (err: any) => toast.error(err?.message || "Failed to unsuspend account"),
  });

  // Delete product
  const deleteProduct = useMutation({
    mutationFn: async (productId: string) => {
      const { error } = await (supabase as any)
        .from("brand_products")
        .delete()
        .eq("id", productId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-user-detail", userId] });
      toast.success("Product deleted");
      setDeleteProductDialog(null);
      setSelectedProduct(null);
    },
    onError: (err: any) => toast.error(err?.message || "Failed to delete product"),
  });

  // Delete user account (DANGER!)
  const deleteAccount = useMutation({
    mutationFn: async () => {
      // Delete in order: brand_products, brand_followers, brands, wishlists, followers, activities, user_profiles
      // Note: Some may fail if tables don't exist or have no data - that's OK
      
      if (userData?.brand?.id) {
        await (supabase as any).from("brand_products").delete().eq("brand_id", userData.brand.id);
        await (supabase as any).from("brand_followers").delete().eq("brand_id", userData.brand.id);
        await (supabase as any).from("brands").delete().eq("id", userData.brand.id);
      }
      
      await (supabase as any).from("wishlists").delete().eq("user_id", userId);
      await (supabase as any).from("followers").delete().eq("user_id", userId);
      await (supabase as any).from("followers").delete().eq("following_id", userId);
      await (supabase as any).from("activities").delete().eq("user_id", userId);
      
      const { error } = await (supabase as any)
        .from("user_profiles")
        .delete()
        .eq("id", userId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Account deleted");
      setDeleteAccountDialog(false);
      navigate("/mqtr/users");
    },
    onError: (err: any) => toast.error(err?.message || "Failed to delete account"),
  });

  // Check if user is "online" (active in last 2 minutes based on last_active_at)
  const lastActiveAt = userData?.profile?.last_active_at;
  const lastSignInAt = userData?.auth?.last_sign_in_at;
  const lastActivity = lastActiveAt || lastSignInAt;
  
  const isOnline = lastActiveAt 
    ? (Date.now() - new Date(lastActiveAt).getTime()) < 2 * 60 * 1000  // 2 minutes for real-time
    : false;

  // Check if recently active (within 24 hours)
  const isRecentlyActive = lastActivity
    ? (Date.now() - new Date(lastActivity).getTime()) < 24 * 60 * 60 * 1000
    : false;

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="flex items-center gap-4 mb-6">
          <Button variant="ghost" size="icon" onClick={() => navigate("/mqtr/users")}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-2xl font-bold text-slate-100">Loading...</h1>
        </div>
      </div>
    );
  }

  if (!userData) {
    return (
      <div className="p-6">
        <div className="flex items-center gap-4 mb-6">
          <Button variant="ghost" size="icon" onClick={() => navigate("/mqtr/users")}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-2xl font-bold text-slate-100">User not found</h1>
        </div>
      </div>
    );
  }

  const { auth, profile, brand, followers, following, activities, brandProducts, brandFollowersList, brandAnalytics, isBusiness } = userData;
  
  // For personal accounts: use followers table
  // For business accounts: use brand_followers table as main followers
  const userFollowers = followers.filter((f: any) => f.status === "accepted");
  const userFollowing = following.filter((f: any) => f.status === "accepted");
  const brandFollowersAccepted = brandFollowersList.filter((f: any) => f.status === "accepted");
  
  // Main display - for business, show brand followers as "Followers"
  const displayFollowers = isBusiness ? brandFollowersAccepted : userFollowers;
  const displayFollowing = userFollowing; // User following is same for both

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate("/mqtr/users")}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div className="flex items-center gap-4 flex-1">
          <Avatar className="w-16 h-16">
            <AvatarImage src={isBusiness ? brand?.logo_url : profile?.avatar_url} />
            <AvatarFallback className="text-xl bg-slate-700">
              {(profile?.full_name?.charAt(0) || profile?.username?.charAt(0) || "?").toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div>
            <h1 className="text-2xl font-bold text-slate-100">
              {isBusiness ? brand?.brand_name : profile?.full_name || "No name"}
            </h1>
            <p className="text-slate-400">@{profile?.username || "no-username"}</p>
          </div>
          <Badge className={isBusiness ? "bg-blue-500/20 text-blue-400" : "bg-emerald-500/20 text-emerald-400"}>
            {isBusiness ? <Building2 className="w-3 h-3 mr-1" /> : <User className="w-3 h-3 mr-1" />}
            {isBusiness ? "Business" : "Personal"}
          </Badge>
          {profile?.is_superadmin && (
            <Badge className="bg-amber-500/20 text-amber-400">
              <Shield className="w-3 h-3 mr-1" /> Admin
            </Badge>
          )}
          {/* Online Status */}
          <Badge className={isOnline ? "bg-green-500/20 text-green-400" : isRecentlyActive ? "bg-yellow-500/20 text-yellow-400" : "bg-slate-600 text-slate-400"}>
            {isOnline ? <Wifi className="w-3 h-3 mr-1" /> : <WifiOff className="w-3 h-3 mr-1" />}
            {isOnline ? "Online" : isRecentlyActive ? "Recently Active" : "Offline"}
          </Badge>
        </div>
      </div>

      {/* Quick Stats - Clickable to navigate to relevant tab */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
        <Card 
          className="p-4 bg-slate-800/50 border-slate-700 cursor-pointer hover:bg-slate-800 transition-colors"
          onClick={() => setActiveTab("social")}
        >
          <div className="text-center">
            <Users className="w-5 h-5 mx-auto mb-1 text-emerald-400" />
            <div className="text-2xl font-bold">{displayFollowers.length}</div>
            <div className="text-xs text-slate-500">Followers</div>
          </div>
        </Card>
        <Card 
          className="p-4 bg-slate-800/50 border-slate-700 cursor-pointer hover:bg-slate-800 transition-colors"
          onClick={() => setActiveTab("social")}
        >
          <div className="text-center">
            <Users className="w-5 h-5 mx-auto mb-1 text-blue-400" />
            <div className="text-2xl font-bold">{displayFollowing.length}</div>
            <div className="text-xs text-slate-500">Following</div>
          </div>
        </Card>
        {isBusiness && (
          <>
            <Card 
              className="p-4 bg-slate-800/50 border-slate-700 cursor-pointer hover:bg-slate-800 transition-colors"
              onClick={() => setActiveTab("products")}
            >
              <div className="text-center">
                <Package className="w-5 h-5 mx-auto mb-1 text-primary" />
                <div className="text-2xl font-bold">{brandProducts.length}</div>
                <div className="text-xs text-slate-500">Products</div>
              </div>
            </Card>
            <Card 
              className="p-4 bg-slate-800/50 border-slate-700 cursor-pointer hover:bg-slate-800 transition-colors"
              onClick={() => setActiveTab("brand")}
            >
              <div className="text-center">
                <Eye className="w-5 h-5 mx-auto mb-1 text-cyan-400" />
                <div className="text-2xl font-bold">{brandAnalytics.views}</div>
                <div className="text-xs text-slate-500">Views</div>
              </div>
            </Card>
            <Card 
              className="p-4 bg-slate-800/50 border-slate-700 cursor-pointer hover:bg-slate-800 transition-colors"
              onClick={() => setActiveTab("brand")}
            >
              <div className="text-center">
                <CirclePlus className="w-5 h-5 mx-auto mb-1 text-amber-400" />
                <div className="text-2xl font-bold">{brandAnalytics.wishlistAdds}</div>
                <div className="text-xs text-slate-500">Wishlist Adds</div>
              </div>
            </Card>
          </>
        )}
        <Card 
          className="p-4 bg-slate-800/50 border-slate-700 cursor-pointer hover:bg-slate-800 transition-colors"
          onClick={() => setActiveTab("social")}
        >
          <div className="text-center">
            <Activity className="w-5 h-5 mx-auto mb-1 text-lime-400" />
            <div className="text-2xl font-bold">{activities.length}</div>
            <div className="text-xs text-slate-500">Activities</div>
          </div>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="bg-slate-800 border-slate-700">
          <TabsTrigger value="account" className="data-[state=active]:bg-slate-700">Account</TabsTrigger>
          <TabsTrigger value="social" className="data-[state=active]:bg-slate-700">Social</TabsTrigger>
          {isBusiness && (
            <TabsTrigger value="brand" className="data-[state=active]:bg-slate-700">Brand</TabsTrigger>
          )}
          {isBusiness && (
            <TabsTrigger value="products" className="data-[state=active]:bg-slate-700">Products</TabsTrigger>
          )}
          <TabsTrigger value="godmode" className="data-[state=active]:bg-red-900/50 text-red-400">
            <AlertTriangle className="w-3 h-3 mr-1" /> Admin Controls
          </TabsTrigger>
        </TabsList>

        {/* Account Tab */}
        <TabsContent value="account" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Account Info */}
            <Card className="p-4 bg-slate-800/50 border-slate-700">
              <h3 className="text-sm font-semibold text-slate-300 mb-4 flex items-center gap-2">
                <User className="w-4 h-4" /> Account Info
              </h3>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between items-center">
                  <span className="text-slate-500">User ID</span>
                  <div className="flex items-center gap-1">
                    <code className="text-xs text-slate-400 bg-slate-900 px-2 py-1 rounded">{userId}</code>
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => copyToClipboard(userId!, "id")}>
                      {copiedText === "id" ? <Check className="h-3 w-3 text-green-400" /> : <Copy className="h-3 w-3" />}
                    </Button>
                  </div>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Email</span>
                  <span className="text-slate-300">{isBusiness ? (brand?.email || auth?.email || "—") : (auth?.email || "—")}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Phone</span>
                  <span className="text-slate-300">{isBusiness ? (brand?.phone || auth?.phone || profile?.phone || "—") : (auth?.phone || profile?.phone || "—")}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Full Name</span>
                  <span className="text-slate-300">{profile?.full_name || "—"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Username</span>
                  <span className="text-slate-300">@{profile?.username || "—"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Country</span>
                  <span className="text-slate-300 flex items-center gap-2">
                    {(() => {
                      const countryVal = isBusiness ? (brand?.brand_country || brand?.country || profile?.country) : profile?.country;
                      const code = getCountryCode(countryVal);
                      return countryVal ? (
                        <>
                          {code && <ReactCountryFlag svg countryCode={code} style={{ width: '18px', height: '14px' }} />}
                          {countryVal}
                        </>
                      ) : "—";
                    })()}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">DOB</span>
                  <span className="text-slate-300">{formatDate(profile?.dob)}</span>
                </div>
              </div>
            </Card>

            {/* Activity Info */}
            <Card className="p-4 bg-slate-800/50 border-slate-700">
              <h3 className="text-sm font-semibold text-slate-300 mb-4 flex items-center gap-2">
                <Clock className="w-4 h-4" /> Activity
              </h3>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-500">Joined</span>
                  <span className="text-slate-300">{formatDateTime(profile?.created_at)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Last Sign In</span>
                  <span className="text-slate-300">{formatDateTime(auth?.last_sign_in_at)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Email Confirmed</span>
                  <span className="text-slate-300">{auth?.email_confirmed_at ? "Yes" : "No"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Account Type</span>
                  <Badge className={isBusiness ? "bg-blue-500/20 text-blue-400" : "bg-emerald-500/20 text-emerald-400"}>
                    {isBusiness ? "Business" : "Personal"}
                  </Badge>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Role</span>
                  <Badge className={profile?.is_superadmin ? "bg-amber-500/20 text-amber-400" : "bg-slate-600"}>
                    {profile?.is_superadmin ? "Admin" : "User"}
                  </Badge>
                </div>
              </div>
            </Card>
          </div>

          {/* Raw Profile Data */}
          <Card className="p-4 bg-slate-800/50 border-slate-700">
            <h3 className="text-sm font-semibold text-slate-300 mb-4">
              Raw Profile Data ({profile ? Object.keys(profile).length : 0} fields)
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 text-xs max-h-64 overflow-y-auto">
              {profile && Object.entries(profile).map(([key, value]) => (
                <div key={key} className="flex justify-between items-center gap-2 p-2 rounded bg-slate-900/50">
                  <span className="text-slate-500 font-mono">{key}</span>
                  <span className="text-slate-300 truncate max-w-[120px]">
                    {value === null ? <span className="text-slate-600">null</span> : 
                     value === true ? <Badge className="bg-green-500/20 text-green-400 text-[10px]">true</Badge> : 
                     value === false ? <Badge className="bg-red-500/20 text-red-400 text-[10px]">false</Badge> : 
                     String(value)}
                  </span>
                </div>
              ))}
            </div>
          </Card>
        </TabsContent>

        {/* Social Tab */}
        <TabsContent value="social" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Followers */}
            <Card className="p-4 bg-slate-800/50 border-slate-700">
              <h3 className="text-sm font-semibold text-slate-300 mb-4 flex items-center gap-2">
                <Users className="w-4 h-4 text-emerald-400" /> 
                Followers ({displayFollowers.length})
              </h3>
              <div className="space-y-2 max-h-80 overflow-y-auto">
                {displayFollowers.length > 0 ? (
                  displayFollowers.map((f: any) => {
                    // For brand followers: follower_id, for user followers: user_id
                    const followerId = f.follower_id || f.user_id;
                    return (
                      <div key={f.id} className="flex items-center gap-3 p-2 rounded-lg bg-slate-900/50">
                        <Avatar className="w-10 h-10">
                          <AvatarImage src={f.profile?.avatar_url} />
                          <AvatarFallback className="bg-slate-700 text-sm">
                            {(f.profile?.full_name?.charAt(0) || f.profile?.username?.charAt(0) || "?").toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-slate-200 truncate">
                            {f.profile?.full_name || "Unknown"}
                          </div>
                          <div className="text-xs text-slate-500">
                            @{f.profile?.username || followerId?.slice(0, 8)}
                          </div>
                        </div>
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => navigate(`/mqtr/users/${followerId}`)}
                        >
                          View
                        </Button>
                      </div>
                    );
                  })
                ) : (
                  <div className="text-slate-500 text-center py-8">No followers yet</div>
                )}
              </div>
            </Card>

            {/* Following */}
            <Card className="p-4 bg-slate-800/50 border-slate-700">
              <h3 className="text-sm font-semibold text-slate-300 mb-4 flex items-center gap-2">
                <Users className="w-4 h-4 text-blue-400" /> 
                Following ({displayFollowing.length})
              </h3>
              <div className="space-y-2 max-h-80 overflow-y-auto">
                {displayFollowing.length > 0 ? (
                  displayFollowing.map((f: any) => (
                    <div key={f.id} className="flex items-center gap-3 p-2 rounded-lg bg-slate-900/50">
                      <Avatar className="w-10 h-10">
                        <AvatarImage src={f.profile?.avatar_url} />
                        <AvatarFallback className="bg-slate-700 text-sm">
                          {(f.profile?.full_name?.charAt(0) || f.profile?.username?.charAt(0) || "?").toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-slate-200 truncate">
                          {f.profile?.full_name || "Unknown"}
                        </div>
                        <div className="text-xs text-slate-500">
                          @{f.profile?.username || f.following_id?.slice(0, 8)}
                        </div>
                      </div>
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => navigate(`/mqtr/users/${f.following_id}`)}
                      >
                        View
                      </Button>
                    </div>
                  ))
                ) : (
                  <div className="text-slate-500 text-center py-8">Not following anyone</div>
                )}
              </div>
            </Card>
          </div>

          {/* User Followers (only for personal accounts - business shows brand followers in main Followers section) */}
          {!isBusiness && userFollowers.length > 0 && (
            <Card className="p-4 bg-slate-800/50 border-slate-700">
              <h3 className="text-sm font-semibold text-slate-300 mb-4 flex items-center gap-2">
                <Users className="w-4 h-4 text-slate-400" /> 
                User Connections ({userFollowers.length})
              </h3>
              <div className="text-slate-500 text-sm">
                Showing {userFollowers.length} user followers above
              </div>
            </Card>
          )}

          {/* Recent Activities */}
          <Card className="p-4 bg-slate-800/50 border-slate-700">
            <h3 className="text-sm font-semibold text-slate-300 mb-4 flex items-center gap-2">
              <Activity className="w-4 h-4 text-lime-400" /> 
              Recent Activities ({activities.length})
            </h3>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {activities.length > 0 ? (
                activities.map((activity: any) => (
                  <div key={activity.id} className="flex justify-between items-center p-2 rounded-lg bg-slate-900/50 text-sm">
                    <div className="flex items-center gap-2">
                      <Badge className="bg-slate-700 text-slate-300">{activity.activity_type}</Badge>
                      {activity.target_id && (
                        <code className="text-xs text-slate-500">{activity.target_id.slice(0, 8)}...</code>
                      )}
                    </div>
                    <span className="text-slate-500 text-xs">{formatDateTime(activity.created_at)}</span>
                  </div>
                ))
              ) : (
                <div className="text-slate-500 text-center py-8">No activities yet</div>
              )}
            </div>
          </Card>
        </TabsContent>

        {/* Brand Tab */}
        {isBusiness && (
          <TabsContent value="brand" className="space-y-4">
            {/* Brand Header */}
            <Card className="p-4 bg-slate-800/50 border-slate-700">
              <div className="flex items-center gap-4">
                {brand?.logo_url && (
                  <img src={brand.logo_url} alt={brand.brand_name} className="w-20 h-20 rounded-xl object-cover" />
                )}
                <div>
                  <h2 className="text-xl font-bold text-slate-100">{brand?.brand_name}</h2>
                  {brand?.tagline && <p className="text-slate-400">{brand.tagline}</p>}
                  {brand?.description && <p className="text-sm text-slate-500 mt-2">{brand.description}</p>}
                </div>
                {brand?.is_verified && (
                  <Badge className="bg-blue-500/20 text-blue-400">Verified</Badge>
                )}
              </div>
            </Card>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Contact */}
              <Card className="p-4 bg-slate-800/50 border-slate-700">
                <h3 className="text-sm font-semibold text-slate-300 mb-4">Contact</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Email</span>
                    {brand?.email ? (
                      <a href={`mailto:${brand.email}`} className="text-blue-400 hover:underline">{brand.email}</a>
                    ) : <span className="text-slate-600">—</span>}
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Phone</span>
                    {brand?.phone ? (
                      <a href={`tel:${brand.phone}`} className="text-blue-400 hover:underline">{brand.phone}</a>
                    ) : <span className="text-slate-600">—</span>}
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Website</span>
                    {brand?.brand_website ? (
                      <a href={brand.brand_website} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline flex items-center gap-1">
                        {brand.brand_website} <ExternalLink className="w-3 h-3" />
                      </a>
                    ) : <span className="text-slate-600">—</span>}
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Address</span>
                    <span className="text-slate-300">{brand?.address || "—"}</span>
                  </div>
                </div>
              </Card>

              {/* Details */}
              <Card className="p-4 bg-slate-800/50 border-slate-700">
                <h3 className="text-sm font-semibold text-slate-300 mb-4">Details</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500">Brand ID</span>
                    <div className="flex items-center gap-1">
                      <code className="text-xs text-slate-400 bg-slate-900 px-2 py-1 rounded">{brand?.id?.slice(0, 8)}...</code>
                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => copyToClipboard(brand?.id, "brand-id")}>
                        {copiedText === "brand-id" ? <Check className="h-3 w-3 text-green-400" /> : <Copy className="h-3 w-3" />}
                      </Button>
                    </div>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Category</span>
                    <span className="text-slate-300">{brand?.brand_category || brand?.category || "—"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Country</span>
                    <span className="text-slate-300 flex items-center gap-2">
                      {(() => {
                        const countryVal = brand?.brand_country || brand?.country;
                        const code = getCountryCode(countryVal);
                        return countryVal ? (
                          <>
                            {code && <ReactCountryFlag svg countryCode={code} style={{ width: '18px', height: '14px' }} />}
                            {countryVal}
                          </>
                        ) : "—";
                      })()}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Manager</span>
                    <span className="text-slate-300">{brand?.manager_name || "—"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Created</span>
                    <span className="text-slate-300">{formatDateTime(brand?.created_at)}</span>
                  </div>
                </div>
              </Card>
            </div>

            {/* Social Media */}
            <Card className="p-4 bg-slate-800/50 border-slate-700">
              <h3 className="text-sm font-semibold text-slate-300 mb-4">Social Media</h3>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                {brand?.instagram && (
                  <a href={brand.instagram.startsWith('http') ? brand.instagram : `https://instagram.com/${brand.instagram}`} 
                     target="_blank" rel="noopener noreferrer"
                     className="flex items-center gap-2 text-blue-400 hover:underline">
                    <Instagram className="w-4 h-4" /> {brand.instagram}
                  </a>
                )}
                {brand?.twitter && (
                  <a href={brand.twitter.startsWith('http') ? brand.twitter : `https://twitter.com/${brand.twitter}`} 
                     target="_blank" rel="noopener noreferrer"
                     className="flex items-center gap-2 text-blue-400 hover:underline">
                    Twitter: {brand.twitter}
                  </a>
                )}
                {brand?.facebook && (
                  <a href={brand.facebook.startsWith('http') ? brand.facebook : `https://facebook.com/${brand.facebook}`} 
                     target="_blank" rel="noopener noreferrer"
                     className="flex items-center gap-2 text-blue-400 hover:underline">
                    Facebook: {brand.facebook}
                  </a>
                )}
                {brand?.linkedin && (
                  <a href={brand.linkedin.startsWith('http') ? brand.linkedin : `https://linkedin.com/company/${brand.linkedin}`} 
                     target="_blank" rel="noopener noreferrer"
                     className="flex items-center gap-2 text-blue-400 hover:underline">
                    LinkedIn: {brand.linkedin}
                  </a>
                )}
                {brand?.tiktok && (
                  <a href={brand.tiktok.startsWith('http') ? brand.tiktok : `https://tiktok.com/@${brand.tiktok}`} 
                     target="_blank" rel="noopener noreferrer"
                     className="flex items-center gap-2 text-blue-400 hover:underline">
                    TikTok: {brand.tiktok}
                  </a>
                )}
                {brand?.youtube && (
                  <a href={brand.youtube.startsWith('http') ? brand.youtube : `https://youtube.com/${brand.youtube}`} 
                     target="_blank" rel="noopener noreferrer"
                     className="flex items-center gap-2 text-blue-400 hover:underline">
                    YouTube: {brand.youtube}
                  </a>
                )}
                {!brand?.instagram && !brand?.twitter && !brand?.facebook && !brand?.linkedin && !brand?.tiktok && !brand?.youtube && (
                  <span className="text-slate-500 col-span-full">No social media links</span>
                )}
              </div>
            </Card>

            {/* Settings */}
            <Card className="p-4 bg-slate-800/50 border-slate-700">
              <h3 className="text-sm font-semibold text-slate-300 mb-4">Settings & Preferences</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-500">Public Profile</span>
                  <Badge className={brand?.is_public ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"}>
                    {brand?.is_public ? "Yes" : "No"}
                  </Badge>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Verified</span>
                  <Badge className={brand?.is_verified ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"}>
                    {brand?.is_verified ? "Yes" : "No"}
                  </Badge>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Allow Messages</span>
                  <Badge className={brand?.allow_messages ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"}>
                    {brand?.allow_messages ? "Yes" : "No"}
                  </Badge>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Auto-Approve</span>
                  <Badge className={brand?.auto_approve_followers ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"}>
                    {brand?.auto_approve_followers ? "Yes" : "No"}
                  </Badge>
                </div>
              </div>
            </Card>
          </TabsContent>
        )}

        {/* Products Tab */}
        {isBusiness && (
          <TabsContent value="products" className="space-y-4">
            <Card className="p-4 bg-slate-800/50 border-slate-700">
              {/* Header with view toggle */}
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-slate-300 flex items-center gap-2">
                  <Package className="w-4 h-4" /> Products ({brandProducts.length})
                </h3>
                <div className="flex items-center gap-1 bg-slate-900 rounded-lg p-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    className={`h-7 w-7 p-0 ${productViewMode === "grid" ? "bg-slate-700" : ""}`}
                    onClick={() => setProductViewMode("grid")}
                  >
                    <LayoutGrid className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className={`h-7 w-7 p-0 ${productViewMode === "list" ? "bg-slate-700" : ""}`}
                    onClick={() => setProductViewMode("list")}
                  >
                    <List className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              {/* Grid View */}
              {productViewMode === "grid" && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {brandProducts.length > 0 ? (
                    brandProducts.map((product: any) => (
                      <div 
                        key={product.id} 
                        className="rounded-xl bg-slate-900/50 overflow-hidden cursor-pointer hover:ring-2 hover:ring-primary/50 transition-all"
                        onClick={() => setSelectedProduct(product)}
                      >
                        {product.image_url ? (
                          <img src={product.image_url} alt={product.name} className="w-full h-40 object-cover" />
                        ) : (
                          <div className="w-full h-40 bg-slate-700 flex items-center justify-center">
                            <Package className="w-12 h-12 text-slate-500" />
                          </div>
                        )}
                        <div className="p-3">
                          <h4 className="font-medium text-slate-200 truncate">{product.name || "Untitled"}</h4>
                          {product.description && (
                            <p className="text-xs text-slate-500 mt-1 line-clamp-2">{product.description}</p>
                          )}
                          <div className="flex items-center justify-between mt-2">
                            <span className="text-sm text-slate-400">{product.category || "No category"}</span>
                            <Badge className={product.is_active !== false ? "bg-green-500/20 text-green-400" : "bg-slate-600"}>
                              {product.is_active !== false ? "Active" : "Inactive"}
                            </Badge>
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-slate-500 text-center py-12 col-span-full">No products yet</div>
                  )}
                </div>
              )}

              {/* List View */}
              {productViewMode === "list" && (
                <div className="space-y-2">
                  {brandProducts.length > 0 ? (
                    brandProducts.map((product: any) => (
                      <div 
                        key={product.id} 
                        className="flex items-center gap-4 p-3 rounded-lg bg-slate-900/50 cursor-pointer hover:bg-slate-800 transition-colors"
                        onClick={() => setSelectedProduct(product)}
                      >
                        {product.image_url ? (
                          <img src={product.image_url} alt={product.name} className="w-16 h-16 rounded-lg object-cover" />
                        ) : (
                          <div className="w-16 h-16 rounded-lg bg-slate-700 flex items-center justify-center">
                            <Package className="w-6 h-6 text-slate-500" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <h4 className="font-medium text-slate-200 truncate">{product.name || "Untitled"}</h4>
                          {product.description && (
                            <p className="text-xs text-slate-500 truncate">{product.description}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-slate-400">{product.category || "—"}</span>
                          <Badge className={product.is_active !== false ? "bg-green-500/20 text-green-400" : "bg-slate-600"}>
                            {product.is_active !== false ? "Active" : "Inactive"}
                          </Badge>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-slate-500 text-center py-12">No products yet</div>
                  )}
                </div>
              )}
            </Card>

            {/* Product Detail Dialog */}
            <Dialog open={!!selectedProduct} onOpenChange={(open) => !open && setSelectedProduct(null)}>
              <DialogContent className="max-w-2xl bg-slate-900 border-slate-700">
                <DialogHeader>
                  <DialogTitle className="text-slate-100">Product Details</DialogTitle>
                </DialogHeader>
                {selectedProduct && (
                  <div className="space-y-4">
                    {/* Product Image */}
                    {selectedProduct.image_url ? (
                      <img 
                        src={selectedProduct.image_url} 
                        alt={selectedProduct.name} 
                        className="w-full h-64 object-cover rounded-xl"
                      />
                    ) : (
                      <div className="w-full h-64 bg-slate-800 rounded-xl flex items-center justify-center">
                        <Package className="w-16 h-16 text-slate-600" />
                      </div>
                    )}

                    {/* Product Info */}
                    <div className="space-y-3">
                      <div>
                        <h2 className="text-xl font-bold text-slate-100">{selectedProduct.name || "Untitled"}</h2>
                        {selectedProduct.description && (
                          <p className="text-sm text-slate-400 mt-2">{selectedProduct.description}</p>
                        )}
                      </div>

                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div className="flex justify-between p-2 rounded bg-slate-800/50">
                          <span className="text-slate-500">Category</span>
                          <span className="text-slate-300">{selectedProduct.category || "—"}</span>
                        </div>
                        <div className="flex justify-between p-2 rounded bg-slate-800/50">
                          <span className="text-slate-500">Status</span>
                          <Badge className={selectedProduct.is_active !== false ? "bg-green-500/20 text-green-400" : "bg-slate-600"}>
                            {selectedProduct.is_active !== false ? "Active" : "Inactive"}
                          </Badge>
                        </div>
                        <div className="flex justify-between p-2 rounded bg-slate-800/50">
                          <span className="text-slate-500">Findable</span>
                          <Badge className={selectedProduct.is_findable !== false ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"}>
                            {selectedProduct.is_findable !== false ? "Yes" : "No"}
                          </Badge>
                        </div>
                        <div className="flex justify-between p-2 rounded bg-slate-800/50">
                          <span className="text-slate-500">Add to Wishlist</span>
                          <Badge className={selectedProduct.allow_add_as_item !== false ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"}>
                            {selectedProduct.allow_add_as_item !== false ? "Yes" : "No"}
                          </Badge>
                        </div>
                      </div>

                      {/* Product ID */}
                      <div className="flex items-center justify-between p-2 rounded bg-slate-800/50 text-sm">
                        <span className="text-slate-500">Product ID</span>
                        <div className="flex items-center gap-1">
                          <code className="text-xs text-slate-400">{selectedProduct.id}</code>
                          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => copyToClipboard(selectedProduct.id, "product-id")}>
                            {copiedText === "product-id" ? <Check className="h-3 w-3 text-green-400" /> : <Copy className="h-3 w-3" />}
                          </Button>
                        </div>
                      </div>

                      {/* External Link */}
                      {selectedProduct.product_url && (
                        <Button 
                          variant="outline" 
                          className="w-full"
                          onClick={() => window.open(selectedProduct.product_url, "_blank")}
                        >
                          <ExternalLink className="w-4 h-4 mr-2" /> Open Product URL
                        </Button>
                      )}
                    </div>
                  </div>
                )}
              </DialogContent>
            </Dialog>
          </TabsContent>
        )}

        {/* Admin Controls Tab */}
        <TabsContent value="godmode" className="space-y-4">
          {/* Account Type Indicator */}
          <Card className={`p-4 ${isBusiness ? 'bg-purple-950/30 border-purple-700/50' : 'bg-blue-950/30 border-blue-700/50'}`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {isBusiness ? (
                  <Building2 className="w-6 h-6 text-purple-400" />
                ) : (
                  <User className="w-6 h-6 text-blue-400" />
                )}
                <div>
                  <h3 className={`font-bold ${isBusiness ? 'text-purple-400' : 'text-blue-400'}`}>
                    {isBusiness ? '🏢 Business Account' : '👤 Personal Account'}
                  </h3>
                  <p className="text-sm text-slate-400">
                    {isBusiness 
                      ? `Settings are in the BRANDS table • Brand: ${brand?.brand_name || 'Unknown'}`
                      : 'Settings are in the USER_PROFILES table'}
                  </p>
                </div>
              </div>
              <Badge className={isBusiness ? 'bg-purple-500/20 text-purple-300' : 'bg-blue-500/20 text-blue-300'}>
                {isBusiness ? 'brands table' : 'user_profiles table'}
              </Badge>
            </div>
          </Card>

          {/* Warning Banner */}
          <Card className="p-4 bg-red-950/30 border-red-900/50">
            <div className="flex items-center gap-3">
              <AlertTriangle className="w-6 h-6 text-red-500" />
              <div>
                <h3 className="font-bold text-red-400">⚠️ DANGER ZONE - Admin Controls</h3>
                <p className="text-sm text-red-300/70">Actions here are powerful and some are irreversible. Use with extreme caution.</p>
              </div>
            </div>
          </Card>

          {/* Master Control Toggle */}
          <Card className={`p-4 border-2 ${profile?.admin_master_control ? 'bg-amber-900/20 border-amber-600/50' : 'bg-slate-800/50 border-slate-700'}`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${profile?.admin_master_control ? 'bg-amber-500/20' : 'bg-slate-700'}`}>
                  <Shield className={`w-5 h-5 ${profile?.admin_master_control ? 'text-amber-400' : 'text-slate-400'}`} />
                </div>
                <div>
                  <div className="text-sm font-bold text-slate-200 flex items-center gap-2">
                    Master Control
                    {profile?.admin_master_control && (
                      <Badge className="bg-amber-500/20 text-amber-400 text-xs">ACTIVE</Badge>
                    )}
                  </div>
                  <div className="text-xs text-slate-500">
                    {profile?.admin_master_control 
                      ? "User cannot change settings below - your settings are enforced" 
                      : "User has full control over their settings"}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                {/* Fetch from User button - works for both account types */}
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs border-slate-600 hover:bg-slate-700"
                  onClick={async () => {
                    // Force immediate refetch, bypassing staleTime
                    await queryClient.refetchQueries({ queryKey: ["admin-user-detail", userId] });
                    toast.success(`Fetched latest from ${isBusiness ? 'brand' : 'user'}`);
                  }}
                >
                  <Activity className="w-3 h-3 mr-1" />
                  Fetch from {isBusiness ? 'Brand' : 'User'}
                </Button>
                {/* Real-time Sync Toggle - works for both account types */}
                <Button
                  variant={realtimeSyncEnabled ? "default" : "outline"}
                  size="sm"
                  className={`text-xs ${realtimeSyncEnabled 
                    ? "bg-green-600 hover:bg-green-700 text-white border-green-600" 
                    : "border-slate-600 hover:bg-slate-700"}`}
                  onClick={() => {
                    setRealtimeSyncEnabled(!realtimeSyncEnabled);
                    if (!realtimeSyncEnabled) {
                      toast.success(`Real-time sync enabled - watching ${isBusiness ? 'brand' : 'user'} changes`);
                    } else {
                      toast.info("Real-time sync disabled");
                    }
                  }}
                >
                  <Wifi className={`w-3 h-3 mr-1 ${realtimeSyncEnabled ? "animate-pulse" : ""}`} />
                  {realtimeSyncEnabled ? "Live Sync ON" : "Live Sync"}
                </Button>
                <Switch
                  checked={profile?.admin_master_control === true}
                  onCheckedChange={(checked) => updateProfileSetting.mutate({ field: "admin_master_control", value: checked })}
                  className={profile?.admin_master_control ? "data-[state=checked]:bg-amber-500" : ""}
                />
              </div>
            </div>
          </Card>

          {/* User Settings Controls */}
          <Card className="p-4 bg-slate-800/50 border-slate-700">
            <h3 className="text-sm font-semibold text-slate-300 mb-4 flex items-center gap-2">
              <Settings className="w-4 h-4" /> User Profile Settings
              {profile?.admin_master_control && (
                <Badge className="bg-amber-500/20 text-amber-400 text-xs ml-2">Admin Enforced</Badge>
              )}
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* is_searchable */}
              <div className="flex items-center justify-between p-3 rounded-lg bg-slate-900/50">
                <div>
                  <div className="text-sm font-medium text-slate-200">Searchable</div>
                  <div className="text-xs text-slate-500">User appears in search results</div>
                </div>
                <Switch
                  checked={profile?.is_searchable !== false}
                  onCheckedChange={(checked) => updateProfileSetting.mutate({ field: "is_searchable", value: checked })}
                />
              </div>
              {/* receive_notifications */}
              <div className="flex items-center justify-between p-3 rounded-lg bg-slate-900/50">
                <div>
                  <div className="text-sm font-medium text-slate-200">Notifications</div>
                  <div className="text-xs text-slate-500">Receive push notifications</div>
                </div>
                <Switch
                  checked={profile?.receive_notifications !== false}
                  onCheckedChange={(checked) => updateProfileSetting.mutate({ field: "receive_notifications", value: checked })}
                />
              </div>
              {/* require_follow_approval */}
              <div className="flex items-center justify-between p-3 rounded-lg bg-slate-900/50">
                <div>
                  <div className="text-sm font-medium text-slate-200">Follow Approval</div>
                  <div className="text-xs text-slate-500">Require approval for follows</div>
                </div>
                <Switch
                  checked={profile?.require_follow_approval === true}
                  onCheckedChange={(checked) => updateProfileSetting.mutate({ field: "require_follow_approval", value: checked })}
                />
              </div>
              {/* allow_wishlist_sharing */}
              <div className="flex items-center justify-between p-3 rounded-lg bg-slate-900/50">
                <div>
                  <div className="text-sm font-medium text-slate-200">Wishlist Sharing</div>
                  <div className="text-xs text-slate-500">Allow sharing wishlists</div>
                </div>
                <Switch
                  checked={profile?.allow_wishlist_sharing !== false}
                  onCheckedChange={(checked) => updateProfileSetting.mutate({ field: "allow_wishlist_sharing", value: checked })}
                />
              </div>
              {/* allow_friends_claim */}
              <div className="flex items-center justify-between p-3 rounded-lg bg-slate-900/50">
                <div>
                  <div className="text-sm font-medium text-slate-200">Friends Claim</div>
                  <div className="text-xs text-slate-500">Allow friends to claim items</div>
                </div>
                <Switch
                  checked={profile?.allow_friends_claim !== false}
                  onCheckedChange={(checked) => updateProfileSetting.mutate({ field: "allow_friends_claim", value: checked })}
                />
              </div>
              {/* allow_likes */}
              <div className="flex items-center justify-between p-3 rounded-lg bg-slate-900/50">
                <div>
                  <div className="text-sm font-medium text-slate-200">Allow Likes</div>
                  <div className="text-xs text-slate-500">Allow likes on items</div>
                </div>
                <Switch
                  checked={profile?.allow_likes !== false}
                  onCheckedChange={(checked) => updateProfileSetting.mutate({ field: "allow_likes", value: checked })}
                />
              </div>
              {/* allow_comments */}
              <div className="flex items-center justify-between p-3 rounded-lg bg-slate-900/50">
                <div>
                  <div className="text-sm font-medium text-slate-200">Allow Comments</div>
                  <div className="text-xs text-slate-500">Allow comments on items</div>
                </div>
                <Switch
                  checked={profile?.allow_comments !== false}
                  onCheckedChange={(checked) => updateProfileSetting.mutate({ field: "allow_comments", value: checked })}
                />
              </div>
              {/* is_superadmin */}
              <div className="flex items-center justify-between p-3 rounded-lg bg-slate-900/50 border border-amber-900/50">
                <div>
                  <div className="text-sm font-medium text-amber-400">Super Admin</div>
                  <div className="text-xs text-slate-500">Grant admin privileges</div>
                </div>
                <Switch
                  checked={profile?.is_superadmin === true}
                  onCheckedChange={(checked) => updateProfileSetting.mutate({ field: "is_superadmin", value: checked })}
                />
              </div>
            </div>
          </Card>

          {/* Brand Settings (if business) */}
          {isBusiness && brand && (
            <Card className="p-4 bg-slate-800/50 border-slate-700">
              <h3 className="text-sm font-semibold text-slate-300 mb-4 flex items-center gap-2">
                <Building2 className="w-4 h-4" /> Brand Settings
                {profile?.admin_master_control && (
                  <Badge className="bg-amber-500/20 text-amber-400 text-xs ml-2">Admin Enforced</Badge>
                )}
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* is_public */}
                <div className="flex items-center justify-between p-3 rounded-lg bg-slate-900/50">
                  <div>
                    <div className="text-sm font-medium text-slate-200">Public Profile</div>
                    <div className="text-xs text-slate-500">Brand visible to everyone</div>
                  </div>
                  <Switch
                    checked={brand?.is_public !== false}
                    onCheckedChange={(checked) => updateBrandSetting.mutate({ field: "is_public", value: checked, brandId: brand.id })}
                  />
                </div>
                {/* is_verified */}
                <div className="flex items-center justify-between p-3 rounded-lg bg-slate-900/50 border border-blue-900/50">
                  <div>
                    <div className="text-sm font-medium text-blue-400">Verified Badge</div>
                    <div className="text-xs text-slate-500">Show verified checkmark</div>
                  </div>
                  <Switch
                    checked={brand?.is_verified === true}
                    onCheckedChange={(checked) => updateBrandSetting.mutate({ field: "is_verified", value: checked, brandId: brand.id })}
                  />
                </div>
                {/* allow_messages */}
                <div className="flex items-center justify-between p-3 rounded-lg bg-slate-900/50">
                  <div>
                    <div className="text-sm font-medium text-slate-200">Allow Messages</div>
                    <div className="text-xs text-slate-500">Users can message brand</div>
                  </div>
                  <Switch
                    checked={brand?.allow_messages !== false}
                    onCheckedChange={(checked) => updateBrandSetting.mutate({ field: "allow_messages", value: checked, brandId: brand.id })}
                  />
                </div>
                {/* auto_approve_followers */}
                <div className="flex items-center justify-between p-3 rounded-lg bg-slate-900/50">
                  <div>
                    <div className="text-sm font-medium text-slate-200">Auto-Approve Followers</div>
                    <div className="text-xs text-slate-500">Automatically accept follows</div>
                  </div>
                  <Switch
                    checked={brand?.auto_approve_followers !== false}
                    onCheckedChange={(checked) => updateBrandSetting.mutate({ field: "auto_approve_followers", value: checked, brandId: brand.id })}
                  />
                </div>
                {/* allow_product_requests */}
                <div className="flex items-center justify-between p-3 rounded-lg bg-slate-900/50">
                  <div>
                    <div className="text-sm font-medium text-slate-200">Allow Product Requests</div>
                    <div className="text-xs text-slate-500">Users can request products not in catalog</div>
                  </div>
                  <Switch
                    checked={brand?.allow_product_requests !== false}
                    onCheckedChange={(checked) => updateBrandSetting.mutate({ field: "allow_product_requests", value: checked, brandId: brand.id })}
                  />
                </div>
                {/* allow_questions */}
                <div className="flex items-center justify-between p-3 rounded-lg bg-slate-900/50">
                  <div>
                    <div className="text-sm font-medium text-slate-200">Allow Questions</div>
                    <div className="text-xs text-slate-500">Users can ask questions on product cards</div>
                  </div>
                  <Switch
                    checked={brand?.allow_questions !== false}
                    onCheckedChange={(checked) => updateBrandSetting.mutate({ field: "allow_questions", value: checked, brandId: brand.id })}
                  />
                </div>
                {/* allow_likes */}
                <div className="flex items-center justify-between p-3 rounded-lg bg-slate-900/50">
                  <div>
                    <div className="text-sm font-medium text-slate-200">Allow Likes</div>
                    <div className="text-xs text-slate-500">Users can like products</div>
                  </div>
                  <Switch
                    checked={brand?.allow_likes !== false}
                    onCheckedChange={(checked) => updateBrandSetting.mutate({ field: "allow_likes", value: checked, brandId: brand.id })}
                  />
                </div>
                {/* show_store_link */}
                <div className="flex items-center justify-between p-3 rounded-lg bg-slate-900/50">
                  <div>
                    <div className="text-sm font-medium text-slate-200">Show Store Link</div>
                    <div className="text-xs text-slate-500">Show store icon on product cards</div>
                  </div>
                  <Switch
                    checked={brand?.show_store_link !== false}
                    onCheckedChange={(checked) => updateBrandSetting.mutate({ field: "show_store_link", value: checked, brandId: brand.id })}
                  />
                </div>
                {/* show_analytics_publicly */}
                <div className="flex items-center justify-between p-3 rounded-lg bg-slate-900/50">
                  <div>
                    <div className="text-sm font-medium text-slate-200">Public Analytics</div>
                    <div className="text-xs text-slate-500">Display stats on public profile</div>
                  </div>
                  <Switch
                    checked={brand?.show_analytics_publicly === true}
                    onCheckedChange={(checked) => updateBrandSetting.mutate({ field: "show_analytics_publicly", value: checked, brandId: brand.id })}
                  />
                </div>
              </div>
            </Card>
          )}

          {/* Brand Notifications (if business) */}
          {isBusiness && brand && (
            <Card className="p-4 bg-slate-800/50 border-slate-700">
              <h3 className="text-sm font-semibold text-slate-300 mb-4 flex items-center gap-2">
                <Bell className="w-4 h-4" /> Brand Notifications
                {profile?.admin_master_control && (
                  <Badge className="bg-amber-500/20 text-amber-400 text-xs ml-2">Admin Enforced</Badge>
                )}
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* notify_new_follower */}
                <div className="flex items-center justify-between p-3 rounded-lg bg-slate-900/50">
                  <div>
                    <div className="text-sm font-medium text-slate-200">New Followers</div>
                    <div className="text-xs text-slate-500">Get notified when someone follows</div>
                  </div>
                  <Switch
                    checked={brand?.notify_new_follower !== false}
                    onCheckedChange={(checked) => updateBrandSetting.mutate({ field: "notify_new_follower", value: checked, brandId: brand.id })}
                  />
                </div>
                {/* notify_product_mention */}
                <div className="flex items-center justify-between p-3 rounded-lg bg-slate-900/50">
                  <div>
                    <div className="text-sm font-medium text-slate-200">Product Mentions</div>
                    <div className="text-xs text-slate-500">When users add products to wishlists</div>
                  </div>
                  <Switch
                    checked={brand?.notify_product_mention !== false}
                    onCheckedChange={(checked) => updateBrandSetting.mutate({ field: "notify_product_mention", value: checked, brandId: brand.id })}
                  />
                </div>
                {/* notify_review */}
                <div className="flex items-center justify-between p-3 rounded-lg bg-slate-900/50">
                  <div>
                    <div className="text-sm font-medium text-slate-200">Reviews & Feedback</div>
                    <div className="text-xs text-slate-500">Get notified about new reviews</div>
                  </div>
                  <Switch
                    checked={brand?.notify_review !== false}
                    onCheckedChange={(checked) => updateBrandSetting.mutate({ field: "notify_review", value: checked, brandId: brand.id })}
                  />
                </div>
              </div>
            </Card>
          )}

          {/* Products Management (if business) */}
          {isBusiness && brandProducts.length > 0 && (
            <Card className="p-4 bg-slate-800/50 border-slate-700">
              <h3 className="text-sm font-semibold text-slate-300 mb-4 flex items-center gap-2">
                <Package className="w-4 h-4" /> Manage Products ({brandProducts.length})
              </h3>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {brandProducts.map((product: any) => (
                  <div key={product.id} className="flex items-center justify-between p-3 rounded-lg bg-slate-900/50">
                    <div className="flex items-center gap-3">
                      {product.image_url ? (
                        <img src={product.image_url} alt={product.name} className="w-10 h-10 rounded object-cover" />
                      ) : (
                        <div className="w-10 h-10 rounded bg-slate-700 flex items-center justify-center">
                          <Package className="w-4 h-4 text-slate-500" />
                        </div>
                      )}
                      <div>
                        <div className="text-sm font-medium text-slate-200">{product.name || "Untitled"}</div>
                        <div className="text-xs text-slate-500">{product.id.slice(0, 8)}...</div>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-red-400 hover:text-red-300 hover:bg-red-950/50"
                      onClick={() => setDeleteProductDialog(product.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* Account Status */}
          <Card className="p-4 bg-slate-800/50 border-slate-700">
            <h3 className="text-sm font-semibold text-slate-300 mb-4 flex items-center gap-2">
              <Ban className="w-4 h-4" /> Account Status
            </h3>
            {profile?.is_suspended ? (
              <div className="space-y-3">
                <div className="p-4 rounded-lg bg-red-950/30 border border-red-900/50">
                  <div className="flex items-center gap-2 text-red-400 font-semibold mb-2">
                    <Ban className="w-4 h-4" /> Account Suspended
                  </div>
                  <p className="text-sm text-slate-400 mb-2">
                    <strong>Message:</strong> {profile?.suspension_message || "No message"}
                  </p>
                  <p className="text-sm text-slate-400">
                    <strong>Until:</strong> {profile?.suspended_until ? formatDateTime(profile.suspended_until) : "Indefinite"}
                  </p>
                </div>
                <Button
                  variant="outline"
                  className="w-full border-green-900/50 text-green-400 hover:bg-green-950/50"
                  onClick={() => unsuspendAccount.mutate()}
                  disabled={unsuspendAccount.isPending}
                >
                  <Power className="w-4 h-4 mr-2" /> {unsuspendAccount.isPending ? "Unsuspending..." : "Unsuspend Account"}
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="p-4 rounded-lg bg-green-950/20 border border-green-900/30">
                  <div className="flex items-center gap-2 text-green-400 font-semibold">
                    <Power className="w-4 h-4" /> Account Active
                  </div>
                  <p className="text-sm text-slate-500 mt-1">This account is in good standing.</p>
                </div>
                <Button
                  variant="outline"
                  className="w-full border-amber-900/50 text-amber-400 hover:bg-amber-950/50"
                  onClick={() => setSuspendDialog(true)}
                >
                  <Ban className="w-4 h-4 mr-2" /> Suspend Account
                </Button>
              </div>
            )}
          </Card>

          {/* NUCLEAR OPTIONS */}
          <Card className="p-4 bg-red-950/20 border-red-900/50">
            <h3 className="text-sm font-semibold text-red-400 mb-4 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" /> Nuclear Options
            </h3>
            <div className="space-y-3">
              <Button
                variant="outline"
                className="w-full justify-start border-red-900/50 text-red-400 hover:bg-red-950/50"
                onClick={() => setDeleteAccountDialog(true)}
              >
                <Trash2 className="w-4 h-4 mr-2" /> Delete Entire Account
              </Button>
            </div>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Delete Account Confirmation Dialog */}
      <Dialog open={deleteAccountDialog} onOpenChange={setDeleteAccountDialog}>
        <DialogContent className="bg-slate-900 border-red-900/50">
          <DialogHeader>
            <DialogTitle className="text-red-400 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5" /> Delete Account
            </DialogTitle>
            <DialogDescription className="text-slate-400">
              This will permanently delete the user account and ALL associated data including:
              <ul className="list-disc list-inside mt-2 text-sm">
                <li>User profile</li>
                <li>All wishlists and items</li>
                <li>All followers/following relationships</li>
                <li>All activities</li>
                {isBusiness && <li>Brand profile and all products</li>}
              </ul>
              <p className="mt-4 font-bold text-red-400">This action cannot be undone!</p>
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm text-slate-400 mb-2">Type <code className="text-red-400">DELETE</code> to confirm:</p>
            <input
              type="text"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-200"
              placeholder="Type DELETE"
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => { setDeleteAccountDialog(false); setConfirmText(""); }}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={confirmText !== "DELETE" || deleteAccount.isPending}
              onClick={() => deleteAccount.mutate()}
            >
              {deleteAccount.isPending ? "Deleting..." : "Delete Account"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Product Confirmation Dialog */}
      <Dialog open={!!deleteProductDialog} onOpenChange={(open) => !open && setDeleteProductDialog(null)}>
        <DialogContent className="bg-slate-900 border-red-900/50">
          <DialogHeader>
            <DialogTitle className="text-red-400 flex items-center gap-2">
              <Trash2 className="w-5 h-5" /> Delete Product
            </DialogTitle>
            <DialogDescription className="text-slate-400">
              Are you sure you want to delete this product? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDeleteProductDialog(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={deleteProduct.isPending}
              onClick={() => deleteProductDialog && deleteProduct.mutate(deleteProductDialog)}
            >
              {deleteProduct.isPending ? "Deleting..." : "Delete Product"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Suspend Account Dialog */}
      <Dialog open={suspendDialog} onOpenChange={setSuspendDialog}>
        <DialogContent className="bg-slate-900 border-amber-900/50">
          <DialogHeader>
            <DialogTitle className="text-amber-400 flex items-center gap-2">
              <Ban className="w-5 h-5" /> Suspend Account
            </DialogTitle>
            <DialogDescription className="text-slate-400">
              Suspended users will see a blur overlay with your message when they log in. They cannot use the app until the suspension expires or is lifted.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <label className="text-sm text-slate-400 mb-2 block">Suspension Message</label>
              <textarea
                value={suspendMessage}
                onChange={(e) => setSuspendMessage(e.target.value)}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-200 min-h-[80px]"
                placeholder="Your account has been suspended due to..."
              />
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-sm text-slate-400 mb-2 block">Quick Duration</label>
                <div className="flex flex-wrap gap-2">
                  {[1, 6, 12, 24, 48, 72, 168].map((hours) => (
                    <Button
                      key={hours}
                      variant={suspendDuration === hours && !suspendCustomHours ? "default" : "outline"}
                      size="sm"
                      onClick={() => {
                        setSuspendDuration(hours);
                        setSuspendCustomHours("");
                      }}
                      className={suspendDuration === hours && !suspendCustomHours ? "" : "border-slate-700"}
                    >
                      {hours < 24 ? `${hours}h` : `${hours / 24}d`}
                    </Button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-sm text-slate-400 mb-2 block">Custom Duration (hours)</label>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    min="0"
                    step="0.5"
                    value={suspendCustomHours}
                    onChange={(e) => setSuspendCustomHours(e.target.value)}
                    placeholder="e.g. 2.5"
                    className="bg-slate-800 border-slate-700"
                  />
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      if (suspendCustomHours.trim() === "" && suspendDuration) return;
                      if (suspendCustomHours.trim() === "") {
                        setSuspendCustomHours(String(suspendDuration));
                      }
                    }}
                  >
                    Apply
                  </Button>
                </div>
                <p className="text-xs text-slate-500 mt-2">
                  {selectedSuspendHours > 0
                    ? `Suspension will expire: ${new Date(Date.now() + selectedSuspendHours * 60 * 60 * 1000).toLocaleString()}`
                    : "Enter a custom duration greater than 0 hours."}
                </p>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => { setSuspendDialog(false); setSuspendMessage(""); }}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={!suspendMessage.trim() || suspendAccount.isPending || !(selectedSuspendHours > 0)}
              onClick={() => suspendAccount.mutate({ message: suspendMessage, durationHours: selectedSuspendHours })}
            >
              {suspendAccount.isPending ? "Suspending..." : "Suspend Account"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminUserDetail;
