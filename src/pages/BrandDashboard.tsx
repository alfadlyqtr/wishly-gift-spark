import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Eye, CirclePlus, Heart, Users, BarChart3, Activity, Package } from "lucide-react";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const BrandDashboard = () => {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState("overview");

  // Fetch comprehensive brand analytics with real-time updates
  const { data: brandData } = useQuery({
    queryKey: ["brand-dashboard"],
    refetchInterval: 5000, // Refetch every 5 seconds for real-time updates
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      const { data: brand } = await (supabase as any)
        .from("brands")
        .select("id, brand_name")
        .eq("user_id", user.id)
        .maybeSingle();

      if (!brand) return null;

      // Get all brand products
      const { data: products } = await (supabase as any)
        .from("brand_products")
        .select("id, name, image_url, product_url")
        .eq("brand_id", brand.id);

      console.log("🏢 Brand ID:", brand.id);
      console.log("📦 Your Products:", products);

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

      console.log("📊 Analytics rows:", analytics);

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

      // Unique wishlists that contain any of this brand's products
      const wishlistIdSet = new Set<string>();
      for (const row of analyticsRows) {
        (row.wishlist_ids || []).forEach((id) => {
          if (id) wishlistIdSet.add(id);
        });
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

      const topProducts = (products || [])
        .map((p: any) => ({
          id: p.id,
          name: p.name,
          image_url: p.image_url,
          views: viewsByProduct[p.id] || 0,
          adds: addsByProduct[p.id] || 0,
          likes: likesByProduct[p.id] || 0,
        }))
        .sort((a: any, b: any) => b.adds - a.adds)
        .slice(0, 5);

      // Recent activity feed will be added later via a dedicated function.
      const recentActivity: any[] = [];

      return {
        brandId: brand.id,
        brandName: (brand as any).brand_name || null,
        productCount: products?.length || 0,
        totalViews,
        wishlistAdds,
        uniqueUsers: wishlistIdSet.size,
        topProducts,
        recentActivity,
      };
    },
  });

  const brandName = (brandData as any)?.brandName || "";

  const stats = {
    totalViews: brandData?.totalViews || 0,
    wishlistAdds: brandData?.wishlistAdds || 0,
    activeProducts: brandData?.productCount || 0,
    uniqueUsers: brandData?.uniqueUsers || 0,
  };

  const topProducts = brandData?.topProducts || [];
  const recentActivity = brandData?.recentActivity || [];

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
    <div className="min-h-screen bg-gradient-to-br from-[hsl(var(--brand-cool-start))] via-background to-[hsl(var(--brand-warm-start))] p-4 md:p-6">
      {/* Header */}
      <div className="mb-6">
        <h1
          className="text-3xl sm:text-4xl font-extrabold bg-gradient-to-r from-[hsl(var(--brand-cool-start))] via-[hsl(var(--brand-cool-end))] to-[hsl(var(--brand-warm-end))] bg-clip-text text-transparent drop-shadow-[0_1px_1px_rgba(0,0,0,0.6)] mb-1"
          style={{ WebkitTextStroke: "0.5px rgba(0, 0, 0, 0.85)" }}
        >
          {t("brand.dashboard_title", "Brand Dashboard")}
        </h1>
        <p
          className="text-[11px] sm:text-sm font-extrabold bg-gradient-to-r from-[hsl(var(--brand-cool-start))] via-[hsl(var(--brand-cool-end))] to-[hsl(var(--brand-warm-end))] bg-clip-text text-transparent drop-shadow-[0_1px_1px_rgba(0,0,0,0.6)]"
          style={{ WebkitTextStroke: "0.5px rgba(0, 0, 0, 0.85)" }}
        >
          {brandName
            ? t("brand.dashboard_welcome", "Welcome {{name}}", { name: brandName })
            : t("brand.dashboard_subtitle", "Track your product visibility and wishlist performance")}
        </p>
      </div>

      {/* Tabs for Mobile-First Design */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-4 bg-white/70 backdrop-blur border border-white/40 p-1 rounded-full">
          <TabsTrigger value="overview" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-[hsl(var(--brand-cool-start))] data-[state=active]:to-[hsl(var(--brand-warm-end))] data-[state=active]:text-white rounded-full">
            <BarChart3 className="h-4 w-4 mr-2" />
            <span className="hidden sm:inline">Overview</span>
          </TabsTrigger>
          <TabsTrigger value="products" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-[hsl(var(--brand-cool-start))] data-[state=active]:to-[hsl(var(--brand-warm-end))] data-[state=active]:text-white rounded-full">
            <Package className="h-4 w-4 mr-2" />
            <span className="hidden sm:inline">Products</span>
          </TabsTrigger>
          <TabsTrigger value="analytics" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-[hsl(var(--brand-cool-start))] data-[state=active]:to-[hsl(var(--brand-warm-end))] data-[state=active]:text-white rounded-full">
            <BarChart3 className="h-4 w-4 mr-2" />
            <span className="hidden sm:inline">Analytics</span>
          </TabsTrigger>
          <TabsTrigger value="activity" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-[hsl(var(--brand-cool-start))] data-[state=active]:to-[hsl(var(--brand-warm-end))] data-[state=active]:text-white rounded-full">
            <Activity className="h-4 w-4 mr-2" />
            <span className="hidden sm:inline">Activity</span>
          </TabsTrigger>
        </TabsList>

        {/* OVERVIEW TAB */}
        <TabsContent value="overview" className="space-y-6">
          {/* Hero Stats Grid */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Total Views Card */}
            <Card className="bg-white/70 backdrop-blur border border-white/40 shadow-lg hover:shadow-xl transition-all duration-300">
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="p-3 rounded-xl bg-gradient-to-br from-[hsl(var(--brand-cool-start))]/20 to-[hsl(var(--brand-cool-end))]/20">
                    <Eye className="h-6 w-6 text-[hsl(var(--brand-cool-start))]" />
                  </div>
                </div>
                <div className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-[hsl(var(--brand-cool-start))] to-[hsl(var(--brand-cool-end))] mb-1">
                  {stats.totalViews.toLocaleString()}
                </div>
                <div className="text-sm text-muted-foreground">Product Views</div>
                <div className="text-xs text-muted-foreground mt-2">Last 30 days</div>
              </CardContent>
            </Card>

            {/* Wishlist Adds Card */}
            <Card className="bg-white/70 backdrop-blur border border-white/40 shadow-lg hover:shadow-xl transition-all duration-300">
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="p-3 rounded-xl bg-gradient-to-br from-emerald-500/20 to-teal-500/20">
                    <CirclePlus className="h-6 w-6 text-emerald-500" />
                  </div>
                </div>
                <div className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-pink-500 to-rose-500 mb-1">
                  {stats.wishlistAdds.toLocaleString()}
                </div>
                <div className="text-sm text-muted-foreground">Wishlist Adds</div>
                <div className="text-xs text-muted-foreground mt-2">All time</div>
              </CardContent>
            </Card>

            {/* Active Products Card */}
            <Card className="bg-white/70 backdrop-blur border border-white/40 shadow-lg hover:shadow-xl transition-all duration-300">
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="p-3 rounded-xl bg-gradient-to-br from-emerald-500/20 to-teal-500/20">
                    <Package className="h-6 w-6 text-emerald-500" />
                  </div>
                </div>
                <div className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-emerald-500 to-teal-500 mb-1">
                  {stats.activeProducts}
                </div>
                <div className="text-sm text-muted-foreground">Active Products</div>
              </CardContent>
            </Card>

            {/* Unique Users Card */}
            <Card className="bg-gradient-to-br from-[hsl(var(--brand-cool-start))]/10 to-[hsl(var(--brand-warm-end))]/10 backdrop-blur border border-white/40 shadow-lg hover:shadow-xl transition-all duration-300">
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="p-3 rounded-xl bg-gradient-to-br from-[hsl(var(--brand-warm-start))]/20 to-[hsl(var(--brand-warm-end))]/20">
                    <Users className="h-6 w-6 text-[hsl(var(--brand-warm-start))]" />
                  </div>
                </div>
                <div className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-[hsl(var(--brand-warm-start))] to-[hsl(var(--brand-warm-end))] mb-1">
                  {stats.uniqueUsers.toLocaleString()}
                </div>
                <div className="text-sm text-muted-foreground">Unique Users</div>
                <div className="text-xs text-muted-foreground mt-2">With your products</div>
              </CardContent>
            </Card>
          </div>

          {/* Performance Chart */}
          <Card className="bg-white/70 backdrop-blur border border-white/40 shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-[hsl(var(--brand-cool-start))]" />
                Weekly Performance
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-64 flex items-center justify-center text-muted-foreground">
                <div className="text-center">
                  <BarChart3 className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
                  <p>Analytics tracking coming soon</p>
                  <p className="text-sm mt-2">We'll track views, adds, and engagement here</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* PRODUCTS TAB */}
        <TabsContent value="products" className="space-y-6">
          <Card className="bg-white/70 backdrop-blur border border-white/40 shadow-lg">
            <CardHeader>
              <CardTitle>Top Performing Products</CardTitle>
            </CardHeader>
            <CardContent>
              {topProducts.length > 0 ? (
                <div className="space-y-3">
                  {topProducts.map((product: any, index: number) => (
                    <div 
                      key={product.id}
                      className="flex items-center gap-4 p-4 rounded-xl bg-gradient-to-r from-white/50 to-white/30 border border-white/40 hover:border-[hsl(var(--brand-cool-start))]/50 transition-all duration-300"
                    >
                      {product.image_url ? (
                        <img src={product.image_url} alt={product.name} className="w-12 h-12 rounded-lg object-cover" />
                      ) : (
                        <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-[hsl(var(--brand-cool-start))]/20 to-[hsl(var(--brand-warm-end))]/20 flex items-center justify-center">
                          <Package className="h-6 w-6 text-[hsl(var(--brand-cool-start))]" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-foreground mb-1 truncate">{product.name}</div>
                        <div className="flex gap-4 text-sm text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Eye className="h-3 w-3" />
                            {product.views.toLocaleString()}
                          </span>
                          <span className="flex items-center gap-1">
                            <CirclePlus className="h-3 w-3" />
                            {product.adds}
                          </span>
                          <span className="flex items-center gap-1">
                            <Heart className="h-3 w-3" />
                            {product.likes}
                          </span>
                        </div>
                      </div>
                      <div className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-[hsl(var(--brand-cool-start))] to-[hsl(var(--brand-warm-end))]">#{index + 1}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  <Package className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
                  <p>No product data yet</p>
                  <p className="text-sm mt-2">Add products and they'll appear here once users interact with them</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ANALYTICS TAB */}
        <TabsContent value="analytics" className="space-y-6">
          <Card className="bg-white/70 backdrop-blur border border-white/40 shadow-lg">
            <CardHeader>
              <CardTitle>Detailed Analytics</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center py-12 text-muted-foreground">
                <BarChart3 className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
                <p>Advanced analytics coming soon</p>
                <p className="text-sm mt-2">Geographic data, peak times, and engagement metrics</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ACTIVITY TAB */}
        <TabsContent value="activity" className="space-y-6">
          <Card className="bg-white/70 backdrop-blur border border-white/40 shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5 text-[hsl(var(--brand-cool-start))]" />
                Recent Activity
              </CardTitle>
            </CardHeader>
            <CardContent>
              {recentActivity.length > 0 ? (
                <div className="space-y-3">
                  {recentActivity.map((activity: any, index: number) => (
                    <div 
                      key={index}
                      className="flex items-start gap-3 p-3 rounded-lg bg-gradient-to-r from-white/50 to-white/30 border border-white/40 hover:border-[hsl(var(--brand-cool-start))]/30 transition-all"
                    >
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[hsl(var(--brand-cool-start))] to-[hsl(var(--brand-warm-end))] flex items-center justify-center text-white font-semibold text-sm">
                        {activity.user.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm text-foreground">
                          <span className="font-semibold">{activity.user}</span>
                          {' '}
                          <span className="text-muted-foreground">{activity.action}</span>
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">{activity.time}</div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  <Activity className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
                  <p>No activity yet</p>
                  <p className="text-sm mt-2">Activity will appear when users add your products to wishlists</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default BrandDashboard;
