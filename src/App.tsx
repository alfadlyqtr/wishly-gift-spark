import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { Suspense, lazy, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { NativelyProvider } from "@/hooks/use-natively";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { MainLayout } from "./components/MainLayout";
import { BrandLayout } from "./components/BrandLayout";
import AdminGate from "./components/AdminGate";
const HomePage = lazy(() => import("./pages/HomePage"));
const PrivacyTerms = lazy(() => import("./pages/PrivacyTerms"));
const Contact = lazy(() => import("./pages/Contact"));
const Login = lazy(() => import("./pages/Login"));
const Signup = lazy(() => import("./pages/Signup"));
const SignupChooser = lazy(() => import("./pages/SignupChooser"));
const BusinessSignup = lazy(() => import("./pages/BusinessSignup"));
const ForgotPassword = lazy(() => import("./pages/ForgotPassword"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Explore = lazy(() => import("./pages/Explore"));
const Events = lazy(() => import("./pages/Events"));
const Profile = lazy(() => import("./pages/Profile"));
const FollowersFollowing = lazy(() => import("./pages/FollowersFollowing"));
const WishlistDetail = lazy(() => import("./pages/WishlistDetail"));
const ShortWishRedirect = lazy(() => import("./pages/ShortWishRedirect"));
const Wishlists = lazy(() => import("./pages/Wishlists"));
const Settings = lazy(() => import("./pages/Settings"));
const Messages = lazy(() => import("./pages/Messages"));
const Chat = lazy(() => import("./pages/Chat"));
const Notifications = lazy(() => import("./pages/Notifications"));
const BrandNotifications = lazy(() => import("./pages/BrandNotifications"));
const BrandDashboard = lazy(() => import("./pages/BrandDashboard"));
const DebugDashboard = lazy(() => import("./pages/DebugDashboard"));
const BrandProfile = lazy(() => import("./pages/BrandProfile"));
const BrandProducts = lazy(() => import("./pages/BrandProducts"));
const BrandProductDetail = lazy(() => import("./pages/BrandProductDetail"));
const BrandInsights = lazy(() => import("./pages/BrandInsights"));
const BrandFollowers = lazy(() => import("./pages/BrandFollowers"));
const BrandFollowing = lazy(() => import("./pages/BrandFollowing"));
const PublicBrandProfile = lazy(() => import("./pages/PublicBrandProfile"));
const BrandsFollowing = lazy(() => import("./pages/BrandsFollowing"));
const StoreProfile = lazy(() => import("./pages/StoreProfile"));
const NotFound = lazy(() => import("./pages/NotFound"));
const Goodbye = lazy(() => import("./pages/Goodbye"));
const AdminDashboard = lazy(() => import("./pages/AdminDashboard"));
const AdminUsers = lazy(() => import("./pages/AdminUsers"));
const AdminUserDetail = lazy(() => import("./pages/AdminUserDetail"));
const AdminSupportMessages = lazy(() => import("./pages/AdminSupportMessages"));
const AdminContactInbox = lazy(() => import("./pages/AdminContactInbox"));
const AdminAIUsage = lazy(() => import("./pages/AdminAIUsage"));
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      gcTime: 10 * 60_000,
      refetchOnWindowFocus: false,
      refetchOnReconnect: true,
      retry: (failureCount) => failureCount < 2,
    },
    mutations: {
      retry: 0,
    },
  },
});

const LocaleController = ({ children }: { children: React.ReactNode }) => {
  const location = useLocation();
  const { i18n } = useTranslation();
  const lastNonAdminLangRef = useRef<string | null>(null);

  useEffect(() => {
    const isAdmin = location.pathname.startsWith("/mqtr");
    const currentLang = i18n.language || "en";

    if (isAdmin) {
      if (currentLang !== "en") {
        lastNonAdminLangRef.current = currentLang;
        i18n.changeLanguage("en");
      }
    } else if (lastNonAdminLangRef.current && currentLang === "en") {
      const restoreLang = lastNonAdminLangRef.current;
      lastNonAdminLangRef.current = null;
      i18n.changeLanguage(restoreLang);
    }
  }, [i18n, i18n.language, location.pathname]);

  useEffect(() => {
    const isAdmin = location.pathname.startsWith("/mqtr");
    const effectiveLang = isAdmin ? "en" : i18n.language || "en";

    document.documentElement.lang = effectiveLang;
    document.documentElement.dir = effectiveLang === "ar" ? "rtl" : "ltr";
  }, [i18n.language, location.pathname]);

  return <>{children}</>;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <NativelyProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner
          position="top-center"
          duration={6000}
          closeButton
          richColors
        />
        <BrowserRouter>
          <LocaleController>
            <Suspense fallback={null}>
              <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="/login" element={<Login />} />
              <Route path="/contact" element={<Contact />} />
              <Route path="/privacy" element={<PrivacyTerms />} />
              <Route path="/signup" element={<SignupChooser />} />
              <Route path="/signup/user" element={<Signup />} />
              <Route path="/signup/business" element={<BusinessSignup />} />
              <Route path="/forgot-password" element={<ForgotPassword />} />
              <Route path="/goodbye" element={<Goodbye />} />
              <Route path="/w/:id" element={<ShortWishRedirect />} />
              <Route path="/brand/:id" element={<PublicBrandProfile />} />

              <Route path="/mqtr" element={<AdminGate />}>
                <Route index element={<AdminDashboard />} />
                <Route path="users" element={<AdminUsers />} />
                <Route path="users/:userId" element={<AdminUserDetail />} />
                <Route path="support-messages" element={<AdminSupportMessages />} />
                <Route path="contact" element={<AdminContactInbox />} />
                <Route path="ai-usage" element={<AdminAIUsage />} />
              </Route>

              <Route
                element={
                  <ProtectedRoute mode="personal">
                    <MainLayout />
                  </ProtectedRoute>
                }
              >
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/explore" element={<Explore />} />
                <Route path="/events" element={<Events />} />
                <Route path="/wishlist/:id" element={<WishlistDetail />} />
                <Route path="/profile" element={<Profile />} />
                <Route path="/followers" element={<FollowersFollowing />} />
                <Route path="/brands-following" element={<BrandsFollowing />} />
                <Route path="/store/:id" element={<StoreProfile />} />
                <Route path="/wishlists" element={<Wishlists />} />
                <Route path="/settings" element={<Settings />} />
                <Route path="/messages" element={<Messages />} />
                <Route path="/chat/:id" element={<Chat />} />
                <Route path="/notifications" element={<Notifications />} />
              </Route>

              <Route
                element={
                  <ProtectedRoute mode="business">
                    <BrandLayout />
                  </ProtectedRoute>
                }
              >
                <Route path="/brand/dashboard" element={<BrandDashboard />} />
                {import.meta.env.DEV && (
                  <Route path="/brand/debug" element={<DebugDashboard />} />
                )}
                <Route path="/brand/profile" element={<BrandProfile />} />
                <Route path="/brand/followers" element={<BrandFollowers />} />
                <Route path="/brand/following" element={<BrandFollowing />} />
                <Route path="/brand/products" element={<BrandProducts />} />
                <Route path="/brand/products/:id" element={<BrandProductDetail />} />
                <Route path="/brand/explore" element={<Explore />} />
                <Route path="/brand/messages" element={<Messages />} />
                <Route path="/brand/chat/:id" element={<Chat />} />
                <Route path="/brand/notifications" element={<BrandNotifications />} />
              </Route>

              <Route path="*" element={<NotFound />} />
              </Routes>
            </Suspense>
          </LocaleController>
        </BrowserRouter>
      </TooltipProvider>
    </NativelyProvider>
  </QueryClientProvider>
);

export default App;
