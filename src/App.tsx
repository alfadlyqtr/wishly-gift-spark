import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { MainLayout } from "./components/MainLayout";
import { BrandLayout } from "./components/BrandLayout";
import HomePage from "./pages/HomePage";
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
import BrandDashboard from "./pages/BrandDashboard";
import BrandProfile from "./pages/BrandProfile";
import BrandProducts from "./pages/BrandProducts";
import BrandProductDetail from "./pages/BrandProductDetail";
import BrandInsights from "./pages/BrandInsights";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

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
        <Routes>
          {/* Public routes */}
          <Route path="/" element={<HomePage />} />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<SignupChooser />} />
          <Route path="/signup/user" element={<Signup />} />
          <Route path="/signup/business" element={<BusinessSignup />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          {/* Short redirect link for public share (
             keeps public entrypoint; authenticated users will typically use
             the in-app route below which has the full MainLayout chrome. */}
          <Route path="/w/:id" element={<ShortWishRedirect />} />

          {/* Authenticated app shell */}
          <Route
            element={
              <ProtectedRoute>
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
            <Route path="/wishlists" element={<Wishlists />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/messages" element={<Messages />} />
            <Route path="/chat/:id" element={<Chat />} />
            <Route path="/notifications" element={<Notifications />} />
          </Route>

          {/* Brand / business app shell - separate layout */}
          <Route
            element={
              <ProtectedRoute>
                <BrandLayout />
              </ProtectedRoute>
            }
          >
            <Route path="/brand/dashboard" element={<BrandDashboard />} />
            <Route path="/brand/profile" element={<BrandProfile />} />
            <Route path="/brand/products" element={<BrandProducts />} />
            <Route path="/brand/products/:id" element={<BrandProductDetail />} />
            <Route path="/brand/insights" element={<BrandInsights />} />
          </Route>

          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
