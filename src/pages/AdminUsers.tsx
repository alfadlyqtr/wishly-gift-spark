import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Search, Building2, User, Shield, Calendar, Mail, X, Package, Heart, Users, Gift, Clock, Globe, Phone, Instagram, ExternalLink, Eye, CirclePlus, ListChecks, CalendarDays, UserCheck, UserPlus } from "lucide-react";

type UserProfile = {
  id: string;
  username: string | null;
  full_name: string | null;
  dob: string | null;
  avatar_url: string | null;
  created_at: string;
  account_type?: string;
  country?: string;
};

const AdminUsers = () => {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "personal" | "business">("all");
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

  // Fetch user profiles
  const { data: profiles, isLoading: profilesLoading } = useQuery({
    queryKey: ["admin-user-profiles"],
    queryFn: async () => {
      try {
        const { data, error } = await (supabase as any)
          .from("user_profiles")
          .select("id, username, full_name, dob, avatar_url, created_at, account_type, country")
          .order("created_at", { ascending: false });

        if (!error) return (data ?? []) as UserProfile[];

        // Fallback to minimal columns
        const { data: fallback } = await (supabase as any)
          .from("user_profiles")
          .select("id, username, full_name, dob, avatar_url, created_at")
          .order("created_at", { ascending: false });

        return (fallback ?? []) as UserProfile[];
      } catch (e) {
        console.error("AdminUsers: error loading profiles", e);
        return [] as UserProfile[];
      }
    },
  });

  // Fetch brand logos for business users
  const { data: brandLogos } = useQuery({
    queryKey: ["admin-user-brand-logos"],
    queryFn: async () => {
      try {
        const { data } = await (supabase as any)
          .from("brands")
          .select("user_id, logo_url");

        const map: Record<string, string> = {};
        (data ?? []).forEach((row: any) => {
          if (row.user_id && row.logo_url) {
            map[row.user_id] = row.logo_url;
          }
        });
        return map;
      } catch (e) {
        return {} as Record<string, string>;
      }
    },
  });

  // Fetch emails from contact_messages as fallback
  const { data: userEmails } = useQuery({
    queryKey: ["admin-user-emails"],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("contact_messages")
        .select("user_id, email");
      const emailMap: Record<string, string> = {};
      (data ?? []).forEach((row: any) => {
        if (row.user_id && row.email) {
          emailMap[row.user_id] = row.email;
        }
      });
      return emailMap;
    },
  });

  // Fetch superadmin flags
  const { data: superadmins } = useQuery({
    queryKey: ["admin-superadmins"],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("user_profiles")
        .select("id")
        .eq("is_superadmin", true);
      return (data ?? []).map((u: any) => u.id);
    },
  });

  const filteredProfiles = (profiles ?? []).filter((p) => {
    const email = userEmails?.[p.id] || "";
    const matchesSearch =
      !search ||
      p.username?.toLowerCase().includes(search.toLowerCase()) ||
      p.full_name?.toLowerCase().includes(search.toLowerCase()) ||
      p.id.toLowerCase().includes(search.toLowerCase()) ||
      email.toLowerCase().includes(search.toLowerCase());

    const hasBrand = Boolean(brandLogos && brandLogos[p.id]);
    const accountType = hasBrand ? "business" : (p.account_type || "personal");
    const matchesFilter =
      filter === "all" ||
      (filter === "personal" && accountType !== "business") ||
      (filter === "business" && accountType === "business");

    return matchesSearch && matchesFilter;
  });

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

  // Get selected user data
  const selectedUser = selectedUserId ? profiles?.find((p) => p.id === selectedUserId) : null;
  const selectedHasBrand = selectedUserId ? Boolean(brandLogos && brandLogos[selectedUserId]) : false;
  const selectedAccountType = selectedHasBrand ? "business" : (selectedUser?.account_type || "personal");

  // Fetch full details for selected user
  const { data: userDetails, isLoading: detailsLoading } = useQuery({
    queryKey: ["admin-user-details", selectedUserId],
    enabled: !!selectedUserId,
    queryFn: async () => {
      if (!selectedUserId) return null;

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

      // Fetch all related data in parallel with error handling
      const [
        authData,
        wishlistsData,
        eventsData,
        followersData,
        followingData,
        giverStatsData,
        brandData,
      ] = await Promise.all([
        // Auth user data (email, last sign in) - via SQL function
        safeQuery(() => (supabase as any).rpc("get_user_auth_info", { user_uuid: selectedUserId })),
        // Wishlists
        safeQuery(() => (supabase as any).from("wishlists").select("id, title, is_public, created_at").eq("user_id", selectedUserId)),
        // Events
        safeQuery(() => (supabase as any).from("events").select("id, title, event_date, created_at").eq("user_id", selectedUserId)),
        // Followers (people following this user)
        safeQuery(() => (supabase as any).from("followers").select("id, status").eq("following_id", selectedUserId)),
        // Following (people this user follows)
        safeQuery(() => (supabase as any).from("followers").select("id, status").eq("user_id", selectedUserId)),
        // Giver stats
        safeQuery(() => (supabase as any).from("giver_stats").select("*").eq("user_id", selectedUserId).maybeSingle()),
        // Brand (if business)
        safeQuery(() => (supabase as any).from("brands").select("*").eq("user_id", selectedUserId).maybeSingle()),
      ]);

      // Count wishlist items
      let wishlistItemsCount = 0;
      const wishlists = (wishlistsData as any[]) ?? [];
      const wishlistIds = wishlists.map((w: any) => w.id);
      if (wishlistIds.length > 0) {
        try {
          const { count } = await (supabase as any)
            .from("wishlist_items")
            .select("id", { count: "exact", head: true })
            .in("wishlist_id", wishlistIds);
          wishlistItemsCount = count ?? 0;
        } catch (e) {
          console.warn("Failed to count wishlist items:", e);
        }
      }

      // Get brand products count properly if brand exists
      let brandProductsCount = 0;
      let brandFollowersCount = 0;
      const brand = brandData as any;
      if (brand?.id) {
        try {
          const { count } = await (supabase as any)
            .from("brand_products")
            .select("id", { count: "exact", head: true })
            .eq("brand_id", brand.id);
          brandProductsCount = count ?? 0;
        } catch (e) {
          console.warn("Failed to count brand products:", e);
        }
        try {
          const { data: bfData } = await (supabase as any)
            .from("brand_followers")
            .select("id, status")
            .eq("brand_id", brand.id);
          brandFollowersCount = ((bfData as any[]) ?? []).filter((f: any) => f.status === "accepted").length;
        } catch (e) {
          console.warn("Failed to count brand followers:", e);
        }
      }

      // Parse auth data - it returns as array from RPC
      const authArr = Array.isArray(authData) ? authData : [];
      const auth = authArr.length > 0 ? authArr[0] : null;

      const followers = (followersData as any[]) ?? [];
      const following = (followingData as any[]) ?? [];
      const events = (eventsData as any[]) ?? [];

      return {
        auth,
        wishlists,
        wishlistItemsCount,
        events,
        followers: followers.filter((f: any) => f.status === "accepted").length,
        followersPending: followers.filter((f: any) => f.status === "pending").length,
        following: following.filter((f: any) => f.status === "accepted").length,
        giverStats: giverStatsData,
        brand,
        brandProductsCount,
        brandFollowers: brandFollowersCount,
      };
    },
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Users</h1>
          <p className="text-sm text-slate-400 mt-1">
            {profiles?.length ?? 0} registered users
          </p>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <Input
            placeholder="Search users..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 w-64 bg-slate-900 border-slate-700 text-slate-200 placeholder:text-slate-500"
          />
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-2">
        <Button
          variant={filter === "all" ? "default" : "outline"}
          size="sm"
          onClick={() => setFilter("all")}
          className={filter === "all" ? "" : "bg-slate-900 border-slate-700 text-slate-300 hover:bg-slate-800"}
        >
          All
        </Button>
        <Button
          variant={filter === "personal" ? "default" : "outline"}
          size="sm"
          onClick={() => setFilter("personal")}
          className={filter === "personal" ? "" : "bg-slate-900 border-slate-700 text-slate-300 hover:bg-slate-800"}
        >
          <User className="w-3 h-3 mr-1" />
          Personal
        </Button>
        <Button
          variant={filter === "business" ? "default" : "outline"}
          size="sm"
          onClick={() => setFilter("business")}
          className={filter === "business" ? "" : "bg-slate-900 border-slate-700 text-slate-300 hover:bg-slate-800"}
        >
          <Building2 className="w-3 h-3 mr-1" />
          Business
        </Button>
      </div>

      {/* Users Table */}
      <Card className="border border-slate-800 bg-slate-900/60 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-900/80">
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wide">User</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wide">Username</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wide">Email</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wide">Type</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wide">DOB</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wide">Joined</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wide">Role</th>
              </tr>
            </thead>
            <tbody>
              {profilesLoading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-slate-500">
                    Loading users...
                  </td>
                </tr>
              ) : filteredProfiles.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-slate-500">
                    No users found
                  </td>
                </tr>
              ) : (
                filteredProfiles.map((user) => {
                  const isSuperadmin = superadmins?.includes(user.id);
                  const hasBrand = Boolean(brandLogos && brandLogos[user.id]);
                  const accountType = hasBrand ? "business" : (user.account_type || "personal");
                  const email = userEmails?.[user.id] || "";
                  const initials = (user.full_name?.charAt(0) || user.username?.charAt(0) || "?").toUpperCase();
                  const avatarSrc = hasBrand ? brandLogos?.[user.id] : user.avatar_url;

                  return (
                    <tr
                      key={user.id}
                      onClick={() => setSelectedUserId(user.id)}
                      className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors cursor-pointer"
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          {avatarSrc ? (
                            <img
                              src={avatarSrc}
                              alt={user.full_name || user.username || "User"}
                              className="w-9 h-9 rounded-full object-cover ring-2 ring-slate-700 bg-slate-800"
                            />
                          ) : (
                            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-primary/30 to-primary/10 flex items-center justify-center text-slate-200 text-sm font-semibold ring-2 ring-slate-700">
                              {initials}
                            </div>
                          )}
                          <div>
                            <p className="font-medium text-slate-200">
                              {user.full_name || "No name"}
                            </p>
                            <p className="text-xs text-slate-500">
                              {user.country || user.id.slice(0, 8) + "..."}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-slate-300">
                        {user.username || <span className="text-slate-500">—</span>}
                      </td>
                      <td className="px-4 py-3">
                        {email ? (
                          <div className="flex items-center gap-1 text-slate-300 text-xs">
                            <Mail className="w-3 h-3 text-slate-500" />
                            <span className="truncate max-w-[140px]">{email}</span>
                          </div>
                        ) : (
                          <span className="text-slate-500 text-xs">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {accountType === "business" ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 text-xs font-medium">
                            <Building2 className="w-3 h-3" />
                            Business
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 text-xs font-medium">
                            <User className="w-3 h-3" />
                            Personal
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-400 text-xs">
                        {formatDate(user.dob)}
                      </td>
                      <td className="px-4 py-3 text-slate-400 text-xs">
                        <div className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {formatDate(user.created_at)}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {isSuperadmin ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 text-xs font-medium">
                            <Shield className="w-3 h-3" />
                            Admin
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-700/50 text-slate-400 text-xs">
                            <User className="w-3 h-3" />
                            User
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* User Detail Dialog */}
      <Dialog open={!!selectedUserId} onOpenChange={(open) => !open && setSelectedUserId(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto bg-slate-900 border-slate-700 text-slate-100">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3">
              {selectedUser && (
                <>
                  {(selectedHasBrand ? brandLogos?.[selectedUserId!] : selectedUser.avatar_url) ? (
                    <img
                      src={selectedHasBrand ? brandLogos?.[selectedUserId!] : selectedUser.avatar_url!}
                      alt={selectedUser.full_name || "User"}
                      className="w-12 h-12 rounded-full object-cover ring-2 ring-slate-600"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary/30 to-primary/10 flex items-center justify-center text-lg font-bold">
                      {(selectedUser.full_name?.charAt(0) || selectedUser.username?.charAt(0) || "?").toUpperCase()}
                    </div>
                  )}
                  <div>
                    <div className="text-lg font-semibold">{selectedUser.full_name || "No name"}</div>
                    <div className="text-sm text-slate-400">@{selectedUser.username || "no-username"}</div>
                  </div>
                  <Badge className={selectedAccountType === "business" ? "bg-blue-500/20 text-blue-400" : "bg-emerald-500/20 text-emerald-400"}>
                    {selectedAccountType === "business" ? <Building2 className="w-3 h-3 mr-1" /> : <User className="w-3 h-3 mr-1" />}
                    {selectedAccountType === "business" ? "Business" : "Personal"}
                  </Badge>
                </>
              )}
            </DialogTitle>
          </DialogHeader>

          {detailsLoading ? (
            <div className="py-12 text-center text-slate-500">Loading user details...</div>
          ) : selectedUser && userDetails ? (
            <Tabs defaultValue="overview" className="mt-4">
              <TabsList className="bg-slate-800 border-slate-700">
                <TabsTrigger value="overview" className="data-[state=active]:bg-slate-700">Overview</TabsTrigger>
                {selectedAccountType === "personal" && (
                  <TabsTrigger value="wishlists" className="data-[state=active]:bg-slate-700">Wishlists</TabsTrigger>
                )}
                {selectedAccountType === "business" && (
                  <TabsTrigger value="brand" className="data-[state=active]:bg-slate-700">Brand</TabsTrigger>
                )}
                <TabsTrigger value="social" className="data-[state=active]:bg-slate-700">Social</TabsTrigger>
              </TabsList>

              {/* Overview Tab */}
              <TabsContent value="overview" className="space-y-6 mt-4">
                {/* Account Info */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-3 p-4 rounded-xl bg-slate-800/50">
                    <h3 className="text-sm font-semibold text-slate-300 flex items-center gap-2">
                      <User className="w-4 h-4" /> Account Info
                    </h3>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-slate-500">User ID</span>
                        <span className="font-mono text-xs text-slate-400">{selectedUser.id.slice(0, 12)}...</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Email</span>
                        <span className="text-slate-300">{userDetails.auth?.email || userEmails?.[selectedUserId!] || "—"}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Full Name</span>
                        <span className="text-slate-300">{selectedUser.full_name || "—"}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Username</span>
                        <span className="text-slate-300">@{selectedUser.username || "—"}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">DOB</span>
                        <span className="text-slate-300">{formatDate(selectedUser.dob)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Country</span>
                        <span className="text-slate-300">{selectedUser.country || "—"}</span>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3 p-4 rounded-xl bg-slate-800/50">
                    <h3 className="text-sm font-semibold text-slate-300 flex items-center gap-2">
                      <Clock className="w-4 h-4" /> Activity
                    </h3>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-slate-500">Joined</span>
                        <span className="text-slate-300">{formatDateTime(selectedUser.created_at)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Last Sign In</span>
                        <span className="text-slate-300">{formatDateTime(userDetails.auth?.last_sign_in_at)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Status</span>
                        {userDetails.auth?.last_sign_in_at && 
                         new Date(userDetails.auth.last_sign_in_at).getTime() > Date.now() - 15 * 60 * 1000 ? (
                          <Badge className="bg-green-500/20 text-green-400 text-xs">Online</Badge>
                        ) : (
                          <Badge className="bg-slate-600/50 text-slate-400 text-xs">Offline</Badge>
                        )}
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Account Type</span>
                        <span className="text-slate-300 capitalize">{selectedAccountType}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Role</span>
                        <span className="text-slate-300">{superadmins?.includes(selectedUserId!) ? "Admin" : "User"}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-4 gap-3">
                  {selectedAccountType === "personal" ? (
                    <>
                      <div className="p-4 rounded-xl bg-slate-800/50 text-center">
                        <ListChecks className="w-5 h-5 mx-auto mb-2 text-primary" />
                        <div className="text-2xl font-bold">{userDetails.wishlists.length}</div>
                        <div className="text-xs text-slate-500">Wishlists</div>
                      </div>
                      <div className="p-4 rounded-xl bg-slate-800/50 text-center">
                        <Gift className="w-5 h-5 mx-auto mb-2 text-pink-400" />
                        <div className="text-2xl font-bold">{userDetails.wishlistItemsCount}</div>
                        <div className="text-xs text-slate-500">Wish Items</div>
                      </div>
                      <div className="p-4 rounded-xl bg-slate-800/50 text-center">
                        <CalendarDays className="w-5 h-5 mx-auto mb-2 text-amber-400" />
                        <div className="text-2xl font-bold">{userDetails.events.length}</div>
                        <div className="text-xs text-slate-500">Events</div>
                      </div>
                      <div className="p-4 rounded-xl bg-slate-800/50 text-center">
                        <Heart className="w-5 h-5 mx-auto mb-2 text-red-400" />
                        <div className="text-2xl font-bold">{(userDetails.giverStats as any)?.gifts_given_count ?? 0}</div>
                        <div className="text-xs text-slate-500">Gifts Given</div>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="p-4 rounded-xl bg-slate-800/50 text-center">
                        <Package className="w-5 h-5 mx-auto mb-2 text-primary" />
                        <div className="text-2xl font-bold">{userDetails.brandProductsCount}</div>
                        <div className="text-xs text-slate-500">Products</div>
                      </div>
                      <div className="p-4 rounded-xl bg-slate-800/50 text-center">
                        <Users className="w-5 h-5 mx-auto mb-2 text-blue-400" />
                        <div className="text-2xl font-bold">{userDetails.brandFollowers}</div>
                        <div className="text-xs text-slate-500">Brand Followers</div>
                      </div>
                      <div className="p-4 rounded-xl bg-slate-800/50 text-center">
                        <Eye className="w-5 h-5 mx-auto mb-2 text-emerald-400" />
                        <div className="text-2xl font-bold">{userDetails.brand?.total_views ?? 0}</div>
                        <div className="text-xs text-slate-500">Views</div>
                      </div>
                      <div className="p-4 rounded-xl bg-slate-800/50 text-center">
                        <CirclePlus className="w-5 h-5 mx-auto mb-2 text-amber-400" />
                        <div className="text-2xl font-bold">{userDetails.brand?.total_wishlist_adds ?? 0}</div>
                        <div className="text-xs text-slate-500">Wishlist Adds</div>
                      </div>
                    </>
                  )}
                </div>

                {/* Social Stats */}
                <div className="grid grid-cols-3 gap-3">
                  <div className="p-4 rounded-xl bg-slate-800/50 text-center">
                    <UserCheck className="w-5 h-5 mx-auto mb-2 text-slate-400" />
                    <div className="text-xl font-bold">{userDetails.followers}</div>
                    <div className="text-xs text-slate-500">Followers</div>
                  </div>
                  <div className="p-4 rounded-xl bg-slate-800/50 text-center">
                    <UserPlus className="w-5 h-5 mx-auto mb-2 text-slate-400" />
                    <div className="text-xl font-bold">{userDetails.following}</div>
                    <div className="text-xs text-slate-500">Following</div>
                  </div>
                  <div className="p-4 rounded-xl bg-slate-800/50 text-center">
                    <Clock className="w-5 h-5 mx-auto mb-2 text-yellow-400" />
                    <div className="text-xl font-bold">{userDetails.followersPending}</div>
                    <div className="text-xs text-slate-500">Pending Requests</div>
                  </div>
                </div>
              </TabsContent>

              {/* Wishlists Tab (Personal) */}
              {selectedAccountType === "personal" && (
                <TabsContent value="wishlists" className="mt-4">
                  <div className="space-y-3">
                    <h3 className="text-sm font-semibold text-slate-300">Wishlists ({userDetails.wishlists.length})</h3>
                    {userDetails.wishlists.length === 0 ? (
                      <p className="text-slate-500 text-sm">No wishlists created</p>
                    ) : (
                      <div className="space-y-2">
                        {userDetails.wishlists.map((w: any) => (
                          <div key={w.id} className="flex items-center justify-between p-3 rounded-lg bg-slate-800/50">
                            <div>
                              <div className="font-medium text-slate-200">{w.title || "Untitled"}</div>
                              <div className="text-xs text-slate-500">Created {formatDate(w.created_at)}</div>
                            </div>
                            <Badge className={w.is_public ? "bg-green-500/20 text-green-400" : "bg-slate-600/50 text-slate-400"}>
                              {w.is_public ? "Public" : "Private"}
                            </Badge>
                          </div>
                        ))}
                      </div>
                    )}

                    <h3 className="text-sm font-semibold text-slate-300 mt-6">Events ({userDetails.events.length})</h3>
                    {userDetails.events.length === 0 ? (
                      <p className="text-slate-500 text-sm">No events created</p>
                    ) : (
                      <div className="space-y-2">
                        {userDetails.events.map((e: any) => (
                          <div key={e.id} className="flex items-center justify-between p-3 rounded-lg bg-slate-800/50">
                            <div>
                              <div className="font-medium text-slate-200">{e.title || "Untitled Event"}</div>
                              <div className="text-xs text-slate-500">Date: {formatDate(e.event_date)}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </TabsContent>
              )}

              {/* Brand Tab (Business) */}
              {selectedAccountType === "business" && userDetails.brand && (
                <TabsContent value="brand" className="mt-4">
                  <div className="space-y-4">
                    {/* Brand Info */}
                    <div className="p-4 rounded-xl bg-slate-800/50 space-y-3">
                      <div className="flex items-center gap-3">
                        {userDetails.brand.logo_url && (
                          <img src={userDetails.brand.logo_url} alt="Brand" className="w-16 h-16 rounded-xl object-cover" />
                        )}
                        <div>
                          <h3 className="text-lg font-semibold">{userDetails.brand.brand_name}</h3>
                          {userDetails.brand.tagline && (
                            <p className="text-sm text-slate-400">{userDetails.brand.tagline}</p>
                          )}
                        </div>
                        {userDetails.brand.is_verified && (
                          <Badge className="bg-blue-500/20 text-blue-400">Verified</Badge>
                        )}
                      </div>
                      {userDetails.brand.description && (
                        <p className="text-sm text-slate-400">{userDetails.brand.description}</p>
                      )}
                    </div>

                    {/* Brand Contact */}
                    <div className="grid grid-cols-2 gap-4">
                      <div className="p-4 rounded-xl bg-slate-800/50 space-y-2">
                        <h4 className="text-sm font-semibold text-slate-300">Contact</h4>
                        {userDetails.brand.email && (
                          <div className="flex items-center gap-2 text-sm text-slate-400">
                            <Mail className="w-3 h-3" /> {userDetails.brand.email}
                          </div>
                        )}
                        {userDetails.brand.phone && (
                          <div className="flex items-center gap-2 text-sm text-slate-400">
                            <Phone className="w-3 h-3" /> {userDetails.brand.phone}
                          </div>
                        )}
                        {userDetails.brand.brand_website && (
                          <div className="flex items-center gap-2 text-sm text-slate-400">
                            <Globe className="w-3 h-3" /> {userDetails.brand.brand_website}
                          </div>
                        )}
                      </div>
                      <div className="p-4 rounded-xl bg-slate-800/50 space-y-2">
                        <h4 className="text-sm font-semibold text-slate-300">Social</h4>
                        {userDetails.brand.instagram && (
                          <div className="flex items-center gap-2 text-sm text-slate-400">
                            <Instagram className="w-3 h-3" /> @{userDetails.brand.instagram}
                          </div>
                        )}
                        {userDetails.brand.twitter && (
                          <div className="flex items-center gap-2 text-sm text-slate-400">
                            <ExternalLink className="w-3 h-3" /> @{userDetails.brand.twitter}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Brand Stats */}
                    <div className="p-4 rounded-xl bg-slate-800/50">
                      <h4 className="text-sm font-semibold text-slate-300 mb-3">Brand Details</h4>
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-slate-500">Category</span>
                          <span className="text-slate-300">{userDetails.brand.brand_category || "—"}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500">Country</span>
                          <span className="text-slate-300">{userDetails.brand.brand_country || "—"}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500">Manager</span>
                          <span className="text-slate-300">{userDetails.brand.manager_name || "—"}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500">Products</span>
                          <span className="text-slate-300">{userDetails.brandProductsCount}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </TabsContent>
              )}

              {/* Social Tab */}
              <TabsContent value="social" className="mt-4">
                <div className="grid grid-cols-3 gap-4">
                  <div className="p-6 rounded-xl bg-slate-800/50 text-center">
                    <UserCheck className="w-8 h-8 mx-auto mb-3 text-emerald-400" />
                    <div className="text-3xl font-bold">{userDetails.followers}</div>
                    <div className="text-sm text-slate-500">Followers</div>
                  </div>
                  <div className="p-6 rounded-xl bg-slate-800/50 text-center">
                    <UserPlus className="w-8 h-8 mx-auto mb-3 text-blue-400" />
                    <div className="text-3xl font-bold">{userDetails.following}</div>
                    <div className="text-sm text-slate-500">Following</div>
                  </div>
                  <div className="p-6 rounded-xl bg-slate-800/50 text-center">
                    <Clock className="w-8 h-8 mx-auto mb-3 text-yellow-400" />
                    <div className="text-3xl font-bold">{userDetails.followersPending}</div>
                    <div className="text-sm text-slate-500">Pending</div>
                  </div>
                </div>

                {userDetails.giverStats && (
                  <div className="mt-4 p-4 rounded-xl bg-slate-800/50">
                    <h4 className="text-sm font-semibold text-slate-300 mb-3">Giver Stats</h4>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div className="flex justify-between">
                        <span className="text-slate-500">Gifts Given</span>
                        <span className="text-slate-300">{(userDetails.giverStats as any)?.gifts_given_count ?? 0}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Events Participated</span>
                        <span className="text-slate-300">{(userDetails.giverStats as any)?.events_participated_in ?? 0}</span>
                      </div>
                    </div>
                  </div>
                )}
              </TabsContent>
            </Tabs>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminUsers;
