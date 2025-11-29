import { useTranslation } from "react-i18next";
import { useParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

const BrandProductDetail = () => {
  const { t } = useTranslation();
  const { id } = useParams();

  return (
    <div className="p-4 md:p-6 space-y-4">
      <Card className="shadow-lg border border-white/40 bg-gradient-to-br from-white/95 via-white/90 to-white/80">
        <CardHeader>
          <CardTitle className="text-2xl font-bold">
            {t("brand.product_detail_title", "Product details")}
          </CardTitle>
          <CardDescription>
            {t("brand.product_detail_subtitle", "View performance and edit product information.")}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <p className="text-xs text-muted-foreground">
            {t("brand.product_detail_id", "Product id:")} {id}
          </p>
          <p className="text-sm text-muted-foreground">
            {t(
              "brand.product_detail_placeholder",
              "Here we can later add sections for overview, metrics, and audience insights for a single product.",
            )}
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default BrandProductDetail;
