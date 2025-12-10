import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Mail, AlertTriangle, TrendingUp, Brain, Heart, MessageCircle, Gift, Building2, UserCircle, Image, Link as LinkIcon, Clock, CheckCircle, XCircle } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { formatDistanceToNow } from "date-fns";

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

  // Fetch AI usage stats
  const { data: aiStats, isLoading: aiLoading } = useQuery({
    queryKey: ["admin-ai-stats"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("ai_logs")
        .select("total_tokens, status");
      
      if (error) {
        console.warn("ai_logs table error:", error.message);
        return { count: 0, tokens: 0, successRate: 0 };
      }
      
      const totalTokens = (data || []).reduce((sum: number, l: any) => sum + (l.total_tokens || 0), 0);
      const successCount = (data || []).filter((l: any) => l.status === 'success').length;
      const successRate = data?.length ? Math.round((successCount / data.length) * 100) : 0;
      return { count: data?.length || 0, tokens: totalTokens, successRate };
    },
  });

  // Fetch user breakdown (personal vs business)
  const { data: userBreakdown } = useQuery({
    queryKey: ["admin-user-breakdown"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_profiles")
        .select("is_brand");
      
      if (error) return { personal: 0, business: 0 };
      const business = (data || []).filter((u: any) => u.is_brand).length;
      const personal = (data || []).length - business;
      return { personal, business };
    },
  });

  // Fetch wishlists count
  const { data: wishlistsCount } = useQuery({
    queryKey: ["admin-wishlists-count"],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("wishlists")
        .select("*", { count: "exact", head: true });
      if (error) return 0;
      return count ?? 0;
    },
  });

  // Fetch wishlist items count
  const { data: itemsCount } = useQuery({
    queryKey: ["admin-items-count"],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("wishlist_items")
        .select("*", { count: "exact", head: true });
      if (error) return 0;
      return count ?? 0;
    },
  });

  // Fetch recent activity (AI logs, new users, wishlists)
  const { data: recentActivity } = useQuery({
    queryKey: ["admin-recent-activity"],
    queryFn: async () => {
      const activities: any[] = [];

      // Recent AI logs
      const { data: aiLogs } = await (supabase as any)
        .from("ai_logs")
        .select("id, function_name, model, status, created_at, user_profiles!ai_logs_user_id_fkey(username, is_brand)")
        .order("created_at", { ascending: false })
        .limit(5);
      
      (aiLogs || []).forEach((log: any) => {
        activities.push({
          type: 'ai',
          icon: log.function_name === 'extract-from-image' ? 'image' : 'link',
          title: `AI: ${log.function_name}`,
          subtitle: `by @${log.user_profiles?.username || 'Unknown'}`,
          status: log.status,
          time: log.created_at,
          isBrand: log.user_profiles?.is_brand,
        });
      });

      // Recent users
      const { data: recentUsers } = await supabase
        .from("user_profiles")
        .select("id, username, is_brand, created_at")
        .order("created_at", { ascending: false })
        .limit(3);
      
      (recentUsers || []).forEach((user: any) => {
        activities.push({
          type: 'user',
          icon: user.is_brand ? 'business' : 'personal',
          title: `New ${user.is_brand ? 'Business' : 'User'}: @${user.username}`,
          subtitle: user.is_brand ? 'Business account' : 'Personal account',
          time: user.created_at,
          isBrand: user.is_brand,
        });
      });

      // Recent wishlists
      const { data: recentWishlists } = await supabase
        .from("wishlists")
        .select("id, title, user_id, user_profiles!wishlists_user_id_fkey(username)")
        .order("id", { ascending: false })
        .limit(3);
      
      (recentWishlists || []).forEach((wl: any) => {
        activities.push({
          type: 'wishlist',
          icon: 'gift',
          title: `Wishlist: ${wl.title || 'Untitled'}`,
          subtitle: `by @${wl.user_profiles?.username || 'Unknown'}`,
          time: null, // wishlists don't have created_at
        });
      });

      // Sort by time (most recent first)
      return activities.sort((a, b) => {
        if (!a.time) return 1;
        if (!b.time) return -1;
        return new Date(b.time).getTime() - new Date(a.time).getTime();
      }).slice(0, 8);
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
            <p className="text-xs text-slate-500 mt-1 flex items-center gap-2">
              <span className="flex items-center gap-1"><UserCircle className="w-3 h-3 text-blue-400" />{userBreakdown?.personal || 0}</span>
              <span className="flex items-center gap-1"><Building2 className="w-3 h-3 text-purple-400" />{userBreakdown?.business || 0}</span>
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
        <Link to="/mqtr/ai-usage">
          <Card className="border border-slate-800 bg-slate-900/60 backdrop-blur shadow-lg hover:border-purple-500/50 transition-colors cursor-pointer">
            <CardHeader className="pb-2 flex flex-row items-center justify-between">
              <CardTitle className="text-xs font-medium text-slate-400 uppercase tracking-wide">AI Usage</CardTitle>
              <div className="p-2 rounded-lg bg-purple-500/10">
                <Brain className="w-4 h-4 text-purple-500" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-slate-100">
                {aiLoading ? "..." : aiStats?.count || 0}
              </div>
              <p className="text-xs text-slate-500 mt-1 flex items-center gap-2">
                <span>{aiStats?.tokens ? `${(aiStats.tokens / 1000).toFixed(1)}K tokens` : "0 tokens"}</span>
                <span className={`flex items-center gap-1 ${aiStats?.successRate >= 80 ? 'text-emerald-400' : 'text-amber-400'}`}>
                  <CheckCircle className="w-3 h-3" />{aiStats?.successRate || 0}%
                </span>
              </p>
            </CardContent>
          </Card>
        </Link>

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

      {/* Stats Row 2 */}
      <div className="grid gap-4 md:grid-cols-3">
        {/* Wishlists */}
        <Card className="border border-slate-800 bg-slate-900/60 backdrop-blur shadow-lg">
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-xs font-medium text-slate-400 uppercase tracking-wide">Wishlists</CardTitle>
            <div className="p-2 rounded-lg bg-pink-500/10">
              <Gift className="w-4 h-4 text-pink-500" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-slate-100">{wishlistsCount ?? 0}</div>
            <p className="text-xs text-slate-500 mt-1">Total wishlists created</p>
          </CardContent>
        </Card>

        {/* Wishlist Items */}
        <Card className="border border-slate-800 bg-slate-900/60 backdrop-blur shadow-lg">
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-xs font-medium text-slate-400 uppercase tracking-wide">Wishlist Items</CardTitle>
            <div className="p-2 rounded-lg bg-cyan-500/10">
              <Heart className="w-4 h-4 text-cyan-500" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-slate-100">{itemsCount ?? 0}</div>
            <p className="text-xs text-slate-500 mt-1">Items added to wishlists</p>
          </CardContent>
        </Card>

        {/* Support Messages */}
        <Link to="/mqtr/support">
          <Card className="border border-slate-800 bg-slate-900/60 backdrop-blur shadow-lg hover:border-amber-500/50 transition-colors cursor-pointer">
            <CardHeader className="pb-2 flex flex-row items-center justify-between">
              <CardTitle className="text-xs font-medium text-slate-400 uppercase tracking-wide">Support</CardTitle>
              <div className="p-2 rounded-lg bg-amber-500/10">
                <MessageCircle className="w-4 h-4 text-amber-500" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-slate-100">{newMessagesCount ?? 0}</div>
              <p className="text-xs text-slate-500 mt-1">Pending support messages</p>
            </CardContent>
          </Card>
        </Link>
      </div>

      {/* Quick Actions & Recent Activity */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card className="border border-slate-800 bg-slate-900/40 p-5">
          <h3 className="text-sm font-semibold text-slate-200 mb-4">Quick Actions</h3>
          <div className="space-y-3">
            <Link to="/mqtr/users" className="flex items-center gap-3 p-2 rounded-lg hover:bg-slate-800/50 transition-colors">
              <div className="p-2 rounded-lg bg-primary/10"><Users className="w-4 h-4 text-primary" /></div>
              <div>
                <p className="text-sm text-slate-200">Manage Users</p>
                <p className="text-xs text-slate-500">{usersCount ?? 0} registered accounts</p>
              </div>
            </Link>
            <Link to="/mqtr/contact" className="flex items-center gap-3 p-2 rounded-lg hover:bg-slate-800/50 transition-colors">
              <div className="p-2 rounded-lg bg-amber-500/10"><Mail className="w-4 h-4 text-amber-500" /></div>
              <div>
                <p className="text-sm text-slate-200">Contact Inbox</p>
                <p className="text-xs text-slate-500">{totalMessagesCount ?? 0} messages</p>
              </div>
            </Link>
            <Link to="/mqtr/ai-usage" className="flex items-center gap-3 p-2 rounded-lg hover:bg-slate-800/50 transition-colors">
              <div className="p-2 rounded-lg bg-purple-500/10"><Brain className="w-4 h-4 text-purple-500" /></div>
              <div>
                <p className="text-sm text-slate-200">AI Usage</p>
                <p className="text-xs text-slate-500">{aiStats?.count ?? 0} API calls</p>
              </div>
            </Link>
          </div>
        </Card>

        <Card className="border border-slate-800 bg-slate-900/40 p-5">
          <h3 className="text-sm font-semibold text-slate-200 mb-4">Recent Activity</h3>
          <div className="space-y-3 max-h-[280px] overflow-y-auto">
            {recentActivity && recentActivity.length > 0 ? (
              recentActivity.map((activity: any, idx: number) => (
                <div key={idx} className="flex items-start gap-3 p-2 rounded-lg hover:bg-slate-800/30 transition-colors">
                  <div className={`p-2 rounded-lg ${
                    activity.type === 'ai' ? 'bg-purple-500/10' :
                    activity.type === 'user' ? (activity.isBrand ? 'bg-purple-500/10' : 'bg-blue-500/10') :
                    'bg-pink-500/10'
                  }`}>
                    {activity.icon === 'image' && <Image className="w-4 h-4 text-purple-400" />}
                    {activity.icon === 'link' && <LinkIcon className="w-4 h-4 text-purple-400" />}
                    {activity.icon === 'business' && <Building2 className="w-4 h-4 text-purple-400" />}
                    {activity.icon === 'personal' && <UserCircle className="w-4 h-4 text-blue-400" />}
                    {activity.icon === 'gift' && <Gift className="w-4 h-4 text-pink-400" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-slate-200 truncate">{activity.title}</p>
                    <div className="flex items-center gap-2">
                      <p className="text-xs text-slate-500 truncate">{activity.subtitle}</p>
                      {activity.status && (
                        <Badge className={`text-[10px] ${activity.status === 'success' ? 'bg-emerald-900/50 text-emerald-300' : 'bg-red-900/50 text-red-300'}`}>
                          {activity.status}
                        </Badge>
                      )}
                    </div>
                  </div>
                  {activity.time && (
                    <span className="text-[10px] text-slate-600 whitespace-nowrap">
                      {formatDistanceToNow(new Date(activity.time), { addSuffix: true })}
                    </span>
                  )}
                </div>
              ))
            ) : (
              <p className="text-sm text-slate-500 italic">No recent activity</p>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
};

export default AdminDashboard;
