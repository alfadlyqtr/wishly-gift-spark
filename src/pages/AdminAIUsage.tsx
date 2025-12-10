import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Brain,
  User,
  Clock,
  Zap,
  DollarSign,
  Search,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
  CheckCircle,
  Eye,
  Calendar,
  Building2,
  UserCircle,
} from "lucide-react";

const PAGE_SIZE = 50;

// All AI models actually used in the app
const ALL_MODELS = [
  'gemini-2.5-flash-lite',  // Used by extract-from-image
  'deepseek-chat',          // Used by ai-gateway (URL scraping & description rewrite)
];

// All AI functions actually used in the app
const ALL_FUNCTIONS = [
  'extract-from-image',     // Gemini - Extract product info from uploaded image
  'ai-gateway',             // DeepSeek - Scrape product URL & extract details
  'rewrite-description',    // DeepSeek - Rewrite product description with tone
  'fetch-metadata',         // No AI - Basic URL metadata scraping
];

const AdminAIUsage = () => {
  const [page, setPage] = useState(0);
  const [searchUser, setSearchUser] = useState("");
  const [filterModel, setFilterModel] = useState<string>("all");
  const [filterFunction, setFilterFunction] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterUserType, setFilterUserType] = useState<string>("all");
  const [filterDateRange, setFilterDateRange] = useState<string>("all");
  const [customDateFrom, setCustomDateFrom] = useState<string>("");
  const [customDateTo, setCustomDateTo] = useState<string>("");
  const [selectedLog, setSelectedLog] = useState<any>(null);

  // Calculate date filter
  const getDateFilter = () => {
    const now = new Date();
    switch (filterDateRange) {
      case '7days':
        return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
      case '10days':
        return new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000).toISOString();
      case '20days':
        return new Date(now.getTime() - 20 * 24 * 60 * 60 * 1000).toISOString();
      case '30days':
        return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
      case 'custom':
        return customDateFrom ? new Date(customDateFrom).toISOString() : null;
      default:
        return null;
    }
  };

  const getDateFilterEnd = () => {
    if (filterDateRange === 'custom' && customDateTo) {
      return new Date(customDateTo + 'T23:59:59').toISOString();
    }
    return null;
  };

  // Fetch AI logs with pagination
  const { data, isLoading, refetch } = useQuery({
    queryKey: ["admin-ai-usage", page, searchUser, filterModel, filterFunction, filterStatus, filterUserType, filterDateRange, customDateFrom, customDateTo],
    queryFn: async () => {
      // Build query
      let query = (supabase as any)
        .from("ai_logs")
        .select("*, user_profiles!ai_logs_user_id_fkey(id, username, full_name, avatar_url, is_brand)", { count: "exact" })
        .order("created_at", { ascending: false })
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

      if (filterModel && filterModel !== "all") {
        query = query.eq("model", filterModel);
      }
      if (filterFunction && filterFunction !== "all") {
        query = query.eq("function_name", filterFunction);
      }
      if (filterStatus && filterStatus !== "all") {
        query = query.eq("status", filterStatus);
      }

      // Date filter
      const dateFrom = getDateFilter();
      const dateTo = getDateFilterEnd();
      if (dateFrom) {
        query = query.gte("created_at", dateFrom);
      }
      if (dateTo) {
        query = query.lte("created_at", dateTo);
      }

      const { data: logs, error, count } = await query;

      if (error) {
        console.error("Error fetching AI logs:", error);
        return { logs: [], count: 0, stats: null };
      }

      // Fetch brand logos for business users
      const brandUserIds = (logs || [])
        .filter((log: any) => log.user_profiles?.is_brand)
        .map((log: any) => log.user_profiles?.id)
        .filter(Boolean);
      
      let brandLogos: Record<string, string> = {};
      if (brandUserIds.length > 0) {
        const { data: brands } = await (supabase as any)
          .from("brands")
          .select("user_id, logo_url")
          .in("user_id", brandUserIds);
        
        (brands || []).forEach((b: any) => {
          if (b.logo_url) brandLogos[b.user_id] = b.logo_url;
        });
      }

      // Enrich logs with brand logos
      let enrichedLogs = (logs || []).map((log: any) => ({
        ...log,
        brand_logo: log.user_profiles?.is_brand ? brandLogos[log.user_profiles?.id] : null,
      }));

      // Filter by user type client-side
      if (filterUserType && filterUserType !== "all") {
        enrichedLogs = enrichedLogs.filter((log: any) => {
          const isBrand = log.user_profiles?.is_brand === true;
          if (filterUserType === 'business') return isBrand;
          if (filterUserType === 'personal') return !isBrand;
          return true;
        });
      }

      // Get aggregate stats
      const { data: statsData } = await (supabase as any)
        .from("ai_logs")
        .select("total_tokens, cost_credits, status")
        .order("created_at", { ascending: false });

      const stats = {
        totalCalls: statsData?.length || 0,
        totalTokens: statsData?.reduce((sum: number, l: any) => sum + (l.total_tokens || 0), 0) || 0,
        totalCredits: statsData?.reduce((sum: number, l: any) => sum + (parseFloat(l.cost_credits) || 0), 0) || 0,
        successRate: statsData?.length 
          ? ((statsData.filter((l: any) => l.status === 'success').length / statsData.length) * 100).toFixed(1)
          : 0,
      };

      // Get unique models and functions for filters
      const { data: modelsData } = await (supabase as any)
        .from("ai_logs")
        .select("model")
        .not("model", "is", null);
      
      const { data: functionsData } = await (supabase as any)
        .from("ai_logs")
        .select("function_name")
        .not("function_name", "is", null);

      const uniqueModels = [...new Set((modelsData || []).map((m: any) => m.model).filter(Boolean))];
      const uniqueFunctions = [...new Set((functionsData || []).map((f: any) => f.function_name).filter(Boolean))];

      return { 
        logs: enrichedLogs, 
        count: count || 0, 
        stats,
        models: [...new Set([...uniqueModels, ...ALL_MODELS])],
        functions: [...new Set([...uniqueFunctions, ...ALL_FUNCTIONS])],
      };
    },
  });

  const totalPages = Math.ceil((data?.count || 0) / PAGE_SIZE);

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString();
  };

  const formatTokens = (tokens: number) => {
    if (tokens >= 1000000) return `${(tokens / 1000000).toFixed(2)}M`;
    if (tokens >= 1000) return `${(tokens / 1000).toFixed(1)}K`;
    return tokens.toString();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-100 flex items-center gap-2">
            <Brain className="w-7 h-7 text-purple-400" /> AI Usage
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Monitor AI model usage, tokens, and costs across all users
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => refetch()}
          className="border-slate-700 text-slate-300"
        >
          <RefreshCw className="w-4 h-4 mr-2" /> Refresh
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="p-4 bg-slate-800/50 border-slate-700">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-purple-900/50 flex items-center justify-center">
              <Brain className="w-5 h-5 text-purple-400" />
            </div>
            <div>
              <div className="text-2xl font-bold text-slate-100">{data?.stats?.totalCalls || 0}</div>
              <div className="text-xs text-slate-400">Total API Calls</div>
            </div>
          </div>
        </Card>

        <Card className="p-4 bg-slate-800/50 border-slate-700">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-900/50 flex items-center justify-center">
              <Zap className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <div className="text-2xl font-bold text-slate-100">{formatTokens(data?.stats?.totalTokens || 0)}</div>
              <div className="text-xs text-slate-400">Total Tokens Used</div>
            </div>
          </div>
        </Card>

        <Card className="p-4 bg-slate-800/50 border-slate-700">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-green-900/50 flex items-center justify-center">
              <DollarSign className="w-5 h-5 text-green-400" />
            </div>
            <div>
              <div className="text-2xl font-bold text-slate-100">{(data?.stats?.totalCredits || 0).toFixed(4)}</div>
              <div className="text-xs text-slate-400">Total Credits Used</div>
            </div>
          </div>
        </Card>

        <Card className="p-4 bg-slate-800/50 border-slate-700">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-900/50 flex items-center justify-center">
              <CheckCircle className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <div className="text-2xl font-bold text-slate-100">{data?.stats?.successRate || 0}%</div>
              <div className="text-xs text-slate-400">Success Rate</div>
            </div>
          </div>
        </Card>
      </div>

      {/* Filters */}
      <Card className="p-4 bg-slate-800/50 border-slate-700">
        <div className="space-y-4">
          {/* Row 1: Search and main filters */}
          <div className="flex flex-wrap gap-3 items-center">
            <div className="flex-1 min-w-[200px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <Input
                  placeholder="Search by user..."
                  value={searchUser}
                  onChange={(e) => setSearchUser(e.target.value)}
                  className="pl-10 bg-slate-900 border-slate-700 text-slate-200"
                />
              </div>
            </div>

            <Select value={filterModel} onValueChange={(v) => { setFilterModel(v); setPage(0); }}>
              <SelectTrigger className="w-[200px] bg-slate-800 border-slate-600 text-slate-100">
                <SelectValue placeholder="Filter by model" />
              </SelectTrigger>
              <SelectContent className="bg-slate-800 border-slate-600">
                <SelectItem value="all" className="text-slate-100 focus:bg-slate-700 focus:text-white">All Models</SelectItem>
                {(data?.models || []).map((model: string) => (
                  <SelectItem key={model} value={model} className="text-slate-100 focus:bg-slate-700 focus:text-white">{model}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={filterFunction} onValueChange={(v) => { setFilterFunction(v); setPage(0); }}>
              <SelectTrigger className="w-[200px] bg-slate-800 border-slate-600 text-slate-100">
                <SelectValue placeholder="Filter by function" />
              </SelectTrigger>
              <SelectContent className="bg-slate-800 border-slate-600">
                <SelectItem value="all" className="text-slate-100 focus:bg-slate-700 focus:text-white">All Functions</SelectItem>
                {(data?.functions || []).map((fn: string) => (
                  <SelectItem key={fn} value={fn} className="text-slate-100 focus:bg-slate-700 focus:text-white">{fn}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={filterStatus} onValueChange={(v) => { setFilterStatus(v); setPage(0); }}>
              <SelectTrigger className="w-[140px] bg-slate-800 border-slate-600 text-slate-100">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent className="bg-slate-800 border-slate-600">
                <SelectItem value="all" className="text-slate-100 focus:bg-slate-700 focus:text-white">All Status</SelectItem>
                <SelectItem value="success" className="text-green-400 focus:bg-slate-700 focus:text-green-300">✓ Success</SelectItem>
                <SelectItem value="error" className="text-red-400 focus:bg-slate-700 focus:text-red-300">✗ Error</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Row 2: User type and date filters */}
          <div className="flex flex-wrap gap-3 items-center">
            <Select value={filterUserType} onValueChange={(v) => { setFilterUserType(v); setPage(0); }}>
              <SelectTrigger className="w-[160px] bg-slate-800 border-slate-600 text-slate-100">
                <div className="flex items-center gap-2">
                  <UserCircle className="w-4 h-4 text-slate-400" />
                  <SelectValue placeholder="User Type" />
                </div>
              </SelectTrigger>
              <SelectContent className="bg-slate-800 border-slate-600">
                <SelectItem value="all" className="text-slate-100 focus:bg-slate-700 focus:text-white">All Users</SelectItem>
                <SelectItem value="personal" className="text-blue-400 focus:bg-slate-700 focus:text-blue-300">
                  <span className="flex items-center gap-2"><UserCircle className="w-4 h-4" /> Personal</span>
                </SelectItem>
                <SelectItem value="business" className="text-purple-400 focus:bg-slate-700 focus:text-purple-300">
                  <span className="flex items-center gap-2"><Building2 className="w-4 h-4" /> Business</span>
                </SelectItem>
              </SelectContent>
            </Select>

            <Select value={filterDateRange} onValueChange={(v) => { setFilterDateRange(v); setPage(0); }}>
              <SelectTrigger className="w-[160px] bg-slate-800 border-slate-600 text-slate-100">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-slate-400" />
                  <SelectValue placeholder="Date Range" />
                </div>
              </SelectTrigger>
              <SelectContent className="bg-slate-800 border-slate-600">
                <SelectItem value="all" className="text-slate-100 focus:bg-slate-700 focus:text-white">All Time</SelectItem>
                <SelectItem value="7days" className="text-slate-100 focus:bg-slate-700 focus:text-white">Last 7 Days</SelectItem>
                <SelectItem value="10days" className="text-slate-100 focus:bg-slate-700 focus:text-white">Last 10 Days</SelectItem>
                <SelectItem value="20days" className="text-slate-100 focus:bg-slate-700 focus:text-white">Last 20 Days</SelectItem>
                <SelectItem value="30days" className="text-slate-100 focus:bg-slate-700 focus:text-white">Last 30 Days</SelectItem>
                <SelectItem value="custom" className="text-amber-400 focus:bg-slate-700 focus:text-amber-300">Custom Range</SelectItem>
              </SelectContent>
            </Select>

            {/* Custom date inputs */}
            {filterDateRange === 'custom' && (
              <>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-400">From:</span>
                  <Input
                    type="date"
                    value={customDateFrom}
                    onChange={(e) => setCustomDateFrom(e.target.value)}
                    className="w-[140px] bg-slate-800 border-slate-600 text-slate-100 text-sm"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-400">To:</span>
                  <Input
                    type="date"
                    value={customDateTo}
                    onChange={(e) => setCustomDateTo(e.target.value)}
                    className="w-[140px] bg-slate-800 border-slate-600 text-slate-100 text-sm"
                  />
                </div>
              </>
            )}

            {/* Clear filters button */}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setFilterModel("all");
                setFilterFunction("all");
                setFilterStatus("all");
                setFilterUserType("all");
                setFilterDateRange("all");
                setCustomDateFrom("");
                setCustomDateTo("");
                setSearchUser("");
                setPage(0);
              }}
              className="text-slate-400 hover:text-slate-200"
            >
              Clear Filters
            </Button>
          </div>
        </div>
      </Card>

      {/* Logs Table */}
      <Card className="p-4 bg-slate-800/50 border-slate-700">
        <h3 className="text-sm font-semibold text-slate-300 mb-4">AI Logs ({data?.count || 0})</h3>
        
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-700">
                    <th className="text-left py-3 px-2 text-slate-400 font-medium">User</th>
                    <th className="text-left py-3 px-2 text-slate-400 font-medium">Function</th>
                    <th className="text-left py-3 px-2 text-slate-400 font-medium">Model</th>
                    <th className="text-left py-3 px-2 text-slate-400 font-medium">Tokens</th>
                    <th className="text-left py-3 px-2 text-slate-400 font-medium">Credits</th>
                    <th className="text-left py-3 px-2 text-slate-400 font-medium">Duration</th>
                    <th className="text-left py-3 px-2 text-slate-400 font-medium">Status</th>
                    <th className="text-left py-3 px-2 text-slate-400 font-medium">Date</th>
                    <th className="text-left py-3 px-2 text-slate-400 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {(data?.logs || []).map((log: any) => (
                    <tr key={log.id} className="border-b border-slate-700/50 hover:bg-slate-800/50">
                      <td className="py-3 px-2">
                        <div className="flex items-center gap-2">
                          {(() => {
                            // For business users, prefer brand logo, fallback to avatar
                            const isBrand = log.user_profiles?.is_brand;
                            const avatarUrl = isBrand ? (log.brand_logo || log.user_profiles?.avatar_url) : log.user_profiles?.avatar_url;
                            
                            return avatarUrl ? (
                              <img src={avatarUrl} alt="" className="w-8 h-8 rounded-full object-cover" />
                            ) : (
                              <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center">
                                {isBrand ? <Building2 className="w-4 h-4 text-slate-500" /> : <User className="w-4 h-4 text-slate-500" />}
                              </div>
                            );
                          })()}
                          <div className="flex flex-col">
                            <span className="text-slate-300 truncate max-w-[120px]">
                              @{log.user_profiles?.username || 'Unknown'}
                            </span>
                            <Badge className={`text-[10px] w-fit mt-0.5 ${log.user_profiles?.is_brand ? 'bg-purple-900/50 text-purple-300' : 'bg-blue-900/50 text-blue-300'}`}>
                              {log.user_profiles?.is_brand ? 'business' : 'personal'}
                            </Badge>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-2">
                        <Badge className="bg-purple-900/50 text-purple-300 text-xs">
                          {log.function_name || '—'}
                        </Badge>
                      </td>
                      <td className="py-3 px-2">
                        <span className="text-slate-300">{log.model || '—'}</span>
                      </td>
                      <td className="py-3 px-2">
                        <div className="text-slate-300">
                          {log.total_tokens || 0}
                          {log.input_tokens && log.output_tokens && (
                            <span className="text-xs text-slate-500 ml-1">
                              ({log.input_tokens}↓ {log.output_tokens}↑)
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-2">
                        <span className="text-green-400">{parseFloat(log.cost_credits || 0).toFixed(6)}</span>
                      </td>
                      <td className="py-3 px-2">
                        <span className="text-slate-300">{log.duration_ms ? `${log.duration_ms}ms` : '—'}</span>
                      </td>
                      <td className="py-3 px-2">
                        {log.status === 'success' ? (
                          <Badge className="bg-green-900/50 text-green-300 text-xs flex items-center gap-1 w-fit">
                            <CheckCircle className="w-3 h-3" /> Success
                          </Badge>
                        ) : (
                          <Badge className="bg-red-900/50 text-red-300 text-xs flex items-center gap-1 w-fit">
                            <AlertCircle className="w-3 h-3" /> Error
                          </Badge>
                        )}
                      </td>
                      <td className="py-3 px-2">
                        <div className="flex items-center gap-1 text-slate-400 text-xs">
                          <Clock className="w-3 h-3" />
                          {formatDate(log.created_at)}
                        </div>
                      </td>
                      <td className="py-3 px-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-slate-400 hover:text-slate-200"
                          onClick={() => setSelectedLog(log)}
                        >
                          <Eye className="w-4 h-4" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {(data?.logs || []).length === 0 && (
              <div className="text-slate-500 text-center py-12">No AI logs found</div>
            )}

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-4 pt-4 border-t border-slate-700">
                <div className="text-sm text-slate-400">
                  Page {page + 1} of {totalPages}
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage(Math.max(0, page - 1))}
                    disabled={page === 0}
                    className="border-slate-700"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage(Math.min(totalPages - 1, page + 1))}
                    disabled={page >= totalPages - 1}
                    className="border-slate-700"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </Card>

      {/* Log Detail Dialog */}
      <Dialog open={!!selectedLog} onOpenChange={() => setSelectedLog(null)}>
        <DialogContent className="max-w-2xl bg-slate-900 border-slate-700 max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-slate-100 flex items-center gap-2">
              <Brain className="w-5 h-5 text-purple-400" /> AI Log Details
            </DialogTitle>
            <DialogDescription className="text-slate-400">
              {selectedLog?.function_name} • {selectedLog?.created_at && formatDate(selectedLog.created_at)}
            </DialogDescription>
          </DialogHeader>
          
          {selectedLog && (
            <div className="space-y-4">
              {/* User Info */}
              <div className="flex items-center gap-3 p-3 rounded-lg bg-slate-800/50">
                {selectedLog.user_profiles?.avatar_url ? (
                  <img src={selectedLog.user_profiles.avatar_url} alt="" className="w-10 h-10 rounded-full" />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-slate-700 flex items-center justify-center">
                    <User className="w-5 h-5 text-slate-500" />
                  </div>
                )}
                <div>
                  <div className="text-sm font-medium text-slate-200">
                    @{selectedLog.user_profiles?.username || 'Unknown'}
                  </div>
                  <div className="text-xs text-slate-500">
                    {selectedLog.user_profiles?.full_name || 'No name'}
                  </div>
                </div>
              </div>

              {/* Stats Grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="p-3 rounded-lg bg-slate-800/50 text-center">
                  <div className="text-lg font-bold text-purple-400">{selectedLog.model || '—'}</div>
                  <div className="text-xs text-slate-500">Model</div>
                </div>
                <div className="p-3 rounded-lg bg-slate-800/50 text-center">
                  <div className="text-lg font-bold text-blue-400">{selectedLog.total_tokens || 0}</div>
                  <div className="text-xs text-slate-500">Total Tokens</div>
                </div>
                <div className="p-3 rounded-lg bg-slate-800/50 text-center">
                  <div className="text-lg font-bold text-green-400">{parseFloat(selectedLog.cost_credits || 0).toFixed(6)}</div>
                  <div className="text-xs text-slate-500">Credits</div>
                </div>
                <div className="p-3 rounded-lg bg-slate-800/50 text-center">
                  <div className="text-lg font-bold text-amber-400">{selectedLog.duration_ms || 0}ms</div>
                  <div className="text-xs text-slate-500">Duration</div>
                </div>
              </div>

              {/* Token Breakdown */}
              {(selectedLog.input_tokens || selectedLog.output_tokens) && (
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 rounded-lg bg-slate-800/50">
                    <div className="text-sm text-slate-400">Input Tokens</div>
                    <div className="text-xl font-bold text-slate-200">{selectedLog.input_tokens || 0}</div>
                  </div>
                  <div className="p-3 rounded-lg bg-slate-800/50">
                    <div className="text-sm text-slate-400">Output Tokens</div>
                    <div className="text-xl font-bold text-slate-200">{selectedLog.output_tokens || 0}</div>
                  </div>
                </div>
              )}

              {/* Status */}
              <div className="p-3 rounded-lg bg-slate-800/50">
                <div className="text-sm text-slate-400 mb-2">Status</div>
                {selectedLog.status === 'success' ? (
                  <Badge className="bg-green-900/50 text-green-300">Success</Badge>
                ) : (
                  <div className="space-y-2">
                    <Badge className="bg-red-900/50 text-red-300">Error</Badge>
                    {selectedLog.error_message && (
                      <div className="text-sm text-red-400 mt-2 p-2 rounded bg-red-950/30">
                        {selectedLog.error_message}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Prompt */}
              {selectedLog.prompt && (
                <div className="p-3 rounded-lg bg-slate-800/50">
                  <div className="text-sm text-slate-400 mb-2">Prompt</div>
                  <pre className="text-xs text-slate-300 whitespace-pre-wrap max-h-40 overflow-y-auto bg-slate-900 p-2 rounded">
                    {selectedLog.prompt}
                  </pre>
                </div>
              )}

              {/* Response */}
              {selectedLog.response && (
                <div className="p-3 rounded-lg bg-slate-800/50">
                  <div className="text-sm text-slate-400 mb-2">Response</div>
                  <pre className="text-xs text-slate-300 whitespace-pre-wrap max-h-40 overflow-y-auto bg-slate-900 p-2 rounded">
                    {selectedLog.response}
                  </pre>
                </div>
              )}

              {/* Metadata */}
              {selectedLog.metadata && Object.keys(selectedLog.metadata).length > 0 && (
                <div className="p-3 rounded-lg bg-slate-800/50">
                  <div className="text-sm text-slate-400 mb-2">Metadata</div>
                  <pre className="text-xs text-slate-300 whitespace-pre-wrap bg-slate-900 p-2 rounded">
                    {JSON.stringify(selectedLog.metadata, null, 2)}
                  </pre>
                </div>
              )}

              {/* IDs */}
              <div className="p-3 rounded-lg bg-slate-800/50 text-xs">
                <div className="flex justify-between text-slate-500">
                  <span>Log ID:</span>
                  <code className="text-slate-400">{selectedLog.id}</code>
                </div>
                <div className="flex justify-between text-slate-500 mt-1">
                  <span>User ID:</span>
                  <code className="text-slate-400">{selectedLog.user_id}</code>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminAIUsage;
