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
  Ban, Power, Settings, Edit, Wifi, WifiOff, Bell, Gift
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
    
  // Admin Controls dialogs
  const [deleteAccountDialog, setDeleteAccountDialog] = useState(false);
  const [deleteProductDialog, setDeleteProductDialog] = useState<string | null>(null);
  const [confirmText, setConfirmText] = useState("");
  const [suspendDialog, setSuspendDialog] = useState(false);
  const [suspendMessage, setSuspendMessage] = useState("");
  const [suspendDuration, setSuspendDuration] = useState(24); // preset hours
  const [suspendCustomHours, setSuspendCustomHours] = useState("");

  // Activity details dialog
  const [selectedActivity, setSelectedActivity] = useState<any>(null);
  const [activityDetails, setActivityDetails] = useState<any>(null);
  const [activityDetailsLoading, setActivityDetailsLoading] = useState(false);

  // Wishlists management
  const [deleteWishlistDialog, setDeleteWishlistDialog] = useState<string | null>(null);
  const [deleteItemDialog, setDeleteItemDialog] = useState<string | null>(null);
  const [selectedWishlist, setSelectedWishlist] = useState<any>(null);
  const [wishlistItems, setWishlistItems] = useState<any[]>([]);
  const [commentsDialog, setCommentsDialog] = useState<{ type: 'wishlist' | 'item'; id: string; title: string } | null>(null);
  const [commentsData, setCommentsData] = useState<any[]>([]);
  const [likesDialog, setLikesDialog] = useState<{ type: 'wishlist' | 'item' | 'product'; id: string; title: string } | null>(null);
  const [likesData, setLikesData] = useState<any[]>([]);
  const [productStatsDialog, setProductStatsDialog] = useState<{ type: 'views' | 'questions' | 'adds'; productId: string; productName: string } | null>(null);
  const [productStatsData, setProductStatsData] = useState<any[]>([]);

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

  // Fetch activity details based on activity_type and target_id
  const fetchActivityDetails = async (activity: any) => {
    setSelectedActivity(activity);
    setActivityDetails(null);
    setActivityDetailsLoading(true);

    try {
      const type = activity.activity_type;
      const targetId = activity.target_id;
      let details: any = { type, targetId, raw: activity };

      if (!targetId) {
        setActivityDetails(details);
        return;
      }

      // Fetch related data based on activity type
      switch (type) {
        case "message_sent": {
          // target_id is a thread_id - get messages directly (RLS may block thread_participants)
          // Get the latest messages from this thread first
          const { data: messagesData, error: msgErr } = await (supabase as any)
            .from("messages")
            .select("id, content, user_id, created_at, attachment_type, attachment_url")
            .eq("thread_id", targetId)
            .order("created_at", { ascending: false })
            .limit(10);
          
          console.log("Messages query:", { targetId, messagesData, msgErr });
          
          if (messagesData && messagesData.length > 0) {
            details.chatMessages = messagesData.reverse(); // Show oldest first
            
            // Find the other participant from messages (not the user we're viewing)
            const otherUserIds = [...new Set(
              messagesData
                .map((m: any) => m.user_id)
                .filter((id: string) => id !== userId)
            )];
            
            if (otherUserIds.length > 0) {
              // Fetch profiles for other participants
              const { data: profiles } = await (supabase as any)
                .from("user_profiles")
                .select("id, username, full_name, avatar_url, email")
                .in("id", otherUserIds);
              
              if (profiles && profiles.length > 0) {
                details.targetUser = profiles[0];
                details.allParticipants = profiles;
              }
            }
          }
          
          // If no messages found, try thread_participants as fallback
          if (!messagesData?.length) {
            const { data: participantsData } = await (supabase as any)
              .from("thread_participants")
              .select("user_id, user_profiles(id, username, full_name, avatar_url, email)")
              .eq("thread_id", targetId);
            
            if (participantsData && participantsData.length > 0) {
              const otherParticipants = participantsData
                .filter((p: any) => p.user_id !== userId)
                .map((p: any) => p.user_profiles)
                .filter(Boolean);
              if (otherParticipants.length > 0) {
                details.targetUser = otherParticipants[0];
                details.allParticipants = otherParticipants;
              }
            }
          }
          
          // If still no data, check if thread exists
          if (!details.chatMessages?.length && !details.targetUser) {
            const { data: threadData } = await (supabase as any)
              .from("threads")
              .select("id, created_at")
              .eq("id", targetId)
              .maybeSingle();
            
            details.debugInfo = {
              threadExists: !!threadData,
              messagesError: msgErr?.message || "No messages accessible (RLS may be blocking)",
              threadId: targetId,
              note: threadData 
                ? "Thread exists but messages not accessible to admin" 
                : "Thread not found in database"
            };
          }
          break;
        }
        case "new_follower":
        case "follow_accepted": {
          const { data: userProfile } = await (supabase as any)
            .from("user_profiles")
            .select("id, username, full_name, avatar_url, email")
            .eq("id", targetId)
            .maybeSingle();
          details.targetUser = userProfile;
          break;
        }
        case "wish_claimed":
        case "wish_unclaim_requested": {
          // target_id is user who claimed
          const { data: userProfile } = await (supabase as any)
            .from("user_profiles")
            .select("id, username, full_name, avatar_url")
            .eq("id", targetId)
            .maybeSingle();
          details.targetUser = userProfile;
          break;
        }
        case "wishlist_created":
        case "wishlist_updated":
        case "item_added":
        case "item_reserved":
        case "item_unreserved": {
          // target_id might be wishlist or item id
          const { data: wishlistData } = await (supabase as any)
            .from("wishlists")
            .select("id, title, description, occasion, event_date")
            .eq("id", targetId)
            .maybeSingle();
          if (wishlistData) {
            details.wishlist = wishlistData;
          } else {
            // Try wishlist_items
            const { data: itemData } = await (supabase as any)
              .from("wishlist_items")
              .select("id, title, description, price, image_url, wishlists(id, title)")
              .eq("id", targetId)
              .maybeSingle();
            details.wishlistItem = itemData;
          }
          break;
        }
        case "product_added":
        case "product_viewed":
        case "product_liked": {
          const { data: productData } = await (supabase as any)
            .from("brand_products")
            .select("id, name, description, price, image_url")
            .eq("id", targetId)
            .maybeSingle();
          details.product = productData;
          break;
        }
        default: {
          // Generic: try user_profiles first
          const { data: userProfile } = await (supabase as any)
            .from("user_profiles")
            .select("id, username, full_name, avatar_url, email")
            .eq("id", targetId)
            .maybeSingle();
          if (userProfile) {
            details.targetUser = userProfile;
          }
          break;
        }
      }

      setActivityDetails(details);
    } catch (err) {
      console.error("Failed to fetch activity details:", err);
      setActivityDetails({ error: "Failed to load details" });
    } finally {
      setActivityDetailsLoading(false);
    }
  };

  // Human-readable activity type labels
  const getActivityLabel = (type: string) => {
    const labels: Record<string, string> = {
      message_sent: "Message Sent",
      new_follower: "New Follower",
      follow_accepted: "Follow Accepted",
      wish_claimed: "Wish Claimed",
      wish_unclaim_requested: "Unclaim Requested",
      wishlist_created: "Wishlist Created",
      wishlist_updated: "Wishlist Updated",
      item_added: "Item Added",
      item_reserved: "Item Reserved",
      item_unreserved: "Item Unreserved",
      product_added: "Product Added",
      product_viewed: "Product Viewed",
      product_liked: "Product Liked",
    };
    return labels[type] || type.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
  };

  // Fetch complete user data - with real-time polling when sync is enabled
  const { data: userData, isLoading } = useQuery({
    queryKey: ["admin-user-detail", userId],
    enabled: !!userId,
    refetchOnWindowFocus: false, // Prevent refetch from overwriting optimistic updates
    staleTime: 30000, // Cache for 30 seconds
    refetchInterval: false, // No automatic polling - use Fetch button
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
        wishlistsData,
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
        // User's wishlists (for personal accounts)
        safeQuery(() => (supabase as any)
          .from("wishlists")
          .select("id, title, description, event_date, privacy_level")
          .eq("user_id", userId)),
      ]);

      const auth = Array.isArray(authData) && authData.length > 0 ? authData[0] : null;
      const profile = profileData as any;
      const brand = brandData as any;
      const followers = (followersData as any[]) ?? [];
      const following = (followingData as any[]) ?? [];
      const activities = (activitiesData as any[]) ?? [];
      const rawWishlists = (wishlistsData as any[]) ?? [];

      // Enrich wishlists with likes and comments counts
      let wishlists = rawWishlists;
      if (rawWishlists.length > 0) {
        const wishlistIds = rawWishlists.map((w: any) => w.id);
        
        // Get wishlist likes
        const { data: wishlistLikes } = await (supabase as any)
          .from("wishlist_likes")
          .select("wishlist_id")
          .in("wishlist_id", wishlistIds);
        
        // Get wishlist comments
        const { data: wishlistComments } = await (supabase as any)
          .from("wishlist_comments")
          .select("wishlist_id")
          .in("wishlist_id", wishlistIds);
        
        // Get item counts per wishlist
        const { data: wishlistItems } = await (supabase as any)
          .from("wishlist_items")
          .select("wishlist_id")
          .in("wishlist_id", wishlistIds);

        // Count per wishlist
        const likeCounts: Record<string, number> = {};
        const commentCounts: Record<string, number> = {};
        const itemCounts: Record<string, number> = {};
        
        (wishlistLikes || []).forEach((l: any) => {
          likeCounts[l.wishlist_id] = (likeCounts[l.wishlist_id] || 0) + 1;
        });
        (wishlistComments || []).forEach((c: any) => {
          commentCounts[c.wishlist_id] = (commentCounts[c.wishlist_id] || 0) + 1;
        });
        (wishlistItems || []).forEach((i: any) => {
          itemCounts[i.wishlist_id] = (itemCounts[i.wishlist_id] || 0) + 1;
        });

        wishlists = rawWishlists.map((w: any) => ({
          ...w,
          likes_count: likeCounts[w.id] || 0,
          comments_count: commentCounts[w.id] || 0,
          item_count: itemCounts[w.id] || 0,
        }));
      }

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

      // Fetch brand products, followers, and following if brand exists
      let brandProducts: any[] = [];
      let brandFollowersList: any[] = [];
      let brandFollowingList: any[] = [];
      let brandAnalytics = { views: 0, wishlistAdds: 0, likes: 0 };

      if (brand?.id) {
        // Products
        const { data: products } = await (supabase as any)
          .from("brand_products")
          .select("*")
          .eq("brand_id", brand.id);
        
        // Enrich products with stats
        if (products && products.length > 0) {
          const productIds = products.map((p: any) => p.id);
          
          // Get likes per product
          const { data: productLikes } = await (supabase as any)
            .from("brand_product_likes")
            .select("product_id")
            .in("product_id", productIds);
          
          // Get views per product
          const { data: productViews } = await (supabase as any)
            .from("brand_product_views")
            .select("product_id")
            .in("product_id", productIds);
          
          // Get questions per product
          const { data: productQuestions } = await (supabase as any)
            .from("product_questions")
            .select("product_id")
            .in("product_id", productIds);
          
          // Get times added to wishlists
          const { data: wishlistAdds } = await (supabase as any)
            .from("wishlist_items")
            .select("brand_product_id")
            .in("brand_product_id", productIds);

          // Count per product
          const likeCounts: Record<string, number> = {};
          const viewCounts: Record<string, number> = {};
          const questionCounts: Record<string, number> = {};
          const addCounts: Record<string, number> = {};
          
          (productLikes || []).forEach((l: any) => {
            likeCounts[l.product_id] = (likeCounts[l.product_id] || 0) + 1;
          });
          (productViews || []).forEach((v: any) => {
            viewCounts[v.product_id] = (viewCounts[v.product_id] || 0) + 1;
          });
          (productQuestions || []).forEach((q: any) => {
            questionCounts[q.product_id] = (questionCounts[q.product_id] || 0) + 1;
          });
          (wishlistAdds || []).forEach((a: any) => {
            addCounts[a.brand_product_id] = (addCounts[a.brand_product_id] || 0) + 1;
          });

          brandProducts = products.map((p: any) => ({
            ...p,
            likes_count: likeCounts[p.id] || 0,
            views_count: viewCounts[p.id] || 0,
            questions_count: questionCounts[p.id] || 0,
            wishlist_adds_count: addCounts[p.id] || 0,
          }));
        } else {
          brandProducts = [];
        }

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

        // Brand following - users/profiles the brand is following
        const { data: bfgData } = await (supabase as any)
          .from("brand_following")
          .select("id, following_id, status, created_at")
          .eq("brand_id", brand.id);
        
        const bfgIds = ((bfgData as any[]) ?? []).map((f: any) => f.following_id).filter(Boolean);
        let bfgProfiles: any[] = [];
        if (bfgIds.length > 0) {
          const { data: profiles } = await (supabase as any)
            .from("user_profiles")
            .select("id, username, full_name, avatar_url")
            .in("id", bfgIds);
          bfgProfiles = profiles ?? [];
        }

        brandFollowingList = ((bfgData as any[]) ?? []).map((f: any) => ({
          ...f,
          profile: bfgProfiles.find((p: any) => p.id === f.following_id) || null,
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
        wishlists,
        brandProducts,
        brandFollowersList,
        brandFollowingList,
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
    onSuccess: async (data, variables) => {
      toast.success("Setting updated");
      
      // Send broadcast to update user UI in real-time for all changes
      if (userId) {
        const channel = (supabase as any)
          .channel(`admin-master-control-${userId}`);

        channel.subscribe((status: string) => {
          if (status === 'SUBSCRIBED') {
            channel.send({
              type: 'broadcast',
              event: 'refresh',
              payload: { source: 'admin' },
            });
            setTimeout(() => {
              (supabase as any).removeChannel(channel);
            }, 1000);
          }
        });
      }
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
    onSuccess: async (data, variables) => {
      toast.success("Brand setting updated");
      
      // If is_verified was changed, send broadcast to update brand UI in real-time
      if (variables.field === "is_verified" && userId) {
        const channel = (supabase as any)
          .channel(`admin-master-control-${userId}`);

        channel.subscribe((status: string) => {
          if (status === 'SUBSCRIBED') {
            channel.send({
              type: 'broadcast',
              event: 'refresh',
              payload: { source: 'admin' },
            });
            setTimeout(() => {
              (supabase as any).removeChannel(channel);
            }, 1000);
          }
        });
      }
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

  // Delete user wishlist
  const deleteWishlist = useMutation({
    mutationFn: async (wishlistId: string) => {
      const { error } = await (supabase as any)
        .from("wishlists")
        .delete()
        .eq("id", wishlistId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Wishlist deleted");
      setDeleteWishlistDialog(null);
      queryClient.invalidateQueries({ queryKey: ["admin-user-detail", userId] });
    },
    onError: (err: any) => toast.error(err?.message || "Failed to delete wishlist"),
  });

  // Delete wishlist item
  const deleteWishlistItem = useMutation({
    mutationFn: async (itemId: string) => {
      const { error } = await (supabase as any)
        .from("wishlist_items")
        .delete()
        .eq("id", itemId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Item deleted");
      setDeleteItemDialog(null);
      // Refetch wishlist items
      if (selectedWishlist) {
        fetchWishlistItems(selectedWishlist.id);
      }
      queryClient.invalidateQueries({ queryKey: ["admin-user-detail", userId] });
    },
    onError: (err: any) => toast.error(err?.message || "Failed to delete item"),
  });

  // Fetch wishlist items with all related data
  const fetchWishlistItems = async (wishlistId: string) => {
    try {
      // Get items
      const { data: items, error } = await (supabase as any)
        .from("wishlist_items")
        .select("id, wishlist_id, title, description, image_url, status, desire, brand, url, brand_product_id, added_at")
        .eq("wishlist_id", wishlistId);
      
      if (error || !items) {
        setWishlistItems([]);
        return;
      }

      const itemIds = items.map((i: any) => i.id);
      
      // Get reservations (claims)
      const { data: reservations } = await (supabase as any)
        .from("wishlist_reservations")
        .select("item_id, reserved_by_id, status, is_anonymous, created_at, approved_at")
        .in("item_id", itemIds);
      
      // Get likes count
      const { data: likes } = await (supabase as any)
        .from("item_likes")
        .select("item_id")
        .in("item_id", itemIds);
      
      // Get comments count
      const { data: comments } = await (supabase as any)
        .from("item_comments")
        .select("item_id")
        .in("item_id", itemIds);
      
      // Get reserver profiles
      const reserverIds = (reservations || []).map((r: any) => r.reserved_by_id).filter(Boolean);
      let reserverProfiles: any[] = [];
      if (reserverIds.length > 0) {
        const { data: profiles } = await (supabase as any)
          .from("user_profiles")
          .select("id, username, full_name, avatar_url")
          .in("id", reserverIds);
        reserverProfiles = profiles || [];
      }

      // Count likes and comments per item
      const likeCounts: Record<string, number> = {};
      const commentCounts: Record<string, number> = {};
      (likes || []).forEach((l: any) => {
        likeCounts[l.item_id] = (likeCounts[l.item_id] || 0) + 1;
      });
      (comments || []).forEach((c: any) => {
        commentCounts[c.item_id] = (commentCounts[c.item_id] || 0) + 1;
      });

      // Merge all data
      const enrichedItems = items.map((item: any) => {
        const reservation = (reservations || []).find((r: any) => r.item_id === item.id);
        const reserverProfile = reservation ? reserverProfiles.find((p: any) => p.id === reservation.reserved_by_id) : null;
        return {
          ...item,
          likes_count: likeCounts[item.id] || 0,
          comments_count: commentCounts[item.id] || 0,
          reservation: reservation || null,
          reserver: reserverProfile || null,
        };
      });

      setWishlistItems(enrichedItems);
    } catch (err) {
      console.error("Failed to fetch wishlist items:", err);
      setWishlistItems([]);
    }
  };

  // Fetch comments for a wishlist or item
  const fetchComments = async (type: 'wishlist' | 'item', id: string, title: string) => {
    try {
      const table = type === 'wishlist' ? 'wishlist_comments' : 'item_comments';
      const idField = type === 'wishlist' ? 'wishlist_id' : 'item_id';
      
      const { data: comments, error } = await (supabase as any)
        .from(table)
        .select("id, user_id, content, created_at")
        .eq(idField, id)
        .order("created_at", { ascending: false });
      
      if (error || !comments) {
        setCommentsData([]);
        setCommentsDialog({ type, id, title });
        return;
      }

      // Get commenter profiles
      const userIds = comments.map((c: any) => c.user_id).filter(Boolean);
      let profiles: any[] = [];
      if (userIds.length > 0) {
        const { data: profilesData } = await (supabase as any)
          .from("user_profiles")
          .select("id, username, full_name, avatar_url")
          .in("id", userIds);
        profiles = profilesData || [];
      }

      const enrichedComments = comments.map((c: any) => ({
        ...c,
        user: profiles.find((p: any) => p.id === c.user_id) || null,
      }));

      setCommentsData(enrichedComments);
      setCommentsDialog({ type, id, title });
    } catch (err) {
      console.error("Failed to fetch comments:", err);
      setCommentsData([]);
      setCommentsDialog({ type, id, title });
    }
  };

  // Fetch likes for a wishlist, item, or product
  const fetchLikes = async (type: 'wishlist' | 'item' | 'product', id: string, title: string) => {
    try {
      const table = type === 'wishlist' ? 'wishlist_likes' : type === 'item' ? 'item_likes' : 'brand_product_likes';
      const idField = type === 'wishlist' ? 'wishlist_id' : type === 'item' ? 'item_id' : 'product_id';
      
      const { data: likes, error } = await (supabase as any)
        .from(table)
        .select("id, user_id, created_at")
        .eq(idField, id)
        .order("created_at", { ascending: false });
      
      if (error || !likes) {
        setLikesData([]);
        setLikesDialog({ type, id, title });
        return;
      }

      // Get liker profiles
      const userIds = likes.map((l: any) => l.user_id).filter(Boolean);
      let profiles: any[] = [];
      if (userIds.length > 0) {
        const { data: profilesData } = await (supabase as any)
          .from("user_profiles")
          .select("id, username, full_name, avatar_url")
          .in("id", userIds);
        profiles = profilesData || [];
      }

      const enrichedLikes = likes.map((l: any) => ({
        ...l,
        user: profiles.find((p: any) => p.id === l.user_id) || null,
      }));

      setLikesData(enrichedLikes);
      setLikesDialog({ type, id, title });
    } catch (err) {
      console.error("Failed to fetch likes:", err);
      setLikesData([]);
      setLikesDialog({ type, id, title });
    }
  };

  // Fetch product stats (views, questions, wishlist adds)
  const fetchProductStats = async (type: 'views' | 'questions' | 'adds', productId: string, productName: string) => {
    try {
      let data: any[] = [];
      let userIdField = 'user_id';

      if (type === 'views') {
        const { data: views } = await (supabase as any)
          .from("brand_product_views")
          .select("id, viewer_id, viewed_at, source")
          .eq("product_id", productId)
          .order("viewed_at", { ascending: false });
        data = views || [];
        userIdField = 'viewer_id';
      } else if (type === 'questions') {
        const { data: questions } = await (supabase as any)
          .from("product_questions")
          .select("id, user_id, question, answer, status, created_at")
          .eq("product_id", productId)
          .order("created_at", { ascending: false });
        data = questions || [];
      } else if (type === 'adds') {
        const { data: adds } = await (supabase as any)
          .from("wishlist_items")
          .select("id, wishlist_id, added_at")
          .eq("brand_product_id", productId);
        
        // Get wishlist info to find who added
        if (adds && adds.length > 0) {
          const wishlistIds = adds.map((a: any) => a.wishlist_id);
          const { data: wishlists } = await (supabase as any)
            .from("wishlists")
            .select("id, user_id, title")
            .in("id", wishlistIds);
          
          data = adds.map((a: any) => {
            const wishlist = (wishlists || []).find((w: any) => w.id === a.wishlist_id);
            return {
              ...a,
              user_id: wishlist?.user_id,
              wishlist_title: wishlist?.title,
            };
          });
        }
      }

      // Get user profiles
      const userIds = data.map((d: any) => d[userIdField] || d.user_id).filter(Boolean);
      let profiles: any[] = [];
      if (userIds.length > 0) {
        const { data: profilesData } = await (supabase as any)
          .from("user_profiles")
          .select("id, username, full_name, avatar_url")
          .in("id", userIds);
        profiles = profilesData || [];
      }

      const enrichedData = data.map((d: any) => ({
        ...d,
        user: profiles.find((p: any) => p.id === (d[userIdField] || d.user_id)) || null,
      }));

      setProductStatsData(enrichedData);
      setProductStatsDialog({ type, productId, productName });
    } catch (err) {
      console.error("Failed to fetch product stats:", err);
      setProductStatsData([]);
      setProductStatsDialog({ type, productId, productName });
    }
  };

  // Check if user is "online" based on last_active_at (real-time presence)
  // Falls back to last_sign_in_at if last_active_at not available
  const lastActiveAt = userData?.profile?.last_active_at as string | null | undefined;
  const lastSignInAt = userData?.auth?.last_sign_in_at as string | null | undefined;
  const lastSeen = lastActiveAt || lastSignInAt || null;

  // If we have real presence (last_active_at), use a 10 minute window
  // Otherwise, fall back to a more generous window on last_sign_in_at (15 minutes)
  const hasPresenceSignal = !!lastActiveAt;
  const onlineWindowMs = hasPresenceSignal ? 10 * 60 * 1000 : 15 * 60 * 1000;

  const isOnline = lastSeen
    ? (Date.now() - new Date(lastSeen).getTime()) < onlineWindowMs
    : false;

  const lastSeenLabel = lastSeen ? formatDateTime(lastSeen) : "Unknown";

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

  const { auth, profile, brand, followers, following, activities, brandProducts, brandFollowersList, brandFollowingList, brandAnalytics, isBusiness } = userData;
  
  // For personal accounts: use followers table
  // For business accounts: use brand_followers table as main followers
  const userFollowers = followers.filter((f: any) => f.status === "accepted");
  const userFollowing = following.filter((f: any) => f.status === "accepted");
  const brandFollowersAccepted = brandFollowersList.filter((f: any) => f.status === "accepted");
  
  // Main display - for business, show brand followers/following from brand tables
  const brandFollowingAccepted = (brandFollowingList || []).filter((f: any) => f.status === "accepted");
  const displayFollowers = isBusiness ? brandFollowersAccepted : userFollowers;
  const displayFollowing = isBusiness ? brandFollowingAccepted : userFollowing;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate("/mqtr/users")}
          className="h-10 w-10 rounded-full bg-slate-900/80 border border-slate-700/80 text-slate-200 shadow-sm hover:bg-slate-800 hover:border-slate-500 hover:text-white active:scale-95 transition-all duration-150"
        >
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
          <Badge className={isOnline ? "bg-green-500/20 text-green-400" : "bg-slate-600 text-slate-400"}>
            {isOnline ? <Wifi className="w-3 h-3 mr-1" /> : <WifiOff className="w-3 h-3 mr-1" />}
            {isOnline ? "Online" : `Last seen ${lastSeenLabel}`}
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
        <TabsList className="bg-slate-900/70 border border-slate-700 flex flex-wrap gap-2 px-3 py-2 rounded-full justify-center">
          <TabsTrigger
            value="account"
            className="text-xs sm:text-sm px-3 py-1.5 rounded-full text-slate-300 data-[state=inactive]:text-slate-500 data-[state=active]:bg-indigo-600 data-[state=active]:text-white"
          >
            Account
          </TabsTrigger>
          <TabsTrigger
            value="social"
            className="text-xs sm:text-sm px-3 py-1.5 rounded-full text-slate-300 data-[state=inactive]:text-slate-500 data-[state=active]:bg-emerald-600 data-[state=active]:text-white"
          >
            Social
          </TabsTrigger>
          {isBusiness && (
            <TabsTrigger
              value="brand"
              className="text-xs sm:text-sm px-3 py-1.5 rounded-full text-slate-300 data-[state=inactive]:text-slate-500 data-[state=active]:bg-sky-600 data-[state=active]:text-white"
            >
              Brand
            </TabsTrigger>
          )}
          {isBusiness && (
            <TabsTrigger
              value="products"
              className="text-xs sm:text-sm px-3 py-1.5 rounded-full text-slate-300 data-[state=inactive]:text-slate-500 data-[state=active]:bg-violet-600 data-[state=active]:text-white"
            >
              Products
            </TabsTrigger>
          )}
          {!isBusiness && (
            <TabsTrigger
              value="wishlists"
              className="text-xs sm:text-sm px-3 py-1.5 rounded-full text-slate-300 data-[state=inactive]:text-slate-500 data-[state=active]:bg-purple-600 data-[state=active]:text-white"
            >
              Wishlists
            </TabsTrigger>
          )}
          <TabsTrigger
            value="godmode"
            className="text-xs sm:text-sm px-3 py-1.5 rounded-full text-red-300 data-[state=inactive]:text-red-400/80 data-[state=active]:bg-red-600 data-[state=active]:text-white data-[state=active]:border data-[state=active]:border-red-500/70 flex items-center justify-center"
          >
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
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 bg-slate-700/70 text-slate-100 hover:bg-slate-600 hover:text-white border border-slate-600/80"
                      onClick={() => copyToClipboard(userId!, "id")}
                    >
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

          {/* Complete Data View - Merged from all sources, NO NULLS */}
          <Card className="p-4 bg-slate-800/50 border-slate-700">
            <h3 className="text-sm font-semibold text-slate-300 mb-4">
              📋 Complete Data ({isBusiness ? "Brand + User Profile" : "User Profile"})
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs max-h-96 overflow-y-auto">
              {(() => {
                // Merge all data sources - brand data takes priority for business accounts
                const mergedData: Record<string, any> = {};
                
                // Start with profile data
                if (profile) {
                  Object.entries(profile).forEach(([key, value]) => {
                    mergedData[`profile.${key}`] = value;
                  });
                }
                
                // Add brand data for business accounts (these override profile where applicable)
                if (isBusiness && brand) {
                  Object.entries(brand).forEach(([key, value]) => {
                    mergedData[`brand.${key}`] = value;
                  });
                }
                
                // Filter out null/undefined values - admin sees ONLY real data
                const filteredEntries = Object.entries(mergedData)
                  .filter(([_, value]) => value !== null && value !== undefined && value !== "")
                  .sort(([a], [b]) => a.localeCompare(b));
                
                return filteredEntries.map(([key, value]) => (
                  <div key={key} className="flex justify-between items-start gap-3 p-2 rounded bg-slate-900/50">
                    <span className="text-slate-500 font-mono text-xs break-all max-w-[45%]">
                      {key.startsWith("brand.") ? (
                        <span className="text-blue-400">{key}</span>
                      ) : (
                        key
                      )}
                    </span>
                    <span className="text-slate-300 text-xs break-all text-right max-w-[55%]">
                      {value === true ? (
                        <Badge className="bg-green-500/20 text-green-400 text-[10px]">true</Badge>
                      ) : value === false ? (
                        <Badge className="bg-red-500/20 text-red-400 text-[10px]">false</Badge>
                      ) : (() => {
                        const text = String(value);
                        const isUrl = text.startsWith("http://") || text.startsWith("https://");
                        return isUrl ? (
                          <a
                            href={text}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-400 hover:underline break-all"
                          >
                            {text}
                          </a>
                        ) : (
                          text
                        );
                      })()}
                    </span>
                  </div>
                ));
              })()}
            </div>
            <div className="mt-3 text-xs text-slate-500">
              {isBusiness ? (
                <span><span className="text-blue-400">brand.*</span> = from brands table | profile.* = from user_profiles</span>
              ) : (
                <span>All fields from user_profiles table</span>
              )}
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
                  <button
                    key={activity.id}
                    onClick={() => fetchActivityDetails(activity)}
                    className="w-full flex justify-between items-center p-2 rounded-lg bg-slate-900/50 text-sm hover:bg-slate-800 transition-colors cursor-pointer text-left"
                  >
                    <div className="flex items-center gap-2">
                      <Badge className="bg-lime-900/50 text-lime-400 hover:bg-lime-800/50">{getActivityLabel(activity.activity_type)}</Badge>
                      {activity.target_id && (
                        <code className="text-xs text-slate-500">{activity.target_id.slice(0, 8)}...</code>
                      )}
                    </div>
                    <span className="text-slate-500 text-xs">{formatDateTime(activity.created_at)}</span>
                  </button>
                ))
              ) : (
                <div className="text-slate-500 text-center py-8">No activities yet</div>
              )}
            </div>
          </Card>

          {/* Activity Details Dialog */}
          <Dialog open={!!selectedActivity} onOpenChange={(open) => !open && setSelectedActivity(null)}>
            <DialogContent className="bg-slate-900 border-slate-700 text-slate-100 max-w-lg">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Activity className="w-5 h-5 text-lime-400" />
                  {selectedActivity && getActivityLabel(selectedActivity.activity_type)}
                </DialogTitle>
                <DialogDescription className="text-slate-400">
                  {selectedActivity && formatDateTime(selectedActivity.created_at)}
                </DialogDescription>
              </DialogHeader>

              {activityDetailsLoading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-lime-400"></div>
                </div>
              ) : activityDetails ? (
                <div className="space-y-4 text-sm">
                  {/* Target User */}
                  {activityDetails.targetUser && (
                    <div className="p-3 rounded-lg bg-slate-800/50">
                      <div className="text-xs text-slate-500 mb-2">Related User</div>
                      <div className="flex items-center gap-3">
                        <Avatar className="w-10 h-10">
                          <AvatarImage src={activityDetails.targetUser.avatar_url} />
                          <AvatarFallback className="bg-slate-700">
                            {(activityDetails.targetUser.full_name?.charAt(0) || activityDetails.targetUser.username?.charAt(0) || "?").toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <div className="font-medium">{activityDetails.targetUser.full_name || "Unknown"}</div>
                          <div className="text-xs text-slate-500">@{activityDetails.targetUser.username}</div>
                          {activityDetails.targetUser.email && (
                            <div className="text-xs text-slate-500">{activityDetails.targetUser.email}</div>
                          )}
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="ml-auto"
                          onClick={() => {
                            setSelectedActivity(null);
                            navigate(`/mqtr/users/${activityDetails.targetUser.id}`);
                          }}
                        >
                          View
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* Chat Messages */}
                  {activityDetails.chatMessages && activityDetails.chatMessages.length > 0 && (
                    <div className="p-3 rounded-lg bg-slate-800/50">
                      <div className="text-xs text-slate-500 mb-2">Recent Messages in Thread</div>
                      <div className="space-y-2 max-h-48 overflow-y-auto">
                        {activityDetails.chatMessages.map((msg: any) => {
                          const isCurrentUser = msg.user_id === userId;
                          const senderName = isCurrentUser 
                            ? (profile?.full_name || profile?.username || 'This user')
                            : (activityDetails.targetUser?.full_name || activityDetails.targetUser?.username || 'Other');
                          return (
                          <div key={msg.id} className={`p-2 rounded ${isCurrentUser ? 'bg-lime-900/30 ml-4' : 'bg-slate-900 mr-4'}`}>
                            <div className="text-xs text-slate-500 mb-1">
                              {senderName} • {formatDateTime(msg.created_at)}
                            </div>
                            {msg.content && (
                              <p className="text-slate-200 text-sm">{msg.content}</p>
                            )}
                            {msg.attachment_url && (
                              <div className="mt-1">
                                {msg.attachment_type === 'image' ? (
                                  <img src={msg.attachment_url} alt="attachment" className="max-w-full h-auto max-h-32 rounded" />
                                ) : (
                                  <a href={msg.attachment_url} target="_blank" rel="noopener noreferrer" className="text-blue-400 text-xs hover:underline">
                                    View attachment
                                  </a>
                                )}
                              </div>
                            )}
                          </div>
                        );})}
                      </div>
                    </div>
                  )}

                  {/* Support Message */}
                  {activityDetails.supportMessage && (
                    <div className="p-3 rounded-lg bg-slate-800/50">
                      <div className="text-xs text-slate-500 mb-2">Support Message</div>
                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <span className="text-slate-500">Subject:</span>
                          <span>{activityDetails.supportMessage.subject || "—"}</span>
                        </div>
                        <div>
                          <span className="text-slate-500">Message:</span>
                          <p className="mt-1 p-2 bg-slate-900 rounded text-slate-300">
                            {activityDetails.supportMessage.message || activityDetails.supportMessage.content || "No content"}
                          </p>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500">Status:</span>
                          <Badge className={activityDetails.supportMessage.status === "resolved" ? "bg-green-900/50 text-green-400" : "bg-amber-900/50 text-amber-400"}>
                            {activityDetails.supportMessage.status || "pending"}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Wishlist */}
                  {activityDetails.wishlist && (
                    <div className="p-3 rounded-lg bg-slate-800/50">
                      <div className="text-xs text-slate-500 mb-2">Wishlist</div>
                      <div className="space-y-2">
                        <div className="font-medium">{activityDetails.wishlist.title}</div>
                        {activityDetails.wishlist.description && (
                          <p className="text-slate-400 text-xs">{activityDetails.wishlist.description}</p>
                        )}
                        <div className="flex gap-4 text-xs">
                          {activityDetails.wishlist.occasion && (
                            <span className="text-slate-500">Occasion: {activityDetails.wishlist.occasion}</span>
                          )}
                          {activityDetails.wishlist.event_date && (
                            <span className="text-slate-500">Date: {formatDate(activityDetails.wishlist.event_date)}</span>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Wishlist Item */}
                  {activityDetails.wishlistItem && (
                    <div className="p-3 rounded-lg bg-slate-800/50">
                      <div className="text-xs text-slate-500 mb-2">Wishlist Item</div>
                      <div className="flex gap-3">
                        {activityDetails.wishlistItem.image_url && (
                          <img src={activityDetails.wishlistItem.image_url} alt="" className="w-16 h-16 rounded object-cover" />
                        )}
                        <div className="flex-1">
                          <div className="font-medium">{activityDetails.wishlistItem.title}</div>
                          {activityDetails.wishlistItem.price && (
                            <div className="text-lime-400">${activityDetails.wishlistItem.price}</div>
                          )}
                          {activityDetails.wishlistItem.wishlists?.title && (
                            <div className="text-xs text-slate-500">In: {activityDetails.wishlistItem.wishlists.title}</div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Product */}
                  {activityDetails.product && (
                    <div className="p-3 rounded-lg bg-slate-800/50">
                      <div className="text-xs text-slate-500 mb-2">Product</div>
                      <div className="flex gap-3">
                        {activityDetails.product.image_url && (
                          <img src={activityDetails.product.image_url} alt="" className="w-16 h-16 rounded object-cover" />
                        )}
                        <div className="flex-1">
                          <div className="font-medium">{activityDetails.product.name}</div>
                          {activityDetails.product.price && (
                            <div className="text-lime-400">${activityDetails.product.price}</div>
                          )}
                          {activityDetails.product.description && (
                            <p className="text-xs text-slate-400 line-clamp-2">{activityDetails.product.description}</p>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Always show Target ID if present */}
                  {activityDetails.targetId && (
                    <div className="p-3 rounded-lg bg-slate-800/50">
                      <div className="text-xs text-slate-500 mb-2">Reference</div>
                      <div className="space-y-1">
                        <div className="flex justify-between items-center">
                          <span className="text-slate-500">Target ID:</span>
                          <code className="text-xs bg-slate-900 px-2 py-1 rounded text-slate-400">{activityDetails.targetId}</code>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Raw Data (fallback when nothing else found) */}
                  {!activityDetails.targetUser && !activityDetails.supportMessage && !activityDetails.wishlist && !activityDetails.wishlistItem && !activityDetails.product && !activityDetails.targetId && (
                    <div className="p-3 rounded-lg bg-slate-800/50">
                      <div className="text-xs text-slate-500 mb-2">Activity Data</div>
                      <div className="space-y-1">
                        <div className="flex justify-between">
                          <span className="text-slate-500">Type:</span>
                          <span>{activityDetails.type}</span>
                        </div>
                        <div className="text-slate-500 text-xs">No additional details available</div>
                      </div>
                    </div>
                  )}

                  {activityDetails.error && (
                    <div className="text-red-400 text-center py-4">{activityDetails.error}</div>
                  )}

                  {/* Debug Info / Data Not Found */}
                  {activityDetails.debugInfo && (
                    <div className="p-3 rounded-lg bg-slate-800/50 border border-slate-700">
                      <div className="text-sm text-slate-300 mb-2">
                        {activityDetails.debugInfo.threadExists === false 
                          ? "📭 Message thread no longer exists" 
                          : "⚠️ Unable to load message details"}
                      </div>
                      <div className="text-xs text-slate-500">
                        {activityDetails.debugInfo.note || "The conversation may have been deleted or is no longer accessible."}
                      </div>
                    </div>
                  )}

                  {/* Note about data source */}
                  {activityDetails.note && (
                    <div className="text-xs text-slate-500 italic px-1">
                      {activityDetails.note}
                    </div>
                  )}
                </div>
              ) : null}

              <DialogFooter>
                <Button 
                  variant="ghost" 
                  onClick={() => setSelectedActivity(null)}
                  className="bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-600"
                >
                  Close
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
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
                    <div className="flex items-center gap-1 max-w-[70%] justify-end">
                      <code className="text-xs text-slate-400 bg-slate-900 px-2 py-1 rounded break-all text-right">{brand?.id}</code>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 bg-slate-700/70 text-slate-100 hover:bg-slate-600 hover:text-white border border-slate-600/80"
                        onClick={() => copyToClipboard(brand?.id, "brand-id")}
                      >
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
                <div className="flex items-center gap-1 bg-slate-900/80 rounded-lg p-1 border border-slate-700/70">
                  <Button
                    variant="ghost"
                    size="icon"
                    className={
                      `h-7 w-7 p-0 text-slate-300 hover:bg-slate-700/70 ${
                        productViewMode === "grid" ? "bg-emerald-600 text-white shadow-sm" : ""
                      }`
                    }
                    onClick={() => setProductViewMode("grid")}
                  >
                    <LayoutGrid className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className={
                      `h-7 w-7 p-0 text-slate-300 hover:bg-slate-700/70 ${
                        productViewMode === "list" ? "bg-indigo-600 text-white shadow-sm" : ""
                      }`
                    }
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
                          {/* Product Stats */}
                          <div className="flex flex-wrap gap-1 mt-2" onClick={(e) => e.stopPropagation()}>
                            <Badge 
                              className="bg-pink-900/50 text-pink-300 text-xs cursor-pointer hover:bg-pink-800/50"
                              onClick={() => fetchLikes('product', product.id, product.name)}
                            >
                              ❤️ {product.likes_count || 0}
                            </Badge>
                            <Badge 
                              className="bg-blue-900/50 text-blue-300 text-xs cursor-pointer hover:bg-blue-800/50"
                              onClick={() => fetchProductStats('views', product.id, product.name)}
                            >
                              👁️ {product.views_count || 0}
                            </Badge>
                            <Badge 
                              className="bg-amber-900/50 text-amber-300 text-xs cursor-pointer hover:bg-amber-800/50"
                              onClick={() => fetchProductStats('questions', product.id, product.name)}
                            >
                              ❓ {product.questions_count || 0}
                            </Badge>
                            <Badge 
                              className="bg-green-900/50 text-green-300 text-xs cursor-pointer hover:bg-green-800/50"
                              onClick={() => fetchProductStats('adds', product.id, product.name)}
                            >
                              ➕ {product.wishlist_adds_count || 0}
                            </Badge>
                          </div>
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
                          {/* Product Stats */}
                          <div className="flex flex-wrap gap-1 mt-1" onClick={(e) => e.stopPropagation()}>
                            <Badge 
                              className="bg-pink-900/50 text-pink-300 text-xs cursor-pointer hover:bg-pink-800/50"
                              onClick={() => fetchLikes('product', product.id, product.name)}
                            >
                              ❤️ {product.likes_count || 0}
                            </Badge>
                            <Badge 
                              className="bg-blue-900/50 text-blue-300 text-xs cursor-pointer hover:bg-blue-800/50"
                              onClick={() => fetchProductStats('views', product.id, product.name)}
                            >
                              👁️ {product.views_count || 0}
                            </Badge>
                            <Badge 
                              className="bg-amber-900/50 text-amber-300 text-xs cursor-pointer hover:bg-amber-800/50"
                              onClick={() => fetchProductStats('questions', product.id, product.name)}
                            >
                              ❓ {product.questions_count || 0}
                            </Badge>
                            <Badge 
                              className="bg-green-900/50 text-green-300 text-xs cursor-pointer hover:bg-green-800/50"
                              onClick={() => fetchProductStats('adds', product.id, product.name)}
                            >
                              ➕ {product.wishlist_adds_count || 0}
                            </Badge>
                          </div>
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

                      {/* Product Stats */}
                      <div className="grid grid-cols-4 gap-3">
                        <div className="p-3 rounded-lg bg-pink-950/30 border border-pink-900/50 text-center">
                          <div className="text-2xl font-bold text-pink-400">{selectedProduct.likes_count || 0}</div>
                          <div className="text-xs text-pink-300">Likes</div>
                        </div>
                        <div className="p-3 rounded-lg bg-blue-950/30 border border-blue-900/50 text-center">
                          <div className="text-2xl font-bold text-blue-400">{selectedProduct.views_count || 0}</div>
                          <div className="text-xs text-blue-300">Views</div>
                        </div>
                        <div className="p-3 rounded-lg bg-amber-950/30 border border-amber-900/50 text-center">
                          <div className="text-2xl font-bold text-amber-400">{selectedProduct.questions_count || 0}</div>
                          <div className="text-xs text-amber-300">Questions</div>
                        </div>
                        <div className="p-3 rounded-lg bg-green-950/30 border border-green-900/50 text-center">
                          <div className="text-2xl font-bold text-green-400">{selectedProduct.wishlist_adds_count || 0}</div>
                          <div className="text-xs text-green-300">Wishlist Adds</div>
                        </div>
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
        <TabsContent value="godmode" className="space-y-4 mt-3 md:mt-4">
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
            <div className="space-y-4">
              {/* Header row */}
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`p-2 rounded-lg shrink-0 ${profile?.admin_master_control ? 'bg-amber-500/20' : 'bg-slate-700'}`}>
                    <Shield className={`w-5 h-5 ${profile?.admin_master_control ? 'text-amber-400' : 'text-slate-400'}`} />
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-bold text-slate-200 flex items-center gap-2 flex-wrap">
                      Master Control
                      {profile?.admin_master_control && (
                        <Badge className="bg-amber-500/20 text-amber-400 text-xs">ACTIVE</Badge>
                      )}
                    </div>
                    <div className="text-xs text-slate-500">
                      {profile?.admin_master_control 
                        ? "Admin controls enforced" 
                        : "User has full control"}
                    </div>
                  </div>
                </div>
                <Switch
                  checked={profile?.admin_master_control === true}
                  onCheckedChange={(checked) => updateProfileSetting.mutate({ field: "admin_master_control", value: checked })}
                  className={`shrink-0 ${profile?.admin_master_control ? "data-[state=checked]:bg-amber-500" : ""}`}
                />
              </div>
              {/* Buttons row */}
              <div className="flex flex-wrap gap-2">
                {/* Fetch from User button - existing behavior, keeps admin data in sync */}
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
                {/* New Refresh button - triggers remote refresh on brand/user app */}
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs border-slate-600 hover:bg-slate-700"
                  onClick={async () => {
                    if (!userId) return;

                    if (isBusiness) {
                      // For brands: send a realtime broadcast that BrandProfile listens to
                      const channel = (supabase as any)
                        .channel(`admin-master-control-${userId}`);

                      channel.subscribe((status: string) => {
                        if (status === 'SUBSCRIBED') {
                          channel.send({
                            type: 'broadcast',
                            event: 'refresh',
                            payload: { source: 'admin' },
                          });
                          // Give time for message to be delivered before cleanup
                          setTimeout(() => {
                            (supabase as any).removeChannel(channel);
                          }, 1000);
                        }
                      });

                      toast.success("Refreshed brand data");
                    } else {
                      // For personal accounts: send broadcast to user app + admin-side refetch
                      const channel = (supabase as any)
                        .channel(`admin-master-control-${userId}`);

                      channel.subscribe((status: string) => {
                        if (status === 'SUBSCRIBED') {
                          channel.send({
                            type: 'broadcast',
                            event: 'refresh',
                            payload: { source: 'admin' },
                          });
                          setTimeout(() => {
                            (supabase as any).removeChannel(channel);
                          }, 1000);
                        }
                      });

                      // Also refetch admin-side data
                      await queryClient.refetchQueries({ queryKey: ["admin-user-detail", userId] });
                      toast.success("Refreshed user data");
                    }
                  }}
                >
                  <Activity className="w-3 h-3 mr-1" />
                  Refresh {isBusiness ? 'Brand' : 'User'}
                </Button>
              </div>
            </div>
          </Card>

          {/* User Settings Controls - Only show for Personal accounts */}
          {/* These toggles EXACTLY match what user sees in their Settings page */}
          {!isBusiness && (
          <Card className="p-4 bg-slate-800/50 border-slate-700">
            <h3 className="text-sm font-semibold text-slate-300 mb-4 flex items-center gap-2">
              <Settings className="w-4 h-4" /> User Settings (matches user's Settings page)
              {profile?.admin_master_control && (
                <Badge className="bg-amber-500/20 text-amber-400 text-xs ml-2">Admin Enforced</Badge>
              )}
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Profile Visibility - is_searchable */}
              <div className="flex items-center justify-between p-3 rounded-lg bg-slate-900/50">
                <div>
                  <div className="text-sm font-medium text-slate-200">Profile Visibility</div>
                  <div className="text-xs text-slate-500">Public = appears in Explore search</div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-400">{profile?.is_searchable !== false ? "Public" : "Private"}</span>
                  <Switch
                    checked={profile?.is_searchable !== false}
                    onCheckedChange={(checked) => updateProfileSetting.mutate({ field: "is_searchable", value: checked })}
                  />
                </div>
              </div>
              {/* Follow Requests - require_follow_approval */}
              <div className="flex items-center justify-between p-3 rounded-lg bg-slate-900/50">
                <div>
                  <div className="text-sm font-medium text-slate-200">Follow Requests</div>
                  <div className="text-xs text-slate-500">Require approval for follows</div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-400">{profile?.require_follow_approval === true ? "Approval" : "Anyone"}</span>
                  <Switch
                    checked={profile?.require_follow_approval === true}
                    onCheckedChange={(checked) => updateProfileSetting.mutate({ field: "require_follow_approval", value: checked })}
                  />
                </div>
              </div>
              {/* Let followers see all wishlists - allow_followers_view */}
              <div className="flex items-center justify-between p-3 rounded-lg bg-slate-900/50">
                <div>
                  <div className="text-sm font-medium text-slate-200">Let followers see all wishlists</div>
                  <div className="text-xs text-slate-500">Followers can view all wishlists</div>
                </div>
                <Switch
                  checked={profile?.allow_followers_view === true}
                  onCheckedChange={(checked) => {
                    // Update both fields to maintain mutual exclusion
                    updateProfileSetting.mutate({ field: "allow_followers_view", value: checked });
                    if (checked) {
                      // If turning ON allow_followers_view, turn OFF enforce_wishlist_privacy
                      updateProfileSetting.mutate({ field: "enforce_wishlist_privacy", value: false });
                    }
                  }}
                />
              </div>
              {/* Respect per-wishlist privacy - enforce_wishlist_privacy */}
              <div className="flex items-center justify-between p-3 rounded-lg bg-slate-900/50">
                <div>
                  <div className="text-sm font-medium text-slate-200">Respect wishlist privacy</div>
                  <div className="text-xs text-slate-500">Each wishlist's privacy setting</div>
                </div>
                <Switch
                  checked={profile?.enforce_wishlist_privacy === true}
                  onCheckedChange={(checked) => {
                    // Update both fields to maintain mutual exclusion
                    updateProfileSetting.mutate({ field: "enforce_wishlist_privacy", value: checked });
                    if (checked) {
                      // If turning ON enforce_wishlist_privacy, turn OFF allow_followers_view
                      updateProfileSetting.mutate({ field: "allow_followers_view", value: false });
                    }
                  }}
                />
              </div>
              {/* Show share icon - allow_wishlist_sharing */}
              <div className="flex items-center justify-between p-3 rounded-lg bg-slate-900/50">
                <div>
                  <div className="text-sm font-medium text-slate-200">Show share icon</div>
                  <div className="text-xs text-slate-500">On wishlist cards</div>
                </div>
                <Switch
                  checked={profile?.allow_wishlist_sharing !== false}
                  onCheckedChange={(checked) => updateProfileSetting.mutate({ field: "allow_wishlist_sharing", value: checked })}
                />
              </div>
              {/* Allow friends to claim - allow_friends_claim */}
              <div className="flex items-center justify-between p-3 rounded-lg bg-slate-900/50">
                <div>
                  <div className="text-sm font-medium text-slate-200">Allow friends to claim</div>
                  <div className="text-xs text-slate-500">Friends can claim items</div>
                </div>
                <Switch
                  checked={profile?.allow_friends_claim !== false}
                  onCheckedChange={(checked) => updateProfileSetting.mutate({ field: "allow_friends_claim", value: checked })}
                />
              </div>
              {/* Auto-approve claims - auto_approve_claims */}
              <div className="flex items-center justify-between p-3 rounded-lg bg-slate-900/50">
                <div>
                  <div className="text-sm font-medium text-slate-200">Auto-approve claims</div>
                  <div className="text-xs text-slate-500">Auto-approve claim requests</div>
                </div>
                <Switch
                  checked={profile?.auto_approve_claims === true}
                  onCheckedChange={(checked) => updateProfileSetting.mutate({ field: "auto_approve_claims", value: checked })}
                />
              </div>
              {/* Auto-approve unclaims - auto_approve_unclaims */}
              <div className="flex items-center justify-between p-3 rounded-lg bg-slate-900/50">
                <div>
                  <div className="text-sm font-medium text-slate-200">Auto-approve unclaims</div>
                  <div className="text-xs text-slate-500">Auto-approve unclaim requests</div>
                </div>
                <Switch
                  checked={profile?.auto_approve_unclaims === true}
                  onCheckedChange={(checked) => updateProfileSetting.mutate({ field: "auto_approve_unclaims", value: checked })}
                />
              </div>
              {/* Allow likes - allow_likes */}
              <div className="flex items-center justify-between p-3 rounded-lg bg-slate-900/50">
                <div>
                  <div className="text-sm font-medium text-slate-200">Allow likes</div>
                  <div className="text-xs text-slate-500">On wishlists</div>
                </div>
                <Switch
                  checked={profile?.allow_likes !== false}
                  onCheckedChange={(checked) => updateProfileSetting.mutate({ field: "allow_likes", value: checked })}
                />
              </div>
              {/* Allow comments - allow_comments */}
              <div className="flex items-center justify-between p-3 rounded-lg bg-slate-900/50">
                <div>
                  <div className="text-sm font-medium text-slate-200">Allow comments</div>
                  <div className="text-xs text-slate-500">On wishlists</div>
                </div>
                <Switch
                  checked={profile?.allow_comments !== false}
                  onCheckedChange={(checked) => updateProfileSetting.mutate({ field: "allow_comments", value: checked })}
                />
              </div>
              {/* Show countdown timer - show_countdown_timer */}
              <div className="flex items-center justify-between p-3 rounded-lg bg-slate-900/50">
                <div>
                  <div className="text-sm font-medium text-slate-200">Show countdown timer</div>
                  <div className="text-xs text-slate-500">On shared page</div>
                </div>
                <Switch
                  checked={profile?.show_countdown_timer !== false}
                  onCheckedChange={(checked) => updateProfileSetting.mutate({ field: "show_countdown_timer", value: checked })}
                />
              </div>
              {/* Notifications - receive_notifications */}
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
          )}

          {/* Brand Settings (if business) */}
          {isBusiness && brand && (
            <Card className="p-4 bg-slate-800/50 border-slate-700">
              <h3 className="text-sm font-semibold text-slate-300 mb-4 flex items-center gap-2">
                <Building2 className="w-4 h-4 text-purple-400" /> Brand Settings (brands table)
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
                    checked={brand?.auto_approve_followers === true}
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
                {/* products_find_mode */}
                <div className="flex flex-col p-3 rounded-lg bg-slate-900/50">
                  <div className="mb-2">
                    <div className="text-sm font-medium text-slate-200">Users can find products</div>
                    <div className="text-xs text-slate-500">Control if products are findable for everyone or per product</div>
                  </div>
                  <div className="inline-flex rounded-full border border-slate-700 bg-slate-900 px-1 py-0.5 text-xs mt-1 self-start">
                    <button
                      type="button"
                      className={`px-3 py-1 rounded-full ${brand?.products_find_mode === 'all_off' ? 'bg-slate-800 text-slate-50' : 'text-slate-400'}`}
                      onClick={() => updateBrandSetting.mutate({ field: 'products_find_mode', value: 'all_off', brandId: brand.id })}
                    >
                      All off
                    </button>
                    <button
                      type="button"
                      className={`px-3 py-1 rounded-full ${brand?.products_find_mode === 'all_on' ? 'bg-slate-800 text-slate-50' : 'text-slate-400'}`}
                      onClick={() => updateBrandSetting.mutate({ field: 'products_find_mode', value: 'all_on', brandId: brand.id })}
                    >
                      All on
                    </button>
                    <button
                      type="button"
                      className={`px-3 py-1 rounded-full ${!brand?.products_find_mode || brand?.products_find_mode === 'per_product' ? 'bg-slate-800 text-slate-50' : 'text-slate-400'}`}
                      onClick={() => updateBrandSetting.mutate({ field: 'products_find_mode', value: 'per_product', brandId: brand.id })}
                    >
                      Per product
                    </button>
                  </div>
                </div>
                {/* products_add_mode */}
                <div className="flex flex-col p-3 rounded-lg bg-slate-900/50">
                  <div className="mb-2">
                    <div className="text-sm font-medium text-slate-200">Users can add products as an item</div>
                    <div className="text-xs text-slate-500">Control if products can be added to wishlists or items list</div>
                  </div>
                  <div className="inline-flex rounded-full border border-slate-700 bg-slate-900 px-1 py-0.5 text-xs mt-1 self-start">
                    <button
                      type="button"
                      className={`px-3 py-1 rounded-full ${brand?.products_add_mode === 'all_off' ? 'bg-slate-800 text-slate-50' : 'text-slate-400'}`}
                      onClick={() => updateBrandSetting.mutate({ field: 'products_add_mode', value: 'all_off', brandId: brand.id })}
                    >
                      All off
                    </button>
                    <button
                      type="button"
                      className={`px-3 py-1 rounded-full ${brand?.products_add_mode === 'all_on' ? 'bg-slate-800 text-slate-50' : 'text-slate-400'}`}
                      onClick={() => updateBrandSetting.mutate({ field: 'products_add_mode', value: 'all_on', brandId: brand.id })}
                    >
                      All on
                    </button>
                    <button
                      type="button"
                      className={`px-3 py-1 rounded-full ${!brand?.products_add_mode || brand?.products_add_mode === 'per_product' ? 'bg-slate-800 text-slate-50' : 'text-slate-400'}`}
                      onClick={() => updateBrandSetting.mutate({ field: 'products_add_mode', value: 'per_product', brandId: brand.id })}
                    >
                      Per product
                    </button>
                  </div>
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

        {/* Wishlists Tab (personal users only) */}
        {!isBusiness && (
          <TabsContent value="wishlists" className="space-y-4">
            {/* User's Wishlists */}
            <Card className="p-4 bg-slate-800/50 border-slate-700">
              <h3 className="text-sm font-semibold text-slate-300 mb-4 flex items-center gap-2">
                <Gift className="w-4 h-4 text-purple-400" /> User's Wishlists
              </h3>
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {userData?.wishlists && userData.wishlists.length > 0 ? (
                  userData.wishlists.map((wishlist: any) => (
                    <div key={wishlist.id} className="p-4 rounded-lg bg-slate-900/50 space-y-3">
                      {/* Wishlist Header */}
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 rounded-lg bg-purple-900/30 flex items-center justify-center">
                            <Gift className="w-5 h-5 text-purple-400" />
                          </div>
                          <div>
                            <div className="text-sm font-medium text-slate-200">{wishlist.title || "Untitled"}</div>
                            {wishlist.description && (
                              <div className="text-xs text-slate-500 mt-1 line-clamp-1">{wishlist.description}</div>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-purple-400 hover:text-purple-300 hover:bg-purple-950/50"
                            onClick={() => {
                              setSelectedWishlist(wishlist);
                              fetchWishlistItems(wishlist.id);
                            }}
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-red-400 hover:text-red-300 hover:bg-red-950/50"
                            onClick={() => setDeleteWishlistDialog(wishlist.id)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>

                      {/* Wishlist Stats */}
                      <div className="flex flex-wrap gap-2">
                        {/* Items Count */}
                        <Badge className="bg-slate-700 text-slate-300 text-xs">
                          {wishlist.item_count || 0} items
                        </Badge>
                        {/* Privacy */}
                        <Badge className={`text-xs ${wishlist.privacy_level === 'public' ? 'bg-green-900/50 text-green-300' : wishlist.privacy_level === 'friends_only' ? 'bg-amber-900/50 text-amber-300' : 'bg-slate-700 text-slate-300'}`}>
                          {wishlist.privacy_level || 'private'}
                        </Badge>
                        {/* Likes */}
                        <Badge 
                          className="bg-pink-900/50 text-pink-300 text-xs flex items-center gap-1 cursor-pointer hover:bg-pink-800/50"
                          onClick={() => fetchLikes('wishlist', wishlist.id, wishlist.title)}
                        >
                          <Heart className="w-3 h-3" /> {wishlist.likes_count || 0}
                        </Badge>
                        {/* Comments */}
                        <Badge 
                          className="bg-blue-900/50 text-blue-300 text-xs flex items-center gap-1 cursor-pointer hover:bg-blue-800/50"
                          onClick={() => fetchComments('wishlist', wishlist.id, wishlist.title)}
                        >
                          💬 {wishlist.comments_count || 0}
                        </Badge>
                        {/* Event Date */}
                        {wishlist.event_date && (
                          <Badge className="bg-indigo-900/50 text-indigo-300 text-xs">
                            📅 {new Date(wishlist.event_date).toLocaleDateString()}
                          </Badge>
                        )}
                      </div>

                      {/* Wishlist ID */}
                      <div className="text-xs text-slate-500">
                        <code className="bg-slate-800 px-1 rounded">{wishlist.id.slice(0, 8)}...</code>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-slate-500 text-center py-8">No wishlists found</div>
                )}
              </div>
            </Card>

            {/* Selected Wishlist Items */}
            {selectedWishlist && (
              <Card className="p-4 bg-slate-800/50 border-slate-700">
                <h3 className="text-sm font-semibold text-slate-300 mb-4 flex items-center gap-2">
                  <Package className="w-4 h-4 text-blue-400" /> 
                  Items in "{selectedWishlist.title}" ({wishlistItems.length})
                </h3>
                <div className="space-y-3 max-h-[600px] overflow-y-auto">
                  {wishlistItems.length > 0 ? (
                    wishlistItems.map((item: any) => (
                      <div key={item.id} className="p-4 rounded-lg bg-slate-900/50 space-y-3">
                        {/* Item Header */}
                        <div className="flex items-start gap-3">
                          {item.image_url ? (
                            <img src={item.image_url} alt={item.title} className="w-16 h-16 rounded-lg object-cover" />
                          ) : (
                            <div className="w-16 h-16 rounded-lg bg-slate-700 flex items-center justify-center">
                              <Package className="w-6 h-6 text-slate-500" />
                            </div>
                          )}
                          <div className="flex-1">
                            <div className="flex items-center justify-between">
                              <div className="text-sm font-medium text-slate-200">{item.title || "Untitled"}</div>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-red-400 hover:text-red-300 hover:bg-red-950/50"
                                onClick={() => setDeleteItemDialog(item.id)}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                            {item.description && (
                              <div className="text-xs text-slate-500 mt-1 line-clamp-2">{item.description}</div>
                            )}
                            {item.brand && (
                              <div className="text-xs text-slate-400 mt-1">Brand: {item.brand}</div>
                            )}
                          </div>
                        </div>

                        {/* Item Stats Row */}
                        <div className="flex flex-wrap gap-2">
                          {/* Desire Level */}
                          {item.desire && (
                            <Badge className="bg-purple-900/50 text-purple-300 text-xs">
                              Desire: {item.desire}
                            </Badge>
                          )}
                          {/* Status */}
                          <Badge className={`text-xs ${item.status === 'claimed' ? 'bg-green-900/50 text-green-300' : item.status === 'reserved' ? 'bg-amber-900/50 text-amber-300' : 'bg-slate-700 text-slate-300'}`}>
                            {item.status || 'available'}
                          </Badge>
                          {/* Likes */}
                          <Badge 
                            className="bg-pink-900/50 text-pink-300 text-xs flex items-center gap-1 cursor-pointer hover:bg-pink-800/50"
                            onClick={() => fetchLikes('item', item.id, item.title)}
                          >
                            <Heart className="w-3 h-3" /> {item.likes_count || 0}
                          </Badge>
                          {/* Comments */}
                          <Badge 
                            className="bg-blue-900/50 text-blue-300 text-xs flex items-center gap-1 cursor-pointer hover:bg-blue-800/50"
                            onClick={() => fetchComments('item', item.id, item.title)}
                          >
                            💬 {item.comments_count || 0}
                          </Badge>
                        </div>

                        {/* Claimed/Reserved Info */}
                        {item.reservation && (
                          <div className="p-2 rounded bg-green-950/30 border border-green-900/50">
                            <div className="flex items-center gap-2">
                              <div className="text-xs text-green-400 font-medium">
                                {item.reservation.status === 'approved' ? '✓ Claimed' : item.reservation.status === 'pending' ? '⏳ Pending Approval' : item.reservation.status}
                              </div>
                              {item.reservation.is_anonymous ? (
                                <span className="text-xs text-slate-500">(Anonymous)</span>
                              ) : item.reserver ? (
                                <div className="flex items-center gap-1">
                                  <span className="text-xs text-slate-400">by</span>
                                  {item.reserver.avatar_url && (
                                    <img src={item.reserver.avatar_url} alt="" className="w-4 h-4 rounded-full" />
                                  )}
                                  <span className="text-xs text-slate-300">@{item.reserver.username || item.reserver.full_name}</span>
                                </div>
                              ) : null}
                            </div>
                            {item.reservation.approved_at && (
                              <div className="text-xs text-slate-500 mt-1">
                                Approved: {new Date(item.reservation.approved_at).toLocaleDateString()}
                              </div>
                            )}
                          </div>
                        )}

                        {/* Item ID & Added Date */}
                        <div className="flex items-center justify-between text-xs text-slate-500">
                          <code className="bg-slate-800 px-1 rounded">{item.id.slice(0, 8)}...</code>
                          {item.added_at && (
                            <span>Added: {new Date(item.added_at).toLocaleDateString()}</span>
                          )}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-slate-500 text-center py-8">No items in this wishlist</div>
                  )}
                </div>
              </Card>
            )}
          </TabsContent>
        )}
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

      {/* Delete Wishlist Confirmation Dialog */}
      <Dialog open={!!deleteWishlistDialog} onOpenChange={() => setDeleteWishlistDialog(null)}>
        <DialogContent className="bg-slate-900 border-red-900/50">
          <DialogHeader>
            <DialogTitle className="text-red-400 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5" /> Delete Wishlist
            </DialogTitle>
            <DialogDescription className="text-slate-400">
              This will permanently delete the wishlist and all its items. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDeleteWishlistDialog(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={deleteWishlist.isPending}
              onClick={() => deleteWishlistDialog && deleteWishlist.mutate(deleteWishlistDialog)}
            >
              {deleteWishlist.isPending ? "Deleting..." : "Delete Wishlist"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Wishlist Item Confirmation Dialog */}
      <Dialog open={!!deleteItemDialog} onOpenChange={() => setDeleteItemDialog(null)}>
        <DialogContent className="bg-slate-900 border-red-900/50">
          <DialogHeader>
            <DialogTitle className="text-red-400 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5" /> Delete Item
            </DialogTitle>
            <DialogDescription className="text-slate-400">
              This will permanently delete the item from the wishlist. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDeleteItemDialog(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={deleteWishlistItem.isPending}
              onClick={() => deleteItemDialog && deleteWishlistItem.mutate(deleteItemDialog)}
            >
              {deleteWishlistItem.isPending ? "Deleting..." : "Delete Item"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Comments Viewer Dialog */}
      <Dialog open={!!commentsDialog} onOpenChange={() => setCommentsDialog(null)}>
        <DialogContent className="bg-slate-900 border-slate-700 max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-slate-200 flex items-center gap-2">
              💬 Comments on "{commentsDialog?.title}"
            </DialogTitle>
            <DialogDescription className="text-slate-400">
              {commentsDialog?.type === 'wishlist' ? 'Wishlist' : 'Item'} comments
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-96 overflow-y-auto space-y-3 py-4">
            {commentsData.length > 0 ? (
              commentsData.map((comment: any) => (
                <div key={comment.id} className="p-3 rounded-lg bg-slate-800/50 space-y-2">
                  <div className="flex items-center gap-2">
                    {comment.user?.avatar_url ? (
                      <img src={comment.user.avatar_url} alt="" className="w-6 h-6 rounded-full" />
                    ) : (
                      <div className="w-6 h-6 rounded-full bg-slate-700 flex items-center justify-center">
                        <User className="w-3 h-3 text-slate-500" />
                      </div>
                    )}
                    <span className="text-sm font-medium text-slate-300">
                      @{comment.user?.username || comment.user?.full_name || 'Unknown'}
                    </span>
                    <span className="text-xs text-slate-500">
                      {new Date(comment.created_at).toLocaleString()}
                    </span>
                  </div>
                  <p className="text-sm text-slate-200 pl-8">{comment.content}</p>
                </div>
              ))
            ) : (
              <div className="text-slate-500 text-center py-8">No comments yet</div>
            )}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setCommentsDialog(null)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Likes Viewer Dialog */}
      <Dialog open={!!likesDialog} onOpenChange={() => setLikesDialog(null)}>
        <DialogContent className="bg-slate-900 border-slate-700 max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-slate-200 flex items-center gap-2">
              <Heart className="w-5 h-5 text-pink-400" /> Likes on "{likesDialog?.title}"
            </DialogTitle>
            <DialogDescription className="text-slate-400">
              {likesData.length} {likesData.length === 1 ? 'person' : 'people'} liked this {likesDialog?.type === 'wishlist' ? 'wishlist' : likesDialog?.type === 'product' ? 'product' : 'item'}
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-96 overflow-y-auto space-y-2 py-4">
            {likesData.length > 0 ? (
              likesData.map((like: any) => (
                <div key={like.id} className="flex items-center justify-between p-3 rounded-lg bg-slate-800/50">
                  <div className="flex items-center gap-3">
                    {like.user?.avatar_url ? (
                      <img src={like.user.avatar_url} alt="" className="w-8 h-8 rounded-full" />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center">
                        <User className="w-4 h-4 text-slate-500" />
                      </div>
                    )}
                    <div>
                      <span className="text-sm font-medium text-slate-300">
                        @{like.user?.username || like.user?.full_name || 'Unknown'}
                      </span>
                      {like.user?.full_name && like.user?.username && (
                        <div className="text-xs text-slate-500">{like.user.full_name}</div>
                      )}
                    </div>
                  </div>
                  <span className="text-xs text-slate-500">
                    {new Date(like.created_at).toLocaleDateString()}
                  </span>
                </div>
              ))
            ) : (
              <div className="text-slate-500 text-center py-8">No likes yet</div>
            )}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setLikesDialog(null)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Product Stats Viewer Dialog (Views, Questions, Wishlist Adds) */}
      <Dialog open={!!productStatsDialog} onOpenChange={() => setProductStatsDialog(null)}>
        <DialogContent className="bg-slate-900 border-slate-700 max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-slate-200 flex items-center gap-2">
              {productStatsDialog?.type === 'views' && '👁️ Views'}
              {productStatsDialog?.type === 'questions' && '❓ Questions'}
              {productStatsDialog?.type === 'adds' && '➕ Wishlist Adds'}
              {' on "'}{productStatsDialog?.productName}"
            </DialogTitle>
            <DialogDescription className="text-slate-400">
              {productStatsData.length} {productStatsDialog?.type === 'views' ? 'views' : productStatsDialog?.type === 'questions' ? 'questions' : 'wishlist adds'}
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-96 overflow-y-auto space-y-2 py-4">
            {productStatsData.length > 0 ? (
              productStatsData.map((item: any, index: number) => (
                <div key={item.id || index} className="p-3 rounded-lg bg-slate-800/50 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {item.user?.avatar_url ? (
                        <img src={item.user.avatar_url} alt="" className="w-8 h-8 rounded-full" />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center">
                          <User className="w-4 h-4 text-slate-500" />
                        </div>
                      )}
                      <div>
                        <span className="text-sm font-medium text-slate-300">
                          @{item.user?.username || item.user?.full_name || 'Unknown'}
                        </span>
                        {item.user?.full_name && item.user?.username && (
                          <div className="text-xs text-slate-500">{item.user.full_name}</div>
                        )}
                      </div>
                    </div>
                    <span className="text-xs text-slate-500">
                      {new Date(item.viewed_at || item.created_at || item.added_at).toLocaleString()}
                    </span>
                  </div>
                  
                  {/* Extra info based on type */}
                  {productStatsDialog?.type === 'views' && item.source && (
                    <div className="text-xs text-slate-500 pl-11">
                      Source: {item.source}
                    </div>
                  )}
                  {productStatsDialog?.type === 'questions' && (
                    <div className="pl-11 space-y-1">
                      <div className="text-sm text-slate-200">Q: {item.question}</div>
                      {item.answer && (
                        <div className="text-sm text-green-400">A: {item.answer}</div>
                      )}
                      <Badge className={item.status === 'answered' ? 'bg-green-900/50 text-green-300' : 'bg-amber-900/50 text-amber-300'}>
                        {item.status || 'pending'}
                      </Badge>
                    </div>
                  )}
                  {productStatsDialog?.type === 'adds' && item.wishlist_title && (
                    <div className="text-xs text-slate-500 pl-11">
                      Added to: "{item.wishlist_title}"
                    </div>
                  )}
                </div>
              ))
            ) : (
              <div className="text-slate-500 text-center py-8">
                No {productStatsDialog?.type === 'views' ? 'views' : productStatsDialog?.type === 'questions' ? 'questions' : 'wishlist adds'} yet
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setProductStatsDialog(null)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminUserDetail;
