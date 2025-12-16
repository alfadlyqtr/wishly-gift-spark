import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Eye, CirclePlus, Heart, Users, BarChart3, Activity, Package, Settings2, ExternalLink, MessageCircle, Send, CheckCircle2, Clock, Trash2, BadgeCheck } from "lucide-react";
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { brandFollowUser, brandUnfollowUser } from "@/lib/follow";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const BrandDashboard = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("overview");
  const [selectedUser, setSelectedUser] = useState<any | null>(null);
  const [overviewDetail, setOverviewDetail] = useState<
    null | "views" | "likes" | "wishlist" | "active" | "users"
  >(null);
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");

  // Fetch comprehensive brand analytics with real-time updates
  const { data: brandData } = useQuery({
    queryKey: ["brand-dashboard"],
    refetchInterval: 5000, // Refetch every 5 seconds for real-time updates
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      const { data: brand } = await (supabase as any)
        .from("brands")
        .select("id, brand_name, is_verified")
        .eq("user_id", user.id)
        .maybeSingle();

      if (!brand) return null;

      // Get all brand products
      const { data: products } = await (supabase as any)
        .from("brand_products")
        .select("id, name, image_url, product_url")
        .eq("brand_id", brand.id);

      if (import.meta.env.DEV) {
        console.log("🏢 Brand ID:", brand.id);
        console.log("📦 Your Products:", products);
      }

      // Product views tracking (requires brand_product_views table from migration)
      const viewsCount = 0; // Will be enabled when brand_product_views migration is run

      // Use aggregated analytics function (bypasses RLS safely)
      const { data: analytics, error: analyticsError } = await (supabase as any).rpc(
        "brand_dashboard_analytics",
        { brand_uuid: brand.id }
      );

      if (analyticsError) {
        console.error("❌ Error from brand_dashboard_analytics:", analyticsError);
      }

      if (import.meta.env.DEV) {
        console.log("📊 Analytics rows:", analytics);
      }

      const analyticsRows = ((analytics || []) as any[]) as Array<{
        product_id: string;
        product_name: string;
        adds_count: number;
        wishlist_ids: string[] | null;
        views_count: number;
        viewer_ids: string[] | null;
        likes_count: number;
        liker_ids: string[] | null;
      }>;

      // Total wishlist adds across all products
      const wishlistAdds = analyticsRows.reduce(
        (sum, row) => sum + (row.adds_count ?? 0),
        0
      );

      // Total product views across all products
      const totalViews = analyticsRows.reduce(
        (sum, row) => sum + (row.views_count ?? 0),
        0
      );

      // Total likes across all products
      const totalLikes = analyticsRows.reduce(
        (sum, row) => sum + (row.likes_count ?? 0),
        0
      );

      // Unique wishlists that contain any of this brand's products
      const wishlistIdSet = new Set<string>();
      for (const row of analyticsRows) {
        (row.wishlist_ids || []).forEach((id) => {
          if (id) wishlistIdSet.add(id);
        });
      }

      // Track unique users who viewed or liked products
      const likerIdSet = new Set<string>();
      const viewerIdSet = new Set<string>();
      const engagementByUser: Record<
        string,
        { likedProducts: Set<string>; viewedProducts: Set<string> }
      > = {};

      for (const row of analyticsRows) {
        const productName = row.product_name || "Product";

        (row.viewer_ids || []).forEach((id) => {
          if (!id) return;
          viewerIdSet.add(id);
          if (!engagementByUser[id]) {
            engagementByUser[id] = {
              likedProducts: new Set<string>(),
              viewedProducts: new Set<string>(),
            };
          }
          engagementByUser[id].viewedProducts.add(productName);
        });

        (row.liker_ids || []).forEach((id) => {
          if (!id) return;
          likerIdSet.add(id);
          if (!engagementByUser[id]) {
            engagementByUser[id] = {
              likedProducts: new Set<string>(),
              viewedProducts: new Set<string>(),
            };
          }
          engagementByUser[id].likedProducts.add(productName);
        });
      }

      const engagedIds = Array.from(new Set<string>([...likerIdSet, ...viewerIdSet]));
      const likerIds = Array.from(likerIdSet);
      let likers: Array<{ id: string; name: string; username: string | null; avatar_url: string | null }> = [];

      const profileMap: Record<string, { id: string; name: string; username: string | null; avatar_url: string | null }> = {};

      if (engagedIds.length > 0) {
        const { data: profiles, error: profilesError } = await (supabase as any)
          .from("user_profiles")
          .select("id, full_name, username, avatar_url")
          .in("id", engagedIds)
          .limit(20);

        if (profilesError) {
          console.error("❌ Error loading liker profiles:", profilesError);
        } else {
          (profiles || []).forEach((p: any) => {
            const entry = {
              id: p.id,
              name: p.full_name || p.username || "User",
              username: p.username || null,
              avatar_url: p.avatar_url || null,
            };
            profileMap[p.id] = entry;
          });

          likers = likerIds
            .map((id) => profileMap[id])
            .filter(Boolean) as Array<{ id: string; name: string; username: string | null; avatar_url: string | null }>;
        }
      }

      // Build maps for adds, views, and likes per product
      const addsByProduct: Record<string, number> = {};
      const viewsByProduct: Record<string, number> = {};
      const likesByProduct: Record<string, number> = {};
      for (const row of analyticsRows) {
        addsByProduct[row.product_id] = row.adds_count ?? 0;
        viewsByProduct[row.product_id] = row.views_count ?? 0;
        likesByProduct[row.product_id] = row.likes_count ?? 0;
      }

      const productStats = (products || []).map((p: any) => ({
        id: p.id,
        name: p.name,
        image_url: p.image_url,
        views: viewsByProduct[p.id] || 0,
        adds: addsByProduct[p.id] || 0,
        likes: likesByProduct[p.id] || 0,
      }));

      const topProducts = [...productStats]
        .sort((a: any, b: any) => b.adds - a.adds)
        .slice(0, 5);

      // Build a simple recent activity feed summarizing who viewed/liked what
      const recentActivity: any[] = [];
      for (const [userId, engagement] of Object.entries(engagementByUser)) {
        const profile = profileMap[userId];
        if (!profile) continue;

        const likedNames = Array.from(engagement.likedProducts);
        const viewedNames = Array.from(engagement.viewedProducts);

        if (likedNames.length === 0 && viewedNames.length === 0) continue;

        recentActivity.push({
          userId: profile.id,
          user: profile.name,
          username: profile.username,
          avatar_url: profile.avatar_url,
          likedNames,
          viewedNames,
        });
      }

      const userEngagement = Object.entries(engagementByUser).flatMap(
        ([userId, engagement]) => {
          const profile = profileMap[userId];
          if (!profile) return [] as any[];
          return [
            {
              id: profile.id,
              name: profile.name,
              username: profile.username,
              avatar_url: profile.avatar_url,
              likedProducts: Array.from(engagement.likedProducts),
              viewedProducts: Array.from(engagement.viewedProducts),
            },
          ];
        },
      );

      return {
        brandId: brand.id,
        brandName: (brand as any).brand_name || null,
        isVerified: (brand as any).is_verified === true,
        productCount: products?.length || 0,
        totalViews,
        wishlistAdds,
        totalLikes,
        uniqueUsers: engagedIds.length,
        uniqueLikers: likerIds.length,
        likers,
        userEngagement,
        products: productStats,
        topProducts,
        recentActivity,
      };
    },
  });

  const brandName = (brandData as any)?.brandName || "";
  const isVerified = (brandData as any)?.isVerified === true;

  // Real-time listener for admin refresh broadcast
  useEffect(() => {
    let channel: any;

    const setupRealtime = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      channel = (supabase as any)
        .channel(`admin-master-control-${user.id}`)
        .on(
          'broadcast',
          { event: 'refresh' },
          () => {
            // Admin triggered a refresh - refetch dashboard data
            queryClient.invalidateQueries({ queryKey: ["brand-dashboard"] });
          }
        )
        .subscribe();
    };

    setupRealtime();

    return () => {
      if (channel) {
        (supabase as any).removeChannel(channel);
      }
    };
  }, [queryClient]);

  const stats = {
    totalViews: brandData?.totalViews || 0,
    wishlistAdds: brandData?.wishlistAdds || 0,
    totalLikes: brandData?.totalLikes || 0,
    activeProducts: brandData?.productCount || 0,
    uniqueUsers: brandData?.uniqueUsers || 0,
    uniqueLikers: brandData?.uniqueLikers || 0,
  };

  const allProducts = brandData?.products || [];
  const topProducts = brandData?.topProducts || [];
  const recentActivity = brandData?.recentActivity || [];
  const likers = brandData?.likers || [];
  const userEngagement = brandData?.userEngagement || [];
  const brandId = (brandData as any)?.brandId;

  // Fetch all questions for this brand's products
  const { data: brandQuestions, isLoading: questionsLoading } = useQuery({
    queryKey: ["brand-questions", brandId],
    queryFn: async () => {
      if (!brandId) return [];

      // Step 1: Get all product IDs for this brand
      const { data: products, error: productsError } = await (supabase as any)
        .from("brand_products")
        .select("id")
        .eq("brand_id", brandId);

      if (productsError) {
        console.error("Error fetching brand products:", productsError);
        throw productsError;
      }

      if (!products || products.length === 0) {
        if (import.meta.env.DEV) {
          console.log("No products found for brand:", brandId);
        }
        return [];
      }

      const productIds = products.map((p: any) => p.id);
      if (import.meta.env.DEV) {
        console.log("Brand product IDs:", productIds);
      }

      // Step 2: Get all questions for these products
      const { data: questions, error: questionsError } = await (supabase as any)
        .from("product_questions")
        .select(`
          *,
          brand_products:product_id (
            id,
            name,
            image_url
          )
        `)
        .in("product_id", productIds)
        .order("created_at", { ascending: false });

      if (questionsError) {
        console.error("Error fetching questions:", questionsError);
        throw questionsError;
      }

      // Step 3: Fetch user profiles for these questions
      const userIds = Array.from(new Set((questions || []).map((q: any) => q.user_id).filter(Boolean)));
      
      if (userIds.length > 0) {
        const { data: profiles } = await (supabase as any)
          .from("user_profiles")
          .select("id, username, full_name, avatar_url")
          .in("id", userIds);
          
        const profileMap = new Map((profiles || []).map((p: any) => [p.id, p]));
        
        return (questions || []).map((q: any) => ({
          ...q,
          user_profiles: profileMap.get(q.user_id) || null
        }));
      }

      if (import.meta.env.DEV) {
        console.log("Questions found:", questions?.length || 0);
      }
      return questions || [];
    },
    enabled: !!brandId,
    refetchInterval: 10000, // Refresh every 10 seconds
  });

  // Answer a question mutation
  const answerMutation = useMutation({
    mutationFn: async ({ questionId, answer, userId, productName }: { questionId: string; answer: string; userId: string; productName: string }) => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) throw new Error("Not authenticated");

      const { error } = await (supabase as any)
        .from("product_questions")
        .update({
          answer,
          answered_at: new Date().toISOString(),
          answered_by: auth.user.id,
          status: "answered",
        })
        .eq("id", questionId);

      if (error) throw error;

      // Create a notification activity for the user who asked the question
      try {
        await (supabase as any)
          .from("activities")
          .insert({
            user_id: userId,
            type: "question_answered",
            metadata: {
              question_id: questionId,
              product_name: productName,
              brand_name: brandName,
              answer_preview: answer.slice(0, 100),
            },
          });
      } catch (notifErr) {
        console.warn("Failed to create notification for question answer:", notifErr);
      }
    },
    onSuccess: () => {
      setReplyingTo(null);
      setReplyText("");
      queryClient.invalidateQueries({ queryKey: ["brand-questions", brandId] });
      toast.success(t("brand.question_answered", "Answer posted!"));
    },
    onError: (e: any) => {
      toast.error(e?.message || t("brand.question_answer_error", "Failed to post answer"));
    },
  });

  const handleAnswer = (questionId: string, userId: string, productName: string) => {
    if (!replyText.trim()) return;
    answerMutation.mutate({ questionId, answer: replyText.trim(), userId, productName });
  };

  // Delete question mutation (brand can remove questions about their products)
  const deleteQuestionMutation = useMutation({
    mutationFn: async (questionId: string) => {
      const { error } = await (supabase as any)
        .from("product_questions")
        .delete()
        .eq("id", questionId);

      if (error) throw error;
    },
    onSuccess: (_data, questionId: string) => {
      // Optimistically remove from cache so UI updates immediately
      queryClient.setQueryData(["brand-questions", brandId], (old: any) => {
        if (!old || !Array.isArray(old)) return old;
        return old.filter((q: any) => q.id !== questionId);
      });

      // Also trigger refetch to stay in sync with server
      queryClient.invalidateQueries({ queryKey: ["brand-questions", brandId] });
      toast.success(t("brand.question_deleted", "Question deleted"));
    },
    onError: (e: any) => {
      toast.error(e?.message || t("brand.question_delete_error", "Failed to delete question"));
    },
  });

  const unansweredCount = (brandQuestions || []).filter((q: any) => q.status === "unanswered").length;

  // Helper function to format time ago
  function getTimeAgo(dateString: string) {
    const date = new Date(dateString);
    const now = new Date();
    const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);
    
    if (seconds < 60) return "Just now";
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[hsl(var(--brand-cool-start))] via-background to-[hsl(var(--brand-warm-start))] p-3 sm:p-4 md:p-6">
      {/* Header */}
      <div className="mb-4 sm:mb-6">
        <div className="flex items-center gap-2 mb-1">
          <h1
            className="text-3xl sm:text-4xl md:text-5xl font-extrabold bg-gradient-to-r from-[hsl(var(--brand-cool-start))] via-[hsl(var(--brand-cool-end))] to-[hsl(var(--brand-warm-end))] bg-clip-text text-transparent drop-shadow-[0_1px_1px_rgba(255,255,255,0.6)]"
            style={{ WebkitTextStroke: "0.6px rgba(15, 23, 42, 0.85)" }}
          >
            {t("brand.dashboard_title", "Brand Dashboard")}
          </h1>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <p
            className={`text-[11px] sm:text-sm font-extrabold drop-shadow-[0_1px_1px_rgba(255,255,255,0.6)] ${
              isVerified 
                ? "text-lg sm:text-xl bg-gradient-to-r from-[hsl(var(--brand-cool-start))] via-[hsl(var(--brand-cool-end))] to-[hsl(var(--brand-warm-end))] bg-clip-text text-transparent"
                : "text-slate-800"
            }`}
            style={{ WebkitTextStroke: isVerified ? "0.5px rgba(15, 23, 42, 0.7)" : "0.4px rgba(15, 23, 42, 0.5)" }}
          >
            {brandName
              ? t("brand.dashboard_welcome", "Welcome {{name}}", { name: brandName })
              : t("brand.dashboard_subtitle", "Track your product visibility and wishlist performance")}
          </p>
          {isVerified && (
            <span className="verified-chip">
              <BadgeCheck className="h-3.5 w-3.5" />
              {t("brand.verified", "Verified")}
            </span>
          )}
        </div>
      </div>

      {/* Tabs for Mobile-First Design */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <div className="w-full overflow-x-auto pb-1">
          <TabsList className="inline-flex min-w-max bg-white/70 backdrop-blur border border-white/40 px-1 py-1 rounded-full gap-1">
            <TabsTrigger value="overview" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-[hsl(var(--brand-cool-start))] data-[state=active]:to-[hsl(var(--brand-warm-end))] data-[state=active]:text-white rounded-full px-3 py-1.5 text-xs sm:text-sm">
              <BarChart3 className="h-4 w-4 mr-1" />
              <span className="hidden sm:inline">{t("dashboard_tab_overview", "Overview")}</span>
            </TabsTrigger>
            <TabsTrigger value="products" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-[hsl(var(--brand-cool-start))] data-[state=active]:to-[hsl(var(--brand-warm-end))] data-[state=active]:text-white rounded-full px-3 py-1.5 text-xs sm:text-sm">
              <Package className="h-4 w-4 mr-1" />
              <span className="hidden sm:inline">{t("dashboard_tab_products", "Products")}</span>
            </TabsTrigger>
            <TabsTrigger value="analytics" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-[hsl(var(--brand-cool-start))] data-[state=active]:to-[hsl(var(--brand-warm-end))] data-[state=active]:text-white rounded-full px-3 py-1.5 text-xs sm:text-sm">
              <BarChart3 className="h-4 w-4 mr-1" />
              <span className="hidden sm:inline">{t("dashboard_tab_analytics", "Analytics")}</span>
            </TabsTrigger>
            <TabsTrigger value="activity" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-[hsl(var(--brand-cool-start))] data-[state=active]:to-[hsl(var(--brand-warm-end))] data-[state=active]:text-white rounded-full px-3 py-1.5 text-xs sm:text-sm">
              <Activity className="h-4 w-4 mr-1" />
              <span className="hidden sm:inline">{t("dashboard_tab_activity", "Activity")}</span>
            </TabsTrigger>
            <TabsTrigger value="questions" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-[hsl(var(--brand-cool-start))] data-[state=active]:to-[hsl(var(--brand-warm-end))] data-[state=active]:text-white rounded-full px-3 py-1.5 text-xs sm:text-sm relative">
              <MessageCircle className="h-4 w-4 mr-1" />
              <span className="hidden sm:inline">{t("dashboard_tab_questions", "Questions")}</span>
              {unansweredCount > 0 && (
                <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-rose-500 text-[10px] font-bold text-white flex items-center justify-center">
                  {unansweredCount > 9 ? "9+" : unansweredCount}
                </span>
              )}
            </TabsTrigger>
          </TabsList>
        </div>

        {/* OVERVIEW TAB */}
        <TabsContent value="overview" className="space-y-4 sm:space-y-6">
          {/* Hero Stats Grid */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            {/* Total Views Card */}
            <Card
              className="bg-white/70 backdrop-blur border border-white/40 shadow-lg hover:shadow-xl transition-all duration-300 cursor-pointer"
              onClick={() => setOverviewDetail("views")}
            >
              <CardContent className="p-3 sm:p-4 md:p-6">
                <div className="flex items-center justify-between mb-2 sm:mb-4">
                  <div className="p-2 sm:p-3 rounded-lg sm:rounded-xl bg-gradient-to-br from-[hsl(var(--brand-cool-start))]/20 to-[hsl(var(--brand-cool-end))]/20">
                    <Eye className="h-4 w-4 sm:h-6 sm:w-6 text-[hsl(var(--brand-cool-start))]" />
                  </div>
                </div>
                <div className="text-2xl sm:text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-[hsl(var(--brand-cool-start))] to-[hsl(var(--brand-cool-end))] mb-1">
                  {stats.totalViews.toLocaleString()}
                </div>
                <div className="text-sm text-muted-foreground">{t("brand.dashboard_card_views", "Product Views")}</div>
                <div className="text-xs text-muted-foreground mt-2">{t("brand.dashboard_card_views_sub", "Last 30 days")}</div>
              </CardContent>
            </Card>

            {/* Wishlist Adds Card */}
            <Card
              className="bg-white/70 backdrop-blur border border-white/40 shadow-lg hover:shadow-xl transition-all duration-300 cursor-pointer"
              onClick={() => setOverviewDetail("wishlist")}
            >
              <CardContent className="p-3 sm:p-4 md:p-6">
                <div className="flex items-center justify-between mb-2 sm:mb-4">
                  <div className="p-2 sm:p-3 rounded-lg sm:rounded-xl bg-gradient-to-br from-emerald-500/20 to-teal-500/20">
                    <CirclePlus className="h-4 w-4 sm:h-6 sm:w-6 text-emerald-500" />
                  </div>
                </div>
                <div className="text-2xl sm:text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-pink-500 to-rose-500 mb-1">
                  {stats.wishlistAdds.toLocaleString()}
                </div>
                <div className="text-sm text-muted-foreground">{t("brand.dashboard_card_wishlist_adds", "Wishlist Adds")}</div>
                <div className="text-xs text-muted-foreground mt-2">{t("brand.dashboard_card_wishlist_adds_sub", "All time")}</div>
              </CardContent>
            </Card>

            {/* Likes Card */}
            <Card
              className="bg-white/70 backdrop-blur border border-white/40 shadow-lg hover:shadow-xl transition-all duration-300 cursor-pointer"
              onClick={() => setOverviewDetail("likes")}
            >
              <CardContent className="p-3 sm:p-4 md:p-6">
                <div className="flex items-center justify-between mb-2 sm:mb-4">
                  <div className="p-2 sm:p-3 rounded-lg sm:rounded-xl bg-gradient-to-br from-rose-500/20 to-pink-500/20">
                    <Heart className="h-4 w-4 sm:h-6 sm:w-6 text-rose-500" />
                  </div>
                </div>
                <div className="text-2xl sm:text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-rose-500 to-pink-500 mb-1">
                  {stats.totalLikes.toLocaleString()}
                </div>
                <div className="text-sm text-muted-foreground">{t("brand.dashboard_card_likes", "Likes")}</div>
                <div className="text-xs text-muted-foreground mt-2">
                  {stats.uniqueLikers > 0
                    ? t("brand.dashboard_card_likes_sub", "{{count}} users liked your products", { count: stats.uniqueLikers })
                    : t("brand.dashboard_card_likes_empty", "No likes yet")}
                </div>
                {likers && likers.length > 0 && (
                  <div className="mt-3 flex -space-x-2">
                    {likers.slice(0, 5).map((user: any) => {
                      const engagement = userEngagement.find((u: any) => u.id === user.id) || null;
                      return (
                        <button
                          key={user.id}
                          type="button"
                          className="inline-flex h-7 w-7 rounded-full border-2 border-white overflow-hidden bg-gradient-to-br from-[hsl(var(--brand-cool-start))] to-[hsl(var(--brand-warm-end))] focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-[hsl(var(--brand-cool-start))]"
                          title={user.name}
                          onClick={() =>
                            setSelectedUser(
                              engagement || {
                                id: user.id,
                                name: user.name,
                                username: user.username,
                                avatar_url: user.avatar_url,
                                likedProducts: [],
                                viewedProducts: [],
                              },
                            )
                          }
                        >
                          {user.avatar_url ? (
                            <img
                              src={user.avatar_url}
                              alt={user.name}
                              className="h-full w-full object-cover"
                              onError={(e: any) => {
                                e.currentTarget.style.display = "none";
                              }}
                            />
                          ) : (
                            <span className="flex h-full w-full items-center justify-center text-[10px] font-semibold text-white">
                              {user.name?.charAt(0)?.toUpperCase() || "?"}
                            </span>
                          )}
                        </button>
                      );
                    })}
                    {likers.length > 5 && (
                      <span className="inline-flex h-7 w-7 items-center justify-center rounded-full border-2 border-white bg-white/80 text-[10px] text-muted-foreground">
                        +{likers.length - 5}
                      </span>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Active Products Card */}
            <Card
              className="bg-white/70 backdrop-blur border border-white/40 shadow-lg hover:shadow-xl transition-all duration-300 cursor-pointer"
              onClick={() => setOverviewDetail("active")}
            >
              <CardContent className="p-3 sm:p-4 md:p-6">
                <div className="flex items-center justify-between mb-2 sm:mb-4">
                  <div className="p-2 sm:p-3 rounded-lg sm:rounded-xl bg-gradient-to-br from-emerald-500/20 to-teal-500/20">
                    <Package className="h-4 w-4 sm:h-6 sm:w-6 text-emerald-500" />
                  </div>
                </div>
                <div className="text-2xl sm:text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-emerald-500 to-teal-500 mb-1">
                  {stats.activeProducts}
                </div>
                <div className="text-sm text-muted-foreground">{t("brand.dashboard_card_active_products", "Active Products")}</div>
              </CardContent>
            </Card>

            {/* Unique Users Card */}
            <Card
              className="bg-gradient-to-br from-[hsl(var(--brand-cool-start))]/10 to-[hsl(var(--brand-warm-end))]/10 backdrop-blur border border-white/40 shadow-lg hover:shadow-xl transition-all duration-300 cursor-pointer"
              onClick={() => setOverviewDetail("users")}
            >
              <CardContent className="p-3 sm:p-4 md:p-6">
                <div className="flex items-center justify-between mb-2 sm:mb-4">
                  <div className="p-2 sm:p-3 rounded-lg sm:rounded-xl bg-gradient-to-br from-[hsl(var(--brand-warm-start))]/20 to-[hsl(var(--brand-warm-end))]/20">
                    <Users className="h-4 w-4 sm:h-6 sm:w-6 text-[hsl(var(--brand-warm-start))]" />
                  </div>
                </div>
                <div className="text-2xl sm:text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-[hsl(var(--brand-warm-start))] to-[hsl(var(--brand-warm-end))] mb-1">
                  {stats.uniqueUsers.toLocaleString()}
                </div>
                <div className="text-sm text-muted-foreground">{t("brand.dashboard_card_unique_users", "Unique Users")}</div>
                <div className="text-xs text-muted-foreground mt-2">{t("brand.dashboard_card_unique_users_sub", "With your products")}</div>
              </CardContent>
            </Card>

            {/* Engagement Donut Card */}
            <Card className="bg-white/70 backdrop-blur border border-white/40 shadow-lg hover:shadow-xl transition-all duration-300">
              <CardContent className="p-3 sm:p-4 md:p-6">
                <div className="flex items-center justify-between mb-2 sm:mb-4">
                  <div className="p-2 sm:p-3 rounded-lg sm:rounded-xl bg-gradient-to-br from-[hsl(var(--brand-cool-start))]/20 to-[hsl(var(--brand-warm-end))]/20">
                    <BarChart3 className="h-4 w-4 sm:h-6 sm:w-6 text-[hsl(var(--brand-cool-start))]" />
                  </div>
                </div>

                {(() => {
                  const views = stats.totalViews || 0;
                  const adds = stats.wishlistAdds || 0;
                  const likes = stats.totalLikes || 0;
                  const total = views + adds + likes;

                  const r = 18;
                  const c = 2 * Math.PI * r;
                  const gap = 2;

                  const v = total ? (views / total) * c : 0;
                  const a = total ? (adds / total) * c : 0;
                  const l = total ? (likes / total) * c : 0;

                  const vLen = Math.max(0, v - gap);
                  const aLen = Math.max(0, a - gap);
                  const lLen = Math.max(0, l - gap);

                  const o1 = 0;
                  const o2 = v;
                  const o3 = v + a;

                  return (
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex flex-col min-w-0">
                        <div className="text-sm text-muted-foreground">{t("brand.dashboard_performance_mini_chart_label", "Engagement mix")}</div>
                        <div className="text-xs text-muted-foreground mt-1">{t("brand.dashboard_card_views_sub", "Last 30 days")}</div>

                        <div className="mt-3 space-y-2">
                          <div className="flex items-center gap-2 text-[11px] text-slate-700">
                            <span className="inline-block h-2.5 w-2.5 rounded-full bg-[hsl(var(--brand-cool-start))]" />
                            <span className="truncate">{t("brand.dashboard_card_views", "Views")}</span>
                            <span className="ml-auto tabular-nums text-muted-foreground">{views.toLocaleString()}</span>
                          </div>
                          <div className="flex items-center gap-2 text-[11px] text-slate-700">
                            <span className="inline-block h-2.5 w-2.5 rounded-full bg-[hsl(var(--brand-cool-end))]" />
                            <span className="truncate">{t("brand.dashboard_card_wishlist_adds", "Adds")}</span>
                            <span className="ml-auto tabular-nums text-muted-foreground">{adds.toLocaleString()}</span>
                          </div>
                          <div className="flex items-center gap-2 text-[11px] text-slate-700">
                            <span className="inline-block h-2.5 w-2.5 rounded-full bg-[hsl(var(--brand-warm-end))]" />
                            <span className="truncate">{t("brand.dashboard_card_likes", "Likes")}</span>
                            <span className="ml-auto tabular-nums text-muted-foreground">{likes.toLocaleString()}</span>
                          </div>
                        </div>
                      </div>

                      <div className="shrink-0">
                        <div className="relative h-20 w-20">
                          <svg viewBox="0 0 48 48" className="h-full w-full">
                            <circle cx="24" cy="24" r={r} fill="none" stroke="rgba(255,255,255,0.75)" strokeWidth="6" />
                            <g transform="rotate(-90 24 24)">
                              <circle
                                cx="24"
                                cy="24"
                                r={r}
                                fill="none"
                                stroke={`hsl(var(--brand-cool-start))`}
                                strokeWidth="6"
                                strokeLinecap="round"
                                strokeDasharray={`${vLen} ${c - vLen}`}
                                strokeDashoffset={-o1}
                              />
                              <circle
                                cx="24"
                                cy="24"
                                r={r}
                                fill="none"
                                stroke={`hsl(var(--brand-cool-end))`}
                                strokeWidth="6"
                                strokeLinecap="round"
                                strokeDasharray={`${aLen} ${c - aLen}`}
                                strokeDashoffset={-o2}
                              />
                              <circle
                                cx="24"
                                cy="24"
                                r={r}
                                fill="none"
                                stroke={`hsl(var(--brand-warm-end))`}
                                strokeWidth="6"
                                strokeLinecap="round"
                                strokeDasharray={`${lLen} ${c - lLen}`}
                                strokeDashoffset={-o3}
                              />
                            </g>
                          </svg>
                          <div className="absolute inset-0 flex flex-col items-center justify-center">
                            <div className="text-sm font-semibold text-slate-900 tabular-nums">{total.toLocaleString()}</div>
                            <div className="text-[10px] text-muted-foreground">{t("brand.dashboard_total", "Total")}</div>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </CardContent>
            </Card>
          </div>

          {/* Performance Chart */}
          <Card className="bg-white/70 backdrop-blur border border-white/40 shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-[hsl(var(--brand-cool-start))]" />
                {t("brand.dashboard_weekly_performance", "Weekly Performance")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="relative overflow-hidden rounded-2xl bg-white/90 border border-white/70 shadow-[0_18px_45px_rgba(148,163,184,0.35)] px-4 py-4 sm:px-6 sm:py-5">
                <div className="absolute inset-px rounded-[18px] bg-gradient-to-r from-[hsl(var(--brand-cool-start))]/6 via-[hsl(var(--brand-cool-end))]/8 to-[hsl(var(--brand-warm-end))]/6" aria-hidden="true" />
                <div className="relative space-y-4 text-slate-900">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 sm:gap-3">
                    <div className="flex items-center gap-2">
                      <div className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-[hsl(var(--brand-cool-start))] to-[hsl(var(--brand-cool-end))] text-white shadow-[0_10px_25px_rgba(148,163,184,0.55)]">
                        <BarChart3 className="h-4 w-4" />
                      </div>
                      <div className="flex flex-col">
                        <span className="text-xs font-semibold tracking-wide text-slate-900">
                          {t("brand.dashboard_weekly_performance", "Weekly Performance")}
                        </span>
                        <span className="text-[11px] text-slate-500">
                          {t("brand.dashboard_card_views_sub", "Last 30 days")}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-[10px]">
                      <span className="inline-flex items-center gap-1 rounded-full border border-emerald-300/70 bg-emerald-50 px-2 py-0.5 font-medium text-emerald-700">
                        <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        {t("brand.dashboard_live_label", "Live")}
                      </span>
                      <span className="hidden sm:inline text-slate-500 font-bold">
                        {t("brand.dashboard_last_window", "Brand activity snapshot")}
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2 sm:gap-3 text-xs">
                    <div className="rounded-xl bg-white/80 border border-slate-200 px-2 sm:px-3 py-2 flex flex-col gap-1">
                      <div className="flex items-center gap-1 sm:gap-1.5 text-[hsl(var(--brand-cool-start))]">
                        <Eye className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                        <span className="text-[9px] sm:text-[10px] uppercase tracking-wide text-slate-500 truncate">
                          {t("brand.dashboard_card_views", "Views")}
                        </span>
                      </div>
                      <span className="text-base sm:text-xl font-semibold leading-tight text-slate-900">
                        {stats.totalViews.toLocaleString()}
                      </span>
                    </div>
                    <div className="rounded-xl bg-white/80 border border-slate-200 px-2 sm:px-3 py-2 flex flex-col gap-1">
                      <div className="flex items-center gap-1 sm:gap-1.5 text-emerald-600">
                        <CirclePlus className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                        <span className="text-[9px] sm:text-[10px] uppercase tracking-wide text-slate-500 truncate">
                          {t("brand.dashboard_card_wishlist_adds", "Adds")}
                        </span>
                      </div>
                      <span className="text-base sm:text-xl font-semibold leading-tight text-slate-900">
                        {stats.wishlistAdds.toLocaleString()}
                      </span>
                    </div>
                    <div className="rounded-xl bg-white/80 border border-slate-200 px-2 sm:px-3 py-2 flex flex-col gap-1">
                      <div className="flex items-center gap-1 sm:gap-1.5 text-rose-600">
                        <Heart className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                        <span className="text-[9px] sm:text-[10px] uppercase tracking-wide text-slate-500 truncate">
                          {t("brand.dashboard_card_likes", "Likes")}
                        </span>
                      </div>
                      <span className="text-base sm:text-xl font-semibold leading-tight text-slate-900">
                        {stats.totalLikes.toLocaleString()}
                      </span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-[11px] text-slate-600">
                      <span>{t("brand.dashboard_performance_mini_chart_label", "Engagement mix")}</span>
                    </div>
                    <div className="flex items-end gap-2 sm:gap-4 h-14">
                      {[{
                        key: "views",
                        label: t("brand.dashboard_card_views", "Views"),
                        value: stats.totalViews,
                      }, {
                        key: "adds",
                        label: t("brand.dashboard_card_wishlist_adds", "Adds"),
                        value: stats.wishlistAdds,
                      }, {
                        key: "likes",
                        label: t("brand.dashboard_card_likes", "Likes"),
                        value: stats.totalLikes,
                      }].map((metric) => {
                        const max = Math.max(
                          stats.totalViews || 0,
                          stats.wishlistAdds || 0,
                          stats.totalLikes || 0,
                        ) || 1;
                        const height = Math.round(((metric.value || 0) / max) * 100);
                        return (
                          <div key={metric.key} className="flex-1 flex flex-col items-center gap-1">
                            <div className="flex-1 w-full rounded-full bg-slate-100 flex items-end justify-center px-3 py-1 overflow-hidden shadow-[0_6px_18px_rgba(148,163,184,0.55)]">
                              <div
                                className="w-full max-w-[18px] rounded-full bg-gradient-to-t from-[hsl(var(--brand-warm-end))] via-[hsl(var(--brand-cool-end))] to-[hsl(var(--brand-cool-start))]"
                                style={{ height: `${height}%` }}
                              />
                            </div>
                            <span className="text-[10px] text-slate-600">
                              {metric.label}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* PRODUCTS TAB */}
        <TabsContent value="products" className="space-y-6">
          <Card className="bg-white/70 backdrop-blur border border-white/40 shadow-lg">
            <CardHeader className="flex flex-row items-center justify-between gap-3">
              <div>
                <CardTitle>{t("brand.dashboard_top_products_title", "Top Performing Products")}</CardTitle>
                <p className="mt-1 text-xs text-muted-foreground">
                  {t("brand.dashboard_top_products_subtitle", "Quick controls for your best products – tap a row to manage it.")}
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="hidden sm:inline-flex text-xs"
                onClick={() => navigate("/brand/products")}
              >
                <Settings2 className="h-3.5 w-3.5 mr-1" />
                {t("brand.dashboard_manage_products", "Manage all products")}
              </Button>
            </CardHeader>
            <CardContent>
              {topProducts.length > 0 ? (
                <div className="space-y-3">
                  {topProducts.map((product: any, index: number) => (
                    <div
                      key={product.id}
                      className="flex items-center gap-4 p-4 rounded-xl bg-gradient-to-r from-white/50 to-white/30 border border-[hsl(var(--brand-cool-start))]/40 shadow-sm hover:border-[hsl(var(--brand-cool-start))]/70 transition-all duration-300 cursor-pointer"
                      onClick={() => navigate(`/brand/products?productId=${product.id}`)}
                    >
                      {product.image_url ? (
                        <img src={product.image_url} alt={product.name} className="w-12 h-12 rounded-lg object-cover" />
                      ) : (
                        <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-[hsl(var(--brand-cool-start))]/20 to-[hsl(var(--brand-warm-end))]/20 flex items-center justify-center">
                          <Package className="h-6 w-6 text-[hsl(var(--brand-cool-start))]" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-foreground mb-0.5 truncate">{product.name}</div>
                        <div className="flex flex-wrap gap-2 text-[11px] sm:text-xs">
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-[rgba(59,130,246,0.06)] text-[hsl(var(--brand-cool-start))] px-2 py-0.5 border border-[rgba(59,130,246,0.18)]">
                            <Eye className="h-3 w-3" />
                            {product.views.toLocaleString()}
                          </span>
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-[rgba(16,185,129,0.06)] text-emerald-600 px-2 py-0.5 border border-[rgba(16,185,129,0.18)]">
                            <CirclePlus className="h-3 w-3" />
                            {product.adds}
                          </span>
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-[rgba(244,63,94,0.06)] text-rose-600 px-2 py-0.5 border border-[rgba(244,63,94,0.18)]">
                            <Heart className="h-3 w-3" />
                            {product.likes}
                          </span>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        <div className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-[hsl(var(--brand-cool-start))] to-[hsl(var(--brand-warm-end))]">#{index + 1}</div>
                        <button
                          type="button"
                          className="h-8 w-8 rounded-xl bg-gradient-to-br from-[hsl(var(--brand-cool-start))] to-[hsl(var(--brand-warm-end))] text-white shadow-md hover:shadow-lg hover:scale-105 transition-all duration-200 flex items-center justify-center"
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/brand/products?productId=${product.id}`);
                          }}
                          title={t("brand.dashboard_view_product", "View product")}
                        >
                          <ExternalLink className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  <Package className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
                  <p>{t("brand.dashboard_top_products_empty", "No product data yet")}</p>
                  <p className="text-sm mt-2">{t("brand.dashboard_top_products_empty_sub", "Add products and they'll appear here once users interact with them")}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ANALYTICS TAB */}
        <TabsContent value="analytics" className="space-y-6">
          <Card className="bg-white/70 backdrop-blur border border-white/40 shadow-lg">
            <CardHeader>
              <CardTitle>{t("brand.dashboard_analytics_title", "Detailed Analytics")}</CardTitle>
            </CardHeader>
            <CardContent>
              {allProducts && allProducts.length > 0 ? (
                <>
                  {/* Mobile: stacked cards, no horizontal scroll */}
                  <div className="space-y-3 md:hidden">
                    {allProducts
                      .slice()
                      .sort((a: any, b: any) => (b.views || 0) - (a.views || 0))
                      .map((p: any) => (
                        <div
                          key={p.id}
                          className="rounded-2xl bg-white/90 border border-slate-200 shadow-sm px-3 py-2.5 flex items-center gap-3"
                        >
                          {p.image_url ? (
                            <img
                              src={p.image_url}
                              alt={p.name || "product"}
                              className="h-10 w-10 rounded-lg object-cover flex-shrink-0"
                              onError={(e: any) => {
                                e.currentTarget.style.display = "none";
                              }}
                            />
                          ) : (
                            <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-[hsl(var(--brand-cool-start))]/20 to-[hsl(var(--brand-warm-end))]/20 flex items-center justify-center text-[hsl(var(--brand-cool-start))] flex-shrink-0">
                              <Package className="h-5 w-5" />
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="text-xs font-medium text-slate-900 truncate">
                              {p.name || t("brand.dashboard_untitled_product", "Untitled product")}
                            </div>
                            <div className="mt-1 flex flex-wrap gap-1.5 text-[11px]">
                              <span className="inline-flex items-center gap-1 rounded-full bg-[rgba(59,130,246,0.06)] text-[hsl(var(--brand-cool-start))] px-1.5 py-0.5 border border-[rgba(59,130,246,0.18)]">
                                <Eye className="h-3 w-3" />
                                {p.views?.toLocaleString?.() || 0}
                              </span>
                              <span className="inline-flex items-center gap-1 rounded-full bg-[rgba(16,185,129,0.06)] text-emerald-600 px-1.5 py-0.5 border border-[rgba(16,185,129,0.18)]">
                                <CirclePlus className="h-3 w-3" />
                                {p.adds?.toLocaleString?.() || 0}
                              </span>
                              <span className="inline-flex items-center gap-1 rounded-full bg-[rgba(244,63,94,0.06)] text-rose-600 px-1.5 py-0.5 border border-[rgba(244,63,94,0.18)]">
                                <Heart className="h-3 w-3" />
                                {p.likes?.toLocaleString?.() || 0}
                              </span>
                            </div>
                          </div>
                        </div>
                      ))}
                  </div>

                  {/* Desktop / tablet: keep table layout */}
                  <div className="hidden md:block w-full overflow-x-auto">
                    <table className="w-full text-sm rounded-2xl overflow-hidden border border-white/60 bg-white/90 shadow-[0_18px_40px_rgba(148,163,184,0.35)]">
                      <thead className="bg-gradient-to-r from-[hsl(var(--brand-cool-start))]/10 via-[hsl(var(--brand-cool-end))]/8 to-[hsl(var(--brand-warm-end))]/10">
                        <tr className="text-xs text-slate-600 uppercase tracking-wide">
                          <th className="py-3 pr-3 text-left font-semibold">{t("brand.dashboard_analytics_col_product", "Product")}</th>
                          <th className="py-3 px-3 text-right font-semibold whitespace-nowrap">{t("brand.dashboard_analytics_col_views", "Views")}</th>
                          <th className="py-3 px-3 text-right font-semibold whitespace-nowrap">{t("brand.dashboard_analytics_col_wishlist_adds", "Wishlist adds")}</th>
                          <th className="py-3 pl-3 text-right font-semibold whitespace-nowrap">{t("brand.dashboard_analytics_col_likes", "Likes")}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100/80">
                        {allProducts
                          .slice()
                          .sort((a: any, b: any) => (b.views || 0) - (a.views || 0))
                          .map((p: any, index: number) => (
                            <tr
                              key={p.id}
                              className={`transition-colors ${
                                index % 2 === 0 ? "bg-slate-50/60" : "bg-white/80"
                              } hover:bg-[rgba(191,219,254,0.25)]`}
                            >
                              <td className="py-3 pr-3 align-top">
                                <div className="flex items-center gap-2 min-w-0">
                                  {p.image_url ? (
                                    <img
                                      src={p.image_url}
                                      alt={p.name || "product"}
                                      className="h-8 w-8 rounded-md object-cover flex-shrink-0"
                                      onError={(e: any) => {
                                        e.currentTarget.style.display = "none";
                                      }}
                                    />
                                  ) : (
                                    <div className="h-8 w-8 rounded-md bg-gradient-to-br from-[hsl(var(--brand-cool-start))]/20 to-[hsl(var(--brand-warm-end))]/20 flex items-center justify-center text-[10px] text-[hsl(var(--brand-cool-start))] flex-shrink-0">
                                      <Package className="h-4 w-4" />
                                    </div>
                                  )}
                                  <div className="min-w-0">
                                    <div className="font-medium text-slate-900 truncate">
                                      {p.name || t("brand.dashboard_untitled_product", "Untitled product")}
                                    </div>
                                  </div>
                                </div>
                              </td>
                              <td className="py-3 px-3 text-right align-top whitespace-nowrap">
                                <span className="inline-flex items-center gap-1.5 rounded-full bg-[rgba(59,130,246,0.06)] text-[hsl(var(--brand-cool-start))] px-2 py-0.5 border border-[rgba(59,130,246,0.18)] text-xs sm:text-[13px]">
                                  <Eye className="h-3 w-3" />
                                  {p.views?.toLocaleString?.() || 0}
                                </span>
                              </td>
                              <td className="py-3 px-3 text-right align-top whitespace-nowrap">
                                <span className="inline-flex items-center gap-1.5 rounded-full bg-[rgba(16,185,129,0.06)] text-emerald-600 px-2 py-0.5 border border-[rgba(16,185,129,0.18)] text-xs sm:text-[13px]">
                                  <CirclePlus className="h-3 w-3" />
                                  {p.adds?.toLocaleString?.() || 0}
                                </span>
                              </td>
                              <td className="py-3 pl-3 text-right align-top whitespace-nowrap">
                                <span className="inline-flex items-center gap-1.5 rounded-full bg-[rgba(244,63,94,0.06)] text-rose-600 px-2 py-0.5 border border-[rgba(244,63,94,0.18)] text-xs sm:text-[13px]">
                                  <Heart className="h-3 w-3" />
                                  {p.likes?.toLocaleString?.() || 0}
                                </span>
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                </>
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  <BarChart3 className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
                  <p>{t("brand.dashboard_analytics_empty", "No analytics data yet")}</p>
                  <p className="text-sm mt-2">{t("brand.dashboard_analytics_empty_sub", "Once users view, add, and like your products, you'll see per-product metrics here.")}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ACTIVITY TAB */}
        <TabsContent value="activity" className="space-y-6">
          <Card className="bg-white/70 backdrop-blur border border-white/40 shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5 text-[hsl(var(--brand-cool-start))]" />
                {t("brand.dashboard_activity_title", "Recent Activity")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {recentActivity.length > 0 ? (
                <div className="space-y-3">
                  {recentActivity.map((activity: any, index: number) => (
                    <div 
                      key={index}
                      className="flex items-start gap-3 p-3 rounded-xl bg-gradient-to-r from-white/85 to-white/70 border border-[hsl(var(--brand-cool-start))]/40 shadow-[0_10px_30px_rgba(15,23,42,0.12)] hover:-translate-y-0.5 hover:shadow-[0_18px_40px_rgba(15,23,42,0.18)] transition-all duration-300"
                    >
                      <button
                        type="button"
                        className="w-10 h-10 rounded-full bg-gradient-to-br from-[hsl(var(--brand-cool-start))] to-[hsl(var(--brand-warm-end))] flex items-center justify-center text-white font-semibold text-sm overflow-hidden focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-[hsl(var(--brand-cool-start))] cursor-pointer"
                        title={activity.user}
                        onClick={() => {
                          const engagement = userEngagement.find((u: any) => u.id === activity.userId) || null;
                          setSelectedUser(
                            engagement || {
                              id: activity.userId,
                              name: activity.user,
                              username: activity.username,
                              avatar_url: activity.avatar_url,
                              likedProducts: [],
                              viewedProducts: [],
                            },
                          );
                        }}
                      >
                        {activity.avatar_url ? (
                          <img
                            src={activity.avatar_url}
                            alt={activity.user}
                            className="h-full w-full object-cover"
                            onError={(e: any) => {
                              e.currentTarget.style.display = "none";
                            }}
                          />
                        ) : (
                          activity.user.charAt(0).toUpperCase()
                        )}
                      </button>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm text-foreground">
                          <span className="font-semibold">{activity.user}</span>
                          {' '}
                          <span className="text-muted-foreground">
                            {(() => {
                              const parts: string[] = [];
                              if (activity.likedNames?.length > 0) {
                                const preview = activity.likedNames.slice(0, 2).join(", ");
                                parts.push(
                                  activity.likedNames.length > 2
                                    ? t("brand.activity_liked_others", "liked {{products}} and others", { products: preview })
                                    : t("brand.activity_liked", "liked {{products}}", { products: preview })
                                );
                              }
                              if (activity.viewedNames?.length > 0) {
                                const preview = activity.viewedNames.slice(0, 2).join(", ");
                                parts.push(
                                  activity.viewedNames.length > 2
                                    ? t("brand.activity_viewed_others", "viewed {{products}} and others", { products: preview })
                                    : t("brand.activity_viewed", "viewed {{products}}", { products: preview })
                                );
                              }
                              return parts.join(" · ");
                            })()}
                          </span>
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">{t("brand.activity_time_recently", "Recently")}</div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  <Activity className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
                  <p>{t("brand.dashboard_activity_empty", "No activity yet")}</p>
                  <p className="text-sm mt-2">{t("brand.dashboard_activity_empty_sub", "Activity will appear when users add your products to wishlists")}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* QUESTIONS TAB */}
        <TabsContent value="questions" className="space-y-6">
          <Card className="bg-white/70 backdrop-blur border border-white/40 shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageCircle className="h-5 w-5 text-[hsl(var(--brand-cool-start))]" />
                {t("brand.dashboard_questions_title", "Customer Questions")}
                {unansweredCount > 0 && (
                  <span className="ml-2 px-2 py-0.5 rounded-full bg-rose-500 text-xs font-bold text-white">
                    {unansweredCount} {t("brand.dashboard_questions_new", "new")}
                  </span>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {questionsLoading ? (
                <div className="text-center py-8 text-muted-foreground">
                  {t("brand.dashboard_questions_loading", "Loading questions...")}
                </div>
              ) : !brandQuestions || brandQuestions.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <MessageCircle className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
                  <p>{t("brand.dashboard_questions_empty", "No questions yet")}</p>
                  <p className="text-sm mt-2">{t("brand.dashboard_questions_empty_sub", "Questions from users will appear here")}</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {brandQuestions.map((q: any) => (
                    <div
                      key={q.id}
                      className="rounded-xl bg-gradient-to-r from-white/85 to-white/70 border border-[hsl(var(--brand-cool-start))]/40 shadow-[0_10px_30px_rgba(15,23,42,0.12)] p-4 space-y-3"
                    >
                      {/* Product info */}
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        {q.brand_products?.image_url && (
                          <img
                            src={q.brand_products.image_url}
                            alt={q.brand_products.name}
                            className="h-8 w-8 rounded-lg object-cover"
                          />
                        )}
                        <span className="font-medium text-foreground">
                          {q.brand_products?.name || "Unknown product"}
                        </span>
                      </div>

                      {/* Question */}
                      <div className="flex items-start gap-3">
                        <button
                          type="button"
                          className="w-8 h-8 rounded-full bg-gradient-to-br from-[hsl(var(--brand-cool-start))] to-[hsl(var(--brand-warm-end))] flex items-center justify-center text-white font-semibold text-xs overflow-hidden cursor-pointer hover:ring-2 hover:ring-offset-1 hover:ring-[hsl(var(--brand-cool-start))] transition-all"
                          onClick={() => {
                            if (!q.user_profiles) return;
                            const engagement = userEngagement.find((u: any) => u.id === q.user_profiles.id);
                            setSelectedUser(engagement || {
                              id: q.user_profiles.id,
                              name: q.user_profiles.full_name || q.user_profiles.username || "User",
                              username: q.user_profiles.username,
                              avatar_url: q.user_profiles.avatar_url,
                              likedProducts: [],
                              viewedProducts: [],
                            });
                          }}
                        >
                          {q.user_profiles?.avatar_url ? (
                            <img
                              src={q.user_profiles.avatar_url}
                              alt={q.user_profiles.full_name || q.user_profiles.username}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            (q.user_profiles?.full_name || q.user_profiles?.username || "U").charAt(0).toUpperCase()
                          )}
                        </button>
                        <div className="flex-1">
                          <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground mb-1">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-foreground">
                                {q.user_profiles?.full_name || q.user_profiles?.username || "User"}
                              </span>
                              <span>·</span>
                              <span>{getTimeAgo(q.created_at)}</span>
                              {q.status === "unanswered" ? (
                                <span className="inline-flex items-center gap-0.5 text-amber-600">
                                  <Clock className="h-3 w-3" />
                                  {t("brand.question_awaiting", "Awaiting reply")}
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-0.5 text-green-600">
                                  <CheckCircle2 className="h-3 w-3" />
                                  {t("brand.question_answered", "Answered")}
                                </span>
                              )}
                            </div>
                            <button
                              type="button"
                              className="inline-flex items-center gap-1 rounded-full border border-rose-100 bg-rose-50/70 px-2 py-0.5 text-[11px] font-medium text-rose-600 shadow-sm hover:bg-rose-100 hover:border-rose-200 transition-colors disabled:opacity-60 disabled:cursor-default"
                              onClick={() => deleteQuestionMutation.mutate(q.id)}
                              disabled={deleteQuestionMutation.isPending}
                            >
                              <Trash2 className="h-3 w-3" />
                              {deleteQuestionMutation.isPending
                                ? t("brand.question_deleting", "Deleting...")
                                : t("brand.question_delete", "Delete")}
                            </button>
                          </div>
                          <p className="text-sm">{q.question}</p>
                        </div>
                      </div>

                      {/* Answer */}
                      {q.answer && (
                        <div className="ml-11 pl-3 border-l-2 border-[hsl(var(--brand-cool-start))]/40">
                          <div className="text-xs text-muted-foreground mb-1">
                            <span className="font-medium text-foreground">{t("brand.question_your_reply", "Your reply")}</span>
                            {q.answered_at && (
                              <>
                                <span className="mx-1">·</span>
                                <span>{getTimeAgo(q.answered_at)}</span>
                              </>
                            )}
                          </div>
                          <p className="text-sm text-slate-700">{q.answer}</p>
                        </div>
                      )}

                      {/* Reply box */}
                      {q.status === "unanswered" && (
                        <>
                          {replyingTo === q.id ? (
                            <div className="ml-11 space-y-2">
                              <Textarea
                                placeholder={t("brand.question_reply_placeholder", "Type your answer...")}
                                value={replyText}
                                onChange={(e) => setReplyText(e.target.value)}
                                rows={2}
                                className="text-sm resize-none"
                              />
                              <div className="flex gap-2 justify-end">
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => {
                                    setReplyingTo(null);
                                    setReplyText("");
                                  }}
                                >
                                  {t("common.cancel", "Cancel")}
                                </Button>
                                <Button
                                  size="sm"
                                  onClick={() => handleAnswer(q.id, q.user_id, q.brand_products?.name || "Product")}
                                  disabled={!replyText.trim() || answerMutation.isPending}
                                  className="gap-1.5"
                                >
                                  <Send className="h-3.5 w-3.5" />
                                  {answerMutation.isPending ? t("brand.question_posting", "Posting...") : t("brand.question_post_answer", "Post answer")}
                                </Button>
                              </div>
                            </div>
                          ) : (
                            <div className="ml-11">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setReplyingTo(q.id)}
                                className="text-xs"
                              >
                                {t("brand.question_reply", "Reply")}
                              </Button>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Overview detail modal (for Wishlist Adds / Active Products / Unique Users) */}
      {overviewDetail && (
        <Dialog
          open={!!overviewDetail}
          onOpenChange={(open) => {
            if (!open) setOverviewDetail(null);
          }}
        >
          <DialogContent className="max-w-sm sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-sm font-semibold">
                {overviewDetail === "views" && (
                  <>
                    <Eye className="h-4 w-4 text-[hsl(var(--brand-cool-start))]" />
                    <span>{t("brand.modal_views_title", "Product views – which products")}</span>
                  </>
                )}
                {overviewDetail === "likes" && (
                  <>
                    <Heart className="h-4 w-4 text-rose-500" />
                    <span>{t("brand.modal_likes_title", "Likes – which products")}</span>
                  </>
                )}
                {overviewDetail === "wishlist" && (
                  <>
                    <CirclePlus className="h-4 w-4 text-emerald-500" />
                    <span>{t("brand.modal_wishlist_title", "Wishlist adds – which products")}</span>
                  </>
                )}
                {overviewDetail === "active" && (
                  <>
                    <Package className="h-4 w-4 text-emerald-500" />
                    <span>{t("brand.modal_active_title", "Active products")}</span>
                  </>
                )}
                {overviewDetail === "users" && (
                  <>
                    <Users className="h-4 w-4 text-[hsl(var(--brand-warm-start))]" />
                    <span>{t("brand.modal_users_title", "Unique users – who they are")}</span>
                  </>
                )}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 text-sm max-h-80 overflow-y-auto">
              {overviewDetail === "views" && (
                <div>
                  {allProducts && allProducts.length > 0 ? (
                    <ul className="space-y-1">
                      {allProducts
                        .slice()
                        .sort((a: any, b: any) => (b.views || 0) - (a.views || 0))
                        .map((p: any) => (
                          <li
                            key={p.id}
                            className="flex items-center justify-between gap-2 text-xs"
                          >
                            <span className="truncate max-w-[180px]">{p.name || t("brand.dashboard_untitled_product", "Untitled product")}</span>
                            <span className="text-muted-foreground">
                              {p.views?.toLocaleString?.() || 0} {t("brand.metric_views", "views")}
                            </span>
                          </li>
                        ))}
                    </ul>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      {t("brand.no_view_data", "No view data yet.")}
                    </p>
                  )}
                </div>
              )}

              {overviewDetail === "likes" && (
                <div>
                  {allProducts && allProducts.length > 0 ? (
                    <ul className="space-y-1">
                      {allProducts
                        .slice()
                        .sort((a: any, b: any) => (b.likes || 0) - (a.likes || 0))
                        .map((p: any) => (
                          <li
                            key={p.id}
                            className="flex items-center justify-between gap-2 text-xs"
                          >
                            <span className="truncate max-w-[180px]">{p.name || t("brand.dashboard_untitled_product", "Untitled product")}</span>
                            <span className="text-muted-foreground">
                              {p.likes?.toLocaleString?.() || 0} {t("brand.metric_likes", "likes")}
                            </span>
                          </li>
                        ))}
                    </ul>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      {t("brand.no_like_data", "No like data yet.")}
                    </p>
                  )}
                </div>
              )}

              {overviewDetail === "wishlist" && (
                <div>
                  {allProducts && allProducts.length > 0 ? (
                    <ul className="space-y-1">
                      {allProducts
                        .slice()
                        .sort((a: any, b: any) => (b.adds || 0) - (a.adds || 0))
                        .map((p: any) => (
                          <li
                            key={p.id}
                            className="flex items-center justify-between gap-2 text-xs"
                          >
                            <span className="truncate max-w-[180px]">{p.name || t("brand.dashboard_untitled_product", "Untitled product")}</span>
                            <span className="text-muted-foreground">
                              {p.adds?.toLocaleString?.() || 0} {t("brand.metric_adds", "adds")}
                            </span>
                          </li>
                        ))}
                    </ul>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      {t("brand.no_wishlist_data", "No wishlist data yet.")}
                    </p>
                  )}
                </div>
              )}

              {overviewDetail === "active" && (
                <div>
                  {allProducts && allProducts.length > 0 ? (
                    <ul className="space-y-1">
                      {allProducts.map((p: any) => (
                        <li
                          key={p.id}
                          className="flex items-center justify-between gap-2 text-xs"
                        >
                          <span className="truncate max-w-[180px]">{p.name || t("brand.dashboard_untitled_product", "Untitled product")}</span>
                          <span className="text-muted-foreground flex gap-2">
                            <span>{p.views?.toLocaleString?.() || 0} {t("brand.metric_views", "views")}</span>
                            <span>{p.adds?.toLocaleString?.() || 0} {t("brand.metric_adds", "adds")}</span>
                            <span>{p.likes?.toLocaleString?.() || 0} {t("brand.metric_likes", "likes")}</span>
                          </span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      {t("brand.no_active_products", "No active products yet.")}
                    </p>
                  )}
                </div>
              )}

              {overviewDetail === "users" && (
                <div>
                  {userEngagement && userEngagement.length > 0 ? (
                    <ul className="space-y-2">
                      {userEngagement.map((u: any) => (
                        <li key={u.id} className="text-xs">
                          <div className="font-semibold truncate max-w-[220px]">
                            {u.name}
                          </div>
                          <div className="text-muted-foreground mt-0.5">
                            {(u.likedProducts?.length || 0) > 0 && (
                              <span>
                                {t("brand.user_liked_count", "Liked {{count}} product(s)", { count: u.likedProducts.length })}
                              </span>
                            )}
                            {(u.likedProducts?.length || 0) > 0 &&
                              (u.viewedProducts?.length || 0) > 0 && <span> · </span>}
                            {(u.viewedProducts?.length || 0) > 0 && (
                              <span>
                                {t("brand.user_viewed_count", "Viewed {{count}} product(s)", { count: u.viewedProducts.length })}
                              </span>
                            )}
                            {(u.likedProducts?.length || 0) === 0 &&
                              (u.viewedProducts?.length || 0) === 0 && (
                                <span>{t("brand.no_engagement", "No engagement recorded.")}</span>
                              )}
                          </div>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      {t("brand.no_user_data", "No unique user data yet.")}
                    </p>
                  )}
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* User engagement card modal (opened from Likes avatars) */}
      {selectedUser && (
        <Dialog
          open={!!selectedUser}
          onOpenChange={(open) => {
            if (!open) setSelectedUser(null);
          }}
        >
          <DialogContent className="max-w-xs sm:max-w-sm border-0 bg-transparent shadow-none p-0">
            <div className="flex items-center justify-between gap-3 rounded-2xl bg-white/90 backdrop-blur ring-1 ring-white/70 shadow-[0_18px_40px_rgba(0,0,0,0.1)] p-4">
              <div className="flex items-center gap-3 min-w-0">
                {selectedUser.avatar_url ? (
                  <span className="relative flex shrink-0 overflow-hidden rounded-full h-11 w-11 ring-2 ring-white/80">
                    <img
                      src={selectedUser.avatar_url}
                      alt={selectedUser.name || "avatar"}
                      className="h-full w-full object-cover"
                      onError={(e: any) => {
                        e.currentTarget.style.display = "none";
                      }}
                    />
                  </span>
                ) : (
                  <div className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-[hsl(var(--brand-cool-start))] via-[hsl(var(--brand-cool-end))] to-[hsl(var(--brand-warm-end))] text-white ring-1 ring-white/60 shadow-[0_6px_14px_rgba(200,80,192,0.28)]">
                    <Users className="h-5 w-5" />
                  </div>
                )}
                <div className="min-w-0">
                  <div className="font-semibold truncate text-base">{selectedUser.name || "User"}</div>
                  {selectedUser.username && (
                    <div className="text-sm text-muted-foreground">@{selectedUser.username}</div>
                  )}
                </div>
              </div>
              <button
                type="button"
                className="explore-follow-btn shrink-0"
                onClick={async () => {
                  try {
                    await brandFollowUser(selectedUser.id);
                  } catch (err) {
                    console.warn("Follow failed", err);
                  }
                }}
              >
                <span className="explore-follow-btn-fold" aria-hidden="true" />
                <span className="explore-follow-btn-points" aria-hidden="true">
                  {Array.from({ length: 10 }).map((_, i) => (
                    <span key={i} className="explore-follow-btn-point" />
                  ))}
                </span>
                <span className="explore-follow-btn-inner">
                  {t("explore.following", "Following")}
                </span>
              </button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
};

export default BrandDashboard;
