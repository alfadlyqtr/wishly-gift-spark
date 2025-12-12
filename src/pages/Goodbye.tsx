import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import wishlyLogo from "@/assets/wishly-logo.png";

const Goodbye = () => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const [countdown, setCountdown] = useState(15);

  useEffect(() => {
    if (countdown <= 0) {
      navigate("/");
      return;
    }
    const timer = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [countdown, navigate]);

  const isArabic = i18n.language === "ar";

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-6 py-12 bg-gradient-to-br from-brand-cool-start via-background to-brand-warm-start"
      dir={isArabic ? "rtl" : "ltr"}
    >
      <div className="flex flex-col items-center text-center space-y-6 max-w-md">
        <img src={wishlyLogo} alt="Wishly" className="w-28 h-28 drop-shadow-lg" />

        <h1 className="text-3xl sm:text-4xl font-extrabold bg-gradient-to-r from-[hsl(var(--brand-cool-start))] via-[hsl(var(--brand-cool-end))] to-[hsl(var(--brand-warm-end))] bg-clip-text text-transparent">
          {isArabic ? "وداعاً 👋" : "Goodbye 👋"}
        </h1>

        <p className="text-lg text-muted-foreground">
          {isArabic
            ? "سنفتقدك! نتمنى لك كل التوفيق."
            : "We'll miss you! Wishing you all the best."}
        </p>

        <p className="text-sm text-muted-foreground/80">
          {isArabic
            ? "تم حذف حسابك بنجاح. شكراً لاستخدامك Wishly."
            : "Your account has been successfully deleted. Thank you for using Wishly."}
        </p>

        <div className="mt-8 flex flex-col items-center gap-2">
          <div className="relative w-20 h-20 flex items-center justify-center">
            <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 100 100">
              <circle
                cx="50"
                cy="50"
                r="45"
                fill="none"
                stroke="currentColor"
                strokeWidth="6"
                className="text-muted/20"
              />
              <circle
                cx="50"
                cy="50"
                r="45"
                fill="none"
                stroke="url(#gradient)"
                strokeWidth="6"
                strokeLinecap="round"
                strokeDasharray={2 * Math.PI * 45}
                strokeDashoffset={2 * Math.PI * 45 * (1 - countdown / 15)}
                className="transition-all duration-1000 ease-linear"
              />
              <defs>
                <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="hsl(var(--brand-cool-start))" />
                  <stop offset="50%" stopColor="hsl(var(--brand-cool-end))" />
                  <stop offset="100%" stopColor="hsl(var(--brand-warm-end))" />
                </linearGradient>
              </defs>
            </svg>
            <span className="text-2xl font-bold text-foreground">{countdown}</span>
          </div>
          <p className="text-xs text-muted-foreground">
            {isArabic
              ? "سيتم توجيهك للصفحة الرئيسية..."
              : "Redirecting to home..."}
          </p>
        </div>
      </div>
    </div>
  );
};

export default Goodbye;
