import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Users, Search, Building2, User, Shield, Calendar, Mail } from "lucide-react";

type UserProfile = {
  id: string;
  username: string | null;
  full_name: string | null;
  dob: string | null;
  avatar_url: string | null;
  created_at: string;
  is_superadmin?: boolean;
};

type AuthUser = {
  id: string;
  email: string;
  created_at: string;
  last_sign_in_at: string | null;
  user_metadata: {
    account_type?: string;
    full_name?: string;
  };
};

const AdminUsers = () => {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "personal" | "business">("all");

  // Fetch user profiles
  const { data: profiles, isLoading: profilesLoading } = useQuery({
    queryKey: ["admin-user-profiles"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_profiles")
        .select("id, username, full_name, dob, avatar_url, created_at")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as UserProfile[];
    },
  });

  // Fetch superadmin flags
  const { data: superadmins } = useQuery({
    queryKey: ["admin-superadmins"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("user_profiles")
        .select("id")
        .eq("is_superadmin", true);
      if (error) return [];
      return (data ?? []).map((u: any) => u.id);
    },
  });

  // We can't directly query auth.users from client, so we'll use profiles + metadata
  // For account_type, we check user_metadata stored during signup
  // This is a simplified approach - in production you'd use an Edge Function

  const filteredProfiles = (profiles ?? []).filter((p) => {
    const matchesSearch =
      !search ||
      p.username?.toLowerCase().includes(search.toLowerCase()) ||
      p.full_name?.toLowerCase().includes(search.toLowerCase()) ||
      p.id.toLowerCase().includes(search.toLowerCase());
    return matchesSearch;
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
        <div className="flex items-center gap-2">
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
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wide">DOB</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wide">Joined</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wide">Role</th>
              </tr>
            </thead>
            <tbody>
              {profilesLoading ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                    Loading users...
                  </td>
                </tr>
              ) : filteredProfiles.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                    No users found
                  </td>
                </tr>
              ) : (
                filteredProfiles.map((user) => {
                  const isSuperadmin = superadmins?.includes(user.id);
                  return (
                    <tr
                      key={user.id}
                      className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors"
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-slate-300 text-xs font-medium">
                            {user.full_name?.charAt(0)?.toUpperCase() || user.username?.charAt(0)?.toUpperCase() || "?"}
                          </div>
                          <div>
                            <p className="font-medium text-slate-200">
                              {user.full_name || "No name"}
                            </p>
                            <p className="text-xs text-slate-500 font-mono">
                              {user.id.slice(0, 8)}...
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-slate-300">
                        {user.username || <span className="text-slate-500">—</span>}
                      </td>
                      <td className="px-4 py-3 text-slate-400">
                        {formatDate(user.dob)}
                      </td>
                      <td className="px-4 py-3 text-slate-400">
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
    </div>
  );
};

export default AdminUsers;
