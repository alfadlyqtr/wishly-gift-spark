import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, Link } from "react-router-dom";
import { toast } from "sonner";

// UI Components
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { LanguageToggle } from "@/components/LanguageToggle";

// Branding
import wishlyLogo from "@/assets/wishly-logo.png";

// Supabase Client (use the existing centralized client used across the app)
import { supabase } from "@/integrations/supabase/client";

/**
 * ForgotPassword Page
 * - Mirrors Login/Signup layout and styling
 * - Uses LanguageToggle for i18n switching
 * - Sends password reset email using Supabase Auth
 * - Uses sonner toast for success/error feedback
 */
const ForgotPassword = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const redirectUrl = `${window.location.origin}/login`;

      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: redirectUrl,
      });

      if (error) {
        toast.error(error.message);
      } else {
        toast.success(t("auth.forgot_password_success", "Password reset email sent. Please check your inbox."));
        navigate("/login");
      }
    } catch (err: any) {
      toast.error(err?.message ?? "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-brand-cool-start via-background to-brand-warm-start p-4">
      {/* Language toggle in the same spot as Login/Signup */}
      <div className="absolute top-4 right-4">
        <LanguageToggle />
      </div>

      <Card className="w-full max-w-md shadow-xl">
        <CardHeader className="space-y-4 text-center">
          <Link to="/" className="mx-auto w-32">
            <img src={wishlyLogo} alt="Wishly" className="w-full" />
          </Link>
          <CardTitle className="text-2xl font-bold">{t("auth.forgot_password_title")}</CardTitle>
          <CardDescription>
            {t("auth.forgot_password_subtitle", "Enter your email and we'll send you a reset link.")}
          </CardDescription>
        </CardHeader>

        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">{t("auth.email")}</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
          </CardContent>

          <CardFooter className="flex flex-col space-y-4">
            <Button
              type="submit"
              className="w-full bg-gradient-to-r from-brand-warm-start to-brand-warm-end text-white hover:opacity-90"
              disabled={loading}
            >
              {loading ? t("auth.forgot_password_button") + "..." : t("auth.forgot_password_button")}
            </Button>

            <p className="text-center text-sm text-muted-foreground">
              <Link to="/login" className="font-semibold text-primary hover:underline">
                {t("auth.back_to_login", "Back to login")}
              </Link>
            </p>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
};

export default ForgotPassword;
