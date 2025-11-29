import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

const BrandDashboard = () => {
  const { t } = useTranslation();

  return (
    <div className="p-4 md:p-6 space-y-4">
      <Card className="shadow-lg border border-white/40 bg-gradient-to-br from-white/95 via-white/90 to-white/80">
        <CardHeader>
          <CardTitle className="text-2xl font-bold">
            {t("brand.dashboard_title", "Brand dashboard")}
          </CardTitle>
          <CardDescription>
            {t("brand.dashboard_subtitle", "High-level view of how your brand is performing on Wishly.")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            {t(
              "brand.dashboard_placeholder",
              "Here you will see key stats like saves, clicks, top products, and recent activity.",
            )}
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default BrandDashboard;
