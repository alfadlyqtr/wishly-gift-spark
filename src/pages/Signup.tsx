import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { LanguageToggle } from "@/components/LanguageToggle";
import wishlyLogo from "@/assets/wishly-logo.png";

const Signup = () => {
  const { t } = useTranslation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [fullName, setFullName] = useState("");
  const [dob, setDob] = useState("");
  const [country, setCountry] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

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

    const redirectUrl = `${window.location.origin}/dashboard`;

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
        data: {
          username: username,
          full_name: fullName,
          dob: dob,
          country: country,
          account_type: "user",
        },
      },
    });

    if (error) {
      toast.error(error.message);
    } else {
      toast.success(t('auth.signup_success', 'Account created! Please check your email to confirm.'));
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
          <CardTitle className="text-2xl font-bold">{t('auth.signup_title')}</CardTitle>
          <CardDescription>{t('auth.signup_subtitle')}</CardDescription>
        </CardHeader>
        <form onSubmit={handleSignup}>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="username">{t('auth.username')}<span className="text-red-500 ml-0.5">*</span></Label>
              <Input
                id="username"
                type="text"
                placeholder={t('auth.username_placeholder', 'johndoe')}
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                minLength={3}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="fullName">{t('auth.full_name')}<span className="text-red-500 ml-0.5">*</span></Label>
              <Input
                id="fullName"
                type="text"
                placeholder={t('auth.full_name_placeholder', 'John Doe')}
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="dob">{t('auth.dob')}</Label>
              <Input
                id="dob"
                type="date"
                value={dob}
                onChange={(e) => setDob(e.target.value)}
                max={new Date().toISOString().split('T')[0]}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="country">{t('auth.country', 'Country/Region')}</Label>
              <Input
                id="country"
                type="text"
                placeholder={t('auth.country_placeholder', 'Qatar')}
                value={country}
                onChange={(e) => setCountry(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">{t('auth.email')}<span className="text-red-500 ml-0.5">*</span></Label>
              <Input
                id="email"
                type="email"
                placeholder={t('auth.email_placeholder', 'you@example.com')}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">{t('auth.password')}<span className="text-red-500 ml-0.5">*</span></Label>
              <Input
                id="password"
                type="password"
                placeholder={t('auth.password_placeholder', '••••••••')}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
              />
              <p className="text-xs text-muted-foreground">
                {t('auth.password_helper', 'At least 6 characters')}
              </p>
            </div>
          </CardContent>
          <CardFooter className="flex flex-col space-y-4">
            <Button type="submit" className="w-full bg-gradient-to-r from-brand-warm-start to-brand-warm-end text-white hover:opacity-90" disabled={loading}>
              {loading ? t('auth.signup_button') + "..." : t('auth.signup_button')}
            </Button>
            <p className="text-center text-sm text-muted-foreground">
              {t('auth.have_account')}{" "}
              <Link to="/login" className="font-semibold text-primary hover:underline">
                {t('auth.sign_in')}
              </Link>
            </p>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
};

export default Signup;
