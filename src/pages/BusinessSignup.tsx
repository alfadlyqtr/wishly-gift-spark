import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { LanguageToggle } from "@/components/LanguageToggle";
import { toast } from "sonner";
import wishlyLogo from "@/assets/wishly-logo.png";

const BusinessSignup = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [brandName, setBrandName] = useState("");
  const [website, setWebsite] = useState("https://");
  const [country, setCountry] = useState("");
  const [category, setCategory] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        navigate("/dashboard");
      }
    });
  }, [navigate]);

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    if (password !== confirmPassword) {
      setLoading(false);
      toast.error(t("auth.password_mismatch", "Passwords do not match"));
      return;
    }

    const redirectUrl = `${window.location.origin}/brand/dashboard`;

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
        data: {
          full_name: fullName,
          account_type: "business",
          brand_name: brandName,
          brand_website: website,
          brand_country: country,
          brand_category: category,
        },
      },
    });

    if (error) {
      toast.error(error.message);
    } else {
      toast.success(t("auth.business_signup_success", "Business account created! Please check your email to confirm."));
      navigate("/login");
    }

    setLoading(false);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-brand-cool-start via-background to-brand-warm-start p-4">
      <div className="absolute top-4 right-4">
        <LanguageToggle />
      </div>
      <Card className="w-full max-w-md shadow-xl">
        <CardHeader className="space-y-4 text-center">
          <div className="flex items-center justify-between">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="-ml-2 text-xs text-muted-foreground hover:text-foreground"
              onClick={() => navigate("/signup")}
            >
              <ArrowLeft className="mr-1 h-4 w-4" aria-hidden />
              {t("auth.back_to_account_type", "Back")}
            </Button>
            <div className="flex-1" />
          </div>
          <Link to="/" className="mx-auto w-32">
            <img src={wishlyLogo} alt="Wishly" className="w-full" />
          </Link>
          <CardTitle className="text-2xl font-bold">
            {t("auth.business_signup_title", "Create Business Account")}
          </CardTitle>
          <CardDescription>
            {t("auth.business_signup_subtitle", "Set up your brand on Wishly.")}
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleSignup}>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="fullName">{t("auth.business_manager_name", "Manager name")}<span className="text-red-500 ml-0.5">*</span></Label>
              <Input
                id="fullName"
                type="text"
                placeholder={t("auth.business_manager_name_placeholder", "Manager name")}
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="brandName">{t("auth.brand_name", "Brand name")}<span className="text-red-500 ml-0.5">*</span></Label>
              <Input
                id="brandName"
                type="text"
                placeholder={t("auth.brand_name_placeholder", "Wishly Gifts")}
                value={brandName}
                onChange={(e) => setBrandName(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="website">{t("auth.brand_website", "Website / Store URL")}</Label>
              <Input
                id="website"
                type="url"
                placeholder={t("auth.brand_website_placeholder", "https://yourstore.com")}
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="country">{t("auth.country", "Country/Region")}</Label>
              <Input
                id="country"
                type="text"
                placeholder={t("auth.country_placeholder", "Qatar")}
                value={country}
                onChange={(e) => setCountry(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="category">{t("auth.brand_category", "Brand category")}<span className="text-red-500 ml-0.5">*</span></Label>
              <Input
                id="category"
                type="text"
                placeholder={t("auth.brand_category_placeholder", "Electronics, Gifts, Fashion...")}
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">{t("auth.email")}<span className="text-red-500 ml-0.5">*</span></Label>
              <Input
                id="email"
                type="email"
                placeholder={t("auth.email_placeholder", "you@example.com")}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">{t("auth.password")}<span className="text-red-500 ml-0.5">*</span></Label>
              <Input
                id="password"
                type="password"
                placeholder={t("auth.password_placeholder", "••••••••")}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">{t("auth.confirm_password", "Confirm password")}<span className="text-red-500 ml-0.5">*</span></Label>
              <Input
                id="confirmPassword"
                type="password"
                placeholder={t("auth.password_placeholder", "••••••••")}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength={6}
              />
            </div>
          </CardContent>
          <CardFooter className="flex flex-col space-y-4">
            <Button
              type="submit"
              className="w-full bg-gradient-to-r from-brand-warm-start to-brand-warm-end text-white hover:opacity-90"
              disabled={loading}
            >
              {loading
                ? t("auth.business_signup_button", "Create business account") + "..."
                : t("auth.business_signup_button", "Create business account")}
            </Button>
            <p className="text-center text-sm text-muted-foreground">
              {t("auth.have_account")} {" "}
              <Link to="/login" className="font-semibold text-primary hover:underline">
                {t("auth.sign_in")}
              </Link>
            </p>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
};

export default BusinessSignup;
