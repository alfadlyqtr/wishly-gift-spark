import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { MainLayout } from "./components/MainLayout";
import { BrandLayout } from "./components/BrandLayout";
import AdminLayout from "./components/AdminLayout";
import AdminGate from "./components/AdminGate";
import HomePage from "./pages/HomePage";
import PrivacyTerms from "./pages/PrivacyTerms";
import Contact from "./pages/Contact";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import SignupChooser from "./pages/SignupChooser";
import BusinessSignup from "./pages/BusinessSignup";
import ForgotPassword from "./pages/ForgotPassword";
import Dashboard from "./pages/Dashboard";
import Explore from "./pages/Explore";
import Events from "./pages/Events";
import Profile from "./pages/Profile";
import FollowersFollowing from "./pages/FollowersFollowing";
import WishlistDetail from "./pages/WishlistDetail";
import ShortWishRedirect from "./pages/ShortWishRedirect";
import Wishlists from "./pages/Wishlists";
import Settings from "./pages/Settings";
import Messages from "./pages/Messages";
import Chat from "./pages/Chat";
import Notifications from "./pages/Notifications";
import BrandNotifications from "./pages/BrandNotifications";
import BrandDashboard from "./pages/BrandDashboard";
import DebugDashboard from "./pages/DebugDashboard";
import BrandProfile from "./pages/BrandProfile";
import BrandProducts from "./pages/BrandProducts";
import BrandProductDetail from "./pages/BrandProductDetail";
import BrandInsights from "./pages/BrandInsights";
import BrandFollowers from "./pages/BrandFollowers";
import BrandFollowing from "./pages/BrandFollowing";
import PublicBrandProfile from "./pages/PublicBrandProfile";
import BrandsFollowing from "./pages/BrandsFollowing";
import NotFound from "./pages/NotFound";
import Goodbye from "./pages/Goodbye";
import AdminDashboard from "./pages/AdminDashboard";
import AdminUsers from "./pages/AdminUsers";
import AdminUserDetail from "./pages/AdminUserDetail";
import AdminSupportMessages from "./pages/AdminSupportMessages";
import AdminContactInbox from "./pages/AdminContactInbox";
import AdminAIUsage from "./pages/AdminAIUsage";

const queryClient = new QueryClient();

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
          <Routes>
            {/* Public routes */}
            <Route path="/" element={<HomePage />} />
            <Route path="/login" element={<Login />} />
            <Route path="/contact" element={<Contact />} />
            <Route path="/privacy" element={<PrivacyTerms />} />
            <Route path="/signup" element={<SignupChooser />} />
            <Route path="/signup/user" element={<Signup />} />
            <Route path="/signup/business" element={<BusinessSignup />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/goodbye" element={<Goodbye />} />
            {/* Short redirect link for public share (
               keeps public entrypoint; authenticated users will typically use
               the in-app route below which has the full MainLayout chrome. */}
            <Route path="/w/:id" element={<ShortWishRedirect />} />
            {/* Public brand profile */}
            <Route path="/brand/:id" element={<PublicBrandProfile />} />

            {/* Superadmin entrypoint */}
            <Route
              path="/mqtr"
              element={<AdminGate />}
            >
              <Route index element={<AdminDashboard />} />
              <Route path="users" element={<AdminUsers />} />
              <Route path="users/:userId" element={<AdminUserDetail />} />
              <Route path="support-messages" element={<AdminSupportMessages />} />
              <Route path="contact" element={<AdminContactInbox />} />
              <Route path="ai-usage" element={<AdminAIUsage />} />
            </Route>

            {/* Authenticated app shell - personal users */}
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
              <Route path="/wishlists" element={<Wishlists />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="/messages" element={<Messages />} />
              <Route path="/chat/:id" element={<Chat />} />
              <Route path="/notifications" element={<Notifications />} />
            </Route>

            {/* Brand / business app shell - separate layout */}
            <Route
              element={
                <ProtectedRoute mode="business">
                  <BrandLayout />
                </ProtectedRoute>
              }
            >
              <Route path="/brand/dashboard" element={<BrandDashboard />} />
              <Route path="/brand/debug" element={<DebugDashboard />} />
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
        </LocaleController>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
