import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const BrandProducts = () => {
  const { t } = useTranslation();

  return (
    <div className="p-4 md:p-6 space-y-4">
      <Card className="shadow-lg border border-white/40 bg-gradient-to-br from-white/95 via-white/90 to-white/80">
        <CardHeader className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
          <div>
            <CardTitle className="text-2xl font-bold">
              {t("brand.products_title", "Products")}
            </CardTitle>
            <CardDescription>
              {t("brand.products_subtitle", "Manage the items you want to appear in Wishly.")}
            </CardDescription>
          </div>
          <Button className="bg-gradient-to-r from-brand-warm-start to-brand-warm-end text-white hover:brightness-110">
            {t("brand.products_add", "Add product")}
          </Button>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            {t(
              "brand.products_placeholder",
              "Later this page will show a table of your products with status, saves, clicks, and quick edit actions.",
            )}
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default BrandProducts;
