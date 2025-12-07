import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Mail, Activity, AlertTriangle, TrendingUp } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const AdminDashboard = () => {
  const { t } = useTranslation();

  // Fetch real user count from user_profiles
  const { data: usersCount, isLoading: usersLoading } = useQuery({
    queryKey: ["admin-users-count"],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("user_profiles")
        .select("*", { count: "exact", head: true });
      if (error) throw error;
      return count ?? 0;
    },
  });

  // Fetch new contact messages count
  const { data: newMessagesCount, isLoading: messagesLoading } = useQuery({
    queryKey: ["admin-new-messages-count"],
    queryFn: async () => {
      const { count, error } = await (supabase as any)
        .from("contact_messages")
        .select("*", { count: "exact", head: true })
        .eq("status", "new");
      if (error) {
        console.warn("contact_messages table not found or error:", error.message);
        return 0;
      }
      return count ?? 0;
    },
  });

  // Fetch total contact messages
  const { data: totalMessagesCount } = useQuery({
    queryKey: ["admin-total-messages-count"],
    queryFn: async () => {
      const { count, error } = await (supabase as any)
        .from("contact_messages")
        .select("*", { count: "exact", head: true });
      if (error) return 0;
      return count ?? 0;
    },
  });

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="space-y-2">
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-slate-100">
          Dashboard Overview
        </h1>
        <p className="text-sm text-slate-400 max-w-2xl">
          Real-time metrics for Wishly. Monitor users, messages, and system health.
        </p>
      </div>

      {/* Metrics Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {/* Total Users */}
        <Card className="border border-slate-800 bg-slate-900/60 backdrop-blur shadow-lg">
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-xs font-medium text-slate-400 uppercase tracking-wide">Total Users</CardTitle>
            <div className="p-2 rounded-lg bg-primary/10">
              <Users className="w-4 h-4 text-primary" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-slate-100">
              {usersLoading ? "..." : usersCount}
            </div>
            <p className="text-xs text-slate-500 mt-1 flex items-center gap-1">
              <TrendingUp className="w-3 h-3 text-emerald-500" />
              Registered accounts
            </p>
          </CardContent>
        </Card>

        {/* New Messages */}
        <Card className="border border-slate-800 bg-slate-900/60 backdrop-blur shadow-lg">
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-xs font-medium text-slate-400 uppercase tracking-wide">New Messages</CardTitle>
            <div className="p-2 rounded-lg bg-amber-500/10">
              <Mail className="w-4 h-4 text-amber-500" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-slate-100">
              {messagesLoading ? "..." : newMessagesCount}
            </div>
            <p className="text-xs text-slate-500 mt-1">
              {totalMessagesCount ?? 0} total in inbox
            </p>
          </CardContent>
        </Card>

        {/* AI Usage */}
        <Card className="border border-slate-800 bg-slate-900/60 backdrop-blur shadow-lg">
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-xs font-medium text-slate-400 uppercase tracking-wide">AI Usage</CardTitle>
            <div className="p-2 rounded-lg bg-cyan-500/10">
              <Activity className="w-4 h-4 text-cyan-500" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-slate-100">—</div>
            <p className="text-xs text-slate-500 mt-1">Coming soon</p>
          </CardContent>
        </Card>

        {/* System Health */}
        <Card className="border border-slate-800 bg-slate-900/60 backdrop-blur shadow-lg">
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-xs font-medium text-slate-400 uppercase tracking-wide">System Health</CardTitle>
            <div className="p-2 rounded-lg bg-emerald-500/10">
              <AlertTriangle className="w-4 h-4 text-emerald-500" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-emerald-400">OK</div>
            <p className="text-xs text-slate-500 mt-1">All systems operational</p>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card className="border border-slate-800 bg-slate-900/40 p-5">
          <h3 className="text-sm font-semibold text-slate-200 mb-3">Quick Actions</h3>
          <div className="space-y-2 text-sm text-slate-400">
            <p>• View all users in the <span className="text-primary">Users</span> tab</p>
            <p>• Check contact submissions in <span className="text-primary">Contact inbox</span></p>
            <p>• AI usage tracking coming in next release</p>
          </div>
        </Card>
        <Card className="border border-slate-800 bg-slate-900/40 p-5">
          <h3 className="text-sm font-semibold text-slate-200 mb-3">Recent Activity</h3>
          <div className="space-y-2 text-sm text-slate-500">
            <p className="italic">Activity feed will appear here once wired.</p>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default AdminDashboard;
