import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { User2, Store } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { LanguageToggle } from "@/components/LanguageToggle";
import wishlyLogo from "@/assets/wishly-logo.png";

const SignupChooser = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-brand-cool-start via-background to-brand-warm-start p-4">
      <div className="absolute top-4 right-4">
        <LanguageToggle />
      </div>

      <Card className="w-full max-w-2xl shadow-[0_22px_60px_rgba(15,23,42,0.45)] border border-white/60 bg-gradient-to-br from-white/95 via-white/90 to-white/80 backdrop-blur">
        <CardHeader className="space-y-4 text-center">
          <Link to="/" className="mx-auto w-32">
            <img src={wishlyLogo} alt="Wishly" className="w-full" />
          </Link>
          <CardTitle className="text-2xl font-bold">
            {t("auth.choose_account_title", "Choose account type")}
          </CardTitle>
          <CardDescription>
            {t("auth.choose_account_subtitle", "How do you want to use Wishly?")}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-5 md:grid-cols-2">
            <button
              type="button"
              className="flex flex-col justify-between rounded-2xl bg-gradient-to-r from-[hsl(var(--brand-cool-start))] via-[hsl(var(--brand-cool-end))] to-[hsl(var(--brand-warm-end))] p-[2px] text-left shadow-sm hover:shadow-xl transition-all hover:-translate-y-0.5"
              onClick={() => navigate("/signup/user")}
            >
              <div className="space-y-2 rounded-2xl bg-gradient-to-br from-white/95 via-white/90 to-white/95 p-4">
                <div className="inline-flex items-center rounded-full bg-primary/10 px-3 py-1 text-[11px] font-semibold text-primary shadow-sm">
                  {t("auth.choose_account_user_badge", "For individuals")}
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-brand-cool-start/20 to-brand-warm-start/30 text-primary shadow-[0_0_0_1px_rgba(148,163,184,0.45)]">
                    <User2 className="h-5 w-5" aria-hidden />
                  </div>
                  <h2 className="text-lg font-semibold">
                    {t("auth.choose_account_user_title", "Personal account")}
                  </h2>
                </div>
                <p className="text-sm text-muted-foreground">
                  {t(
                    "auth.choose_account_user_body",
                    "Create wishlists, share them with friends, and track your gifts.",
                  )}
                </p>
                <ul className="mt-2 space-y-1 text-xs text-muted-foreground list-disc list-inside">
                  <li>{t("auth.choose_account_user_point1", "Save items from any store")}</li>
                  <li>{t("auth.choose_account_user_point2", "See what friends claim")}</li>
                  <li>{t("auth.choose_account_user_point3", "Perfect for birthdays and occasions")}</li>
                </ul>
              </div>
              <div className="mt-4 px-4 pb-4">
                <Button
                  variant="default"
                  className="w-full bg-gradient-to-r from-brand-warm-start to-brand-warm-end text-white shadow-[0_10px_25px_rgba(15,23,42,0.45)] hover:brightness-110 hover:-translate-y-0.5 transition-transform"
                >
                  {t("auth.choose_account_user_cta", "Continue as user")}
                </Button>
              </div>
            </button>

            <button
              type="button"
              className="flex flex-col justify-between rounded-2xl bg-gradient-to-r from-[hsl(var(--brand-cool-start))] via-[hsl(var(--brand-cool-end))] to-[hsl(var(--brand-warm-end))] p-[2px] text-left shadow-sm hover:shadow-xl transition-all hover:-translate-y-0.5"
              onClick={() => navigate("/signup/business")}
            >
              <div className="space-y-2 rounded-2xl bg-white/95 p-4">
                <div className="inline-flex items-center rounded-full bg-primary/10 px-3 py-1 text-[11px] font-semibold text-primary shadow-sm">
                  {t("auth.choose_account_business_badge", "For brands & stores")}
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-brand-cool-start/20 to-brand-warm-start/30 text-primary shadow-[0_0_0_1px_rgba(148,163,184,0.45)]">
                    <Store className="h-5 w-5" aria-hidden />
                  </div>
                  <h2 className="text-lg font-semibold">
                    {t("auth.choose_account_business_title", "Business account")}
                  </h2>
                </div>
                <p className="text-sm text-muted-foreground">
                  {t(
                    "auth.choose_account_business_body",
                    "Show your products on Wishly and understand how users interact.",
                  )}
                </p>
                <ul className="mt-2 space-y-1 text-xs text-muted-foreground list-disc list-inside">
                  <li>{t("auth.choose_account_business_point1", "Add and manage your product catalogue")}</li>
                  <li>{t("auth.choose_account_business_point2", "See saves, clicks, and wishlist stats")}</li>
                  <li>{t("auth.choose_account_business_point3", "Get insights about gift shoppers")}</li>
                </ul>
              </div>
              <div className="mt-4 px-4 pb-4">
                <Button
                  variant="outline"
                  className="w-full border-primary/40 text-primary hover:bg-primary/10 hover:text-primary shadow-[0_8px_20px_rgba(15,23,42,0.25)] hover:-translate-y-0.5 transition-transform"
                >
                  {t("auth.choose_account_business_cta", "Continue as business")}
                </Button>
              </div>
            </button>
          </div>

          <div className="text-center text-sm text-muted-foreground">
            {t("auth.have_account")} {" "}
            <Link to="/login" className="font-semibold text-primary hover:underline">
              {t("auth.sign_in")}
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default SignupChooser;
