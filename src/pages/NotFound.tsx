import { useLocation, Link } from "react-router-dom";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";

const NotFound = () => {
  const location = useLocation();
  const { t } = useTranslation();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-brand-cool-start via-background to-brand-warm-start">
      <div className="text-center px-4">
        <h1 className="mb-4 text-6xl font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-[hsl(var(--brand-cool-start))] via-[hsl(var(--brand-cool-end))] to-[hsl(var(--brand-warm-end))]">
          404
        </h1>
        <p className="mb-6 text-xl text-muted-foreground">
          {t("notfound.message", "Oops! Page not found")}
        </p>
        <Link
          to="/"
          className="inline-flex items-center justify-center rounded-full bg-gradient-to-r from-[hsl(var(--brand-cool-start))] to-[hsl(var(--brand-warm-end))] px-6 py-2.5 text-sm font-semibold text-white shadow-lg hover:brightness-110 transition"
        >
          {t("notfound.return_home", "Return to Home")}
        </Link>
      </div>
    </div>
  );
};

export default NotFound;
