import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Sparkles } from "lucide-react";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { useTranslation } from "react-i18next";

export const AIRecommendationCard = () => {
  const { t, i18n } = useTranslation();
  const recommendations = [
    { id: 1, nameKey: "dashboard.gift_smartwatch", fallback: "Smartwatch", price: "150 QAR", emoji: "⌚" },
    { id: 2, nameKey: "dashboard.gift_coffee_maker", fallback: "Coffee Maker", price: "180 QAR", emoji: "☕" },
    { id: 3, nameKey: "dashboard.gift_bluetooth_speaker", fallback: "Bluetooth Speaker", price: "120 QAR", emoji: "🔊" },
    { id: 4, nameKey: "dashboard.gift_desk_lamp", fallback: "Desk Lamp", price: "95 QAR", emoji: "💡" },
  ];

  return (
    <Card className="bg-gradient-to-br from-brand-warm-start/10 to-brand-warm-end/10 border-brand-warm-start/20">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Sparkles className="h-5 w-5 text-brand-warm-start" />
          {t("dashboard.gift_ideas_title", "Gift ideas")}
          <span className="text-sm font-normal text-muted-foreground">({t("dashboard.gift_ideas_subtitle", "Personalized picks")})</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ScrollArea className="w-full whitespace-nowrap">
          <div className="flex gap-4">
            {recommendations.map((item) => (
              <div
                key={item.id}
                className="w-32 shrink-0 space-y-2 rounded-lg bg-card border p-3 hover:shadow-md transition-shadow cursor-pointer"
              >
                <div className="aspect-square rounded-md bg-muted flex items-center justify-center text-4xl">
                  {item.emoji}
                </div>
                <div>
                  <p className="text-sm font-medium line-clamp-2">{t(item.nameKey as any, item.fallback)}</p>
                  <p className="text-xs text-muted-foreground">{item.price}</p>
                </div>
              </div>
            ))}
          </div>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>
      </CardContent>
    </Card>
  );
};
