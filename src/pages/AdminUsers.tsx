import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search, Building2, User, Shield, Calendar, Mail, ChevronRight } from "lucide-react";

type UserProfile = {
  id: string;
  username: string | null;
  full_name: string | null;
  dob: string | null;
  avatar_url: string | null;
  created_at: string;
  account_type?: string;
  country?: string;
  is_superadmin?: boolean;
};

const AdminUsers = () => {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "personal" | "business">("all");

  // Fetch user profiles
  const { data: profiles, isLoading: profilesLoading } = useQuery({
    queryKey: ["admin-user-profiles"],
    queryFn: async () => {
      try {
        const { data, error } = await (supabase as any)
          .from("user_profiles")
          .select("*")
          .order("created_at", { ascending: false });

        if (!error) return (data ?? []) as UserProfile[];
        return [] as UserProfile[];
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
          .select("user_id, logo_url, brand_name");

        const map: Record<string, { logo_url: string; brand_name: string }> = {};
        (data ?? []).forEach((row: any) => {
          if (row.user_id) {
            map[row.user_id] = { logo_url: row.logo_url, brand_name: row.brand_name };
          }
        });
        return map;
      } catch (e) {
        return {} as Record<string, { logo_url: string; brand_name: string }>;
      }
    },
  });

  // Fetch emails
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
    const brandInfo = brandLogos?.[p.id];
    const matchesSearch =
      !search ||
      p.username?.toLowerCase().includes(search.toLowerCase()) ||
      p.full_name?.toLowerCase().includes(search.toLowerCase()) ||
      p.id.toLowerCase().includes(search.toLowerCase()) ||
      email.toLowerCase().includes(search.toLowerCase()) ||
      brandInfo?.brand_name?.toLowerCase().includes(search.toLowerCase());

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
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wide">Joined</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wide">Role</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wide"></th>
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
                  const brandInfo = brandLogos?.[user.id];
                  const hasBrand = Boolean(brandInfo);
                  const accountType = hasBrand ? "business" : (user.account_type || "personal");
                  const email = userEmails?.[user.id] || "";
                  const initials = (user.full_name?.charAt(0) || user.username?.charAt(0) || "?").toUpperCase();
                  const avatarSrc = hasBrand ? brandInfo?.logo_url : user.avatar_url;
                  const displayName = hasBrand ? brandInfo?.brand_name : user.full_name;

                  return (
                    <tr
                      key={user.id}
                      onClick={() => navigate(`/mqtr/users/${user.id}`)}
                      className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors cursor-pointer"
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          {avatarSrc ? (
                            <img
                              src={avatarSrc}
                              alt={displayName || "User"}
                              className="w-9 h-9 rounded-full object-cover ring-2 ring-slate-700 bg-slate-800"
                            />
                          ) : (
                            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-primary/30 to-primary/10 flex items-center justify-center text-slate-200 text-sm font-semibold ring-2 ring-slate-700">
                              {initials}
                            </div>
                          )}
                          <div>
                            <p className="font-medium text-slate-200">
                              {displayName || "No name"}
                            </p>
                            <p className="text-xs text-slate-500">
                              {user.country || user.id.slice(0, 8) + "..."}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-slate-300">
                        @{user.username || <span className="text-slate-500">—</span>}
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
                          <Badge className="bg-blue-500/10 text-blue-400">
                            <Building2 className="w-3 h-3 mr-1" />
                            Business
                          </Badge>
                        ) : (
                          <Badge className="bg-emerald-500/10 text-emerald-400">
                            <User className="w-3 h-3 mr-1" />
                            Personal
                          </Badge>
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-400 text-xs">
                        <div className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {formatDate(user.created_at)}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {isSuperadmin ? (
                          <Badge className="bg-amber-500/10 text-amber-400">
                            <Shield className="w-3 h-3 mr-1" />
                            Admin
                          </Badge>
                        ) : (
                          <Badge className="bg-slate-700/50 text-slate-400">
                            <User className="w-3 h-3 mr-1" />
                            User
                          </Badge>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <ChevronRight className="w-4 h-4 text-slate-500" />
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
};

export default AdminUsers;
