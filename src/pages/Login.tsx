import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { LanguageToggle } from "@/components/LanguageToggle";
import wishlyLogo from "@/assets/wishly-logo.png";

const Login = () => {
  const { t } = useTranslation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        navigate("/dashboard");
      }
    });
  }, [navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      toast.error(error.message);
    } else {
      const accountType = data?.user?.user_metadata?.account_type;
      toast.success(t('auth.login_success', 'Welcome back!'));
      if (accountType === "business") {
        navigate("/brand/dashboard");
      } else {
        navigate("/dashboard");
      }
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
          <Link to="/" className="mx-auto w-32">
            <img src={wishlyLogo} alt="Wishly" className="w-full" />
          </Link>
          <CardTitle className="text-2xl font-bold">{t('auth.login_title')}</CardTitle>
          <CardDescription>{t('auth.login_subtitle')}</CardDescription>
        </CardHeader>
        <form onSubmit={handleLogin}>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">{t('auth.email')}</Label>
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
              <Label htmlFor="password">{t('auth.password')}</Label>
              <Input
                id="password"
                type="password"
                placeholder={t('auth.password_placeholder', '••••••••')}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
          </CardContent>
          <CardFooter className="flex flex-col space-y-4">
            <p className="text-center text-sm text-muted-foreground">
              <Link to="/forgot-password" className="font-semibold text-primary hover:underline">
                {t('auth.forgot_password_title')}
              </Link>
            </p>
            <Button type="submit" className="w-full bg-gradient-to-r from-brand-warm-start to-brand-warm-end text-white hover:opacity-90" disabled={loading}>
              {loading ? t('auth.login_button') + "..." : t('auth.login_button')}
            </Button>
            <p className="text-center text-sm text-muted-foreground">
              {t('auth.no_account')}{" "}
              <Link to="/signup" className="font-semibold text-primary hover:underline">
                {t('auth.sign_up')}
              </Link>
            </p>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
};

export default Login;
