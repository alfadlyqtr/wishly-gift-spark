import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import BackButton from "@/components/BackButton";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Store } from "lucide-react";
import { BrandProfileModal } from "@/components/BrandProfileModal";

interface BrandFollowing {
  id: string;
  brand_id: string;
  status: string;
  created_at: string;
  brand: {
    id: string;
    brand_name: string;
    tagline?: string;
    logo_url?: string;
  };
}

const BrandsFollowing = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [following, setFollowing] = useState<BrandFollowing[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedBrandId, setSelectedBrandId] = useState<string | null>(null);
  const [isBrandModalOpen, setIsBrandModalOpen] = useState(false);

  useEffect(() => {
    fetchFollowing();
  }, []);

  const fetchFollowing = async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await (supabase as any)
        .from("brand_followers")
        .select(`
          id,
          brand_id,
          status,
          created_at,
          brand:brands(
            id,
            brand_name,
            tagline,
            logo_url
          )
        `)
        .eq("follower_id", user.id)
        .eq("follower_type", "user")
        .eq("status", "accepted")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setFollowing(data || []);
    } catch (err: any) {
      console.error("Error fetching following:", err);
      toast.error(t("common.error", "Something went wrong"));
    } finally {
      setLoading(false);
    }
  };

  const handleUnfollow = async (followId: string) => {
    try {
      const { error } = await (supabase as any)
        .from("brand_followers")
        .delete()
        .eq("id", followId);

      if (error) throw error;
      
      setFollowing(prev => prev.filter(f => f.id !== followId));
      toast.success(t("brands.unfollowed", "Unfollowed brand"));
    } catch (err: any) {
      console.error("Error unfollowing:", err);
      toast.error(t("common.error", "Something went wrong"));
    }
  };

  const handleViewBrand = (brandId: string) => {
    setSelectedBrandId(brandId);
    setIsBrandModalOpen(true);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="container max-w-2xl mx-auto px-4 py-6 space-y-4">
      <div className="flex items-center gap-2">
        <BackButton onClick={() => navigate("/profile")}>{t("common.back", "Back")}</BackButton>
      </div>

      <div className="mx-auto mt-6 w-full max-w-[420px]">
        <div className="wl-card w-full">
          <div className="wl-card-surface p-5 text-white" style={{ alignItems: "flex-start", justifyContent: "flex-start" }}>
            <div className="w-full space-y-4">
              <div className="flex items-baseline justify-between">
                <h2 className="text-2xl font-extrabold wl-card-title">{t("brands.following", "Brands Following")}</h2>
                <p className="text-xs opacity-80">
                  {following.length} {t("brands.brands", "brands")}
                </p>
              </div>

              <Card className="bg-white/5 border-white/10 text-white max-h-[500px] overflow-y-auto">
                <div className="divide-y divide-white/10">
                  {following.length === 0 ? (
                    <div className="px-4 py-8 text-center text-sm opacity-80">
                      {t("brands.no_following", "You're not following any brands yet")}
                    </div>
                  ) : (
                    following.map((item) => {
                      const brand = item.brand;
                      return (
                        <div key={item.id} className="connections-row px-4 py-3 flex items-center gap-4">
                          <div 
                            className="cursor-pointer flex items-center gap-4 flex-1 min-w-0"
                            onClick={() => handleViewBrand(brand.id)}
                          >
                            {brand.logo_url ? (
                              <Avatar className="h-14 w-14">
                                <AvatarImage src={brand.logo_url} alt={brand.brand_name} />
                                <AvatarFallback>{brand.brand_name?.slice(0, 2).toUpperCase()}</AvatarFallback>
                              </Avatar>
                            ) : (
                              <div className="h-14 w-14 rounded-full bg-gradient-to-br from-[hsl(var(--brand-cool-start))] via-[hsl(var(--brand-cool-end))] to-[hsl(var(--brand-warm-end))] flex items-center justify-center">
                                <Store className="h-6 w-6 text-white" />
                              </div>
                            )}
                            <div className="flex-1 min-w-0">
                              <p className="connections-name text-base font-semibold truncate">{brand.brand_name}</p>
                              {brand.tagline && <p className="connections-identity text-[12px] opacity-70 truncate">{brand.tagline}</p>}
                            </div>
                          </div>
                          <div className="shrink-0 connections-action-btn-wrapper">
                            <button
                              type="button"
                              className="connections-action-btn connections-action-btn--secondary"
                              onClick={() => handleUnfollow(item.id)}
                            >
                              <span className="connections-fold" aria-hidden="true" />
                              <span className="connections-points" aria-hidden="true">
                                {Array.from({ length: 10 }).map((_, idx) => (
                                  <span key={idx} className="connections-point" />
                                ))}
                              </span>
                              <span className="connections-inner">{t("brands.unfollow", "Unfollow")}</span>
                            </button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </Card>
            </div>
          </div>
        </div>
      </div>

      {/* Brand Profile Modal */}
      {selectedBrandId && (
        <BrandProfileModal
          brandId={selectedBrandId}
          isOpen={isBrandModalOpen}
          onClose={() => {
            setIsBrandModalOpen(false);
            setSelectedBrandId(null);
          }}
        />
      )}
    </div>
  );
};

export default BrandsFollowing;
