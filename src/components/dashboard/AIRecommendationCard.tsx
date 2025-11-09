import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Sparkles } from "lucide-react";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";

export const AIRecommendationCard = () => {
  const recommendations = [
    { id: 1, name: "Smartwatch", price: "150 QAR", emoji: "⌚" },
    { id: 2, name: "Coffee Maker", price: "180 QAR", emoji: "☕" },
    { id: 3, name: "Bluetooth Speaker", price: "120 QAR", emoji: "🔊" },
    { id: 4, name: "Desk Lamp", price: "95 QAR", emoji: "💡" },
  ];

  return (
    <Card className="bg-gradient-to-br from-brand-warm-start/10 to-brand-warm-end/10 border-brand-warm-start/20">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Sparkles className="h-5 w-5 text-brand-warm-start" />
          Gift ideas for Ali
          <span className="text-sm font-normal text-muted-foreground">(Budget: Under 200 QAR)</span>
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
                  <p className="text-sm font-medium line-clamp-2">{item.name}</p>
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
