import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

const BrandInsights = () => {
  const { t } = useTranslation();

  return (
    <div className="p-4 md:p-6 space-y-4">
      <Card className="shadow-lg border border-white/40 bg-gradient-to-br from-white/95 via-white/90 to-white/80">
        <CardHeader>
          <CardTitle className="text-2xl font-bold">
            {t("brand.insights_title", "Insights & analytics")}
          </CardTitle>
          <CardDescription>
            {t("brand.insights_subtitle", "Understand how Wishly users engage with your brand.")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            {t(
              "brand.insights_placeholder",
              "This page will later show charts for saves, clicks, top products, and audience breakdowns.",
            )}
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default BrandInsights;
