import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Sparkles } from "lucide-react";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { useTranslation } from "react-i18next";

type StaticRecommendation = {
  id: number;
  nameKey: string;
  fallback: string;
  emoji: string;
};

type AIRecommendation = {
  id: string;
  name_en: string;
  name_ar: string;
  emoji: string;
};

export const AIRecommendationCard = () => {
  const { t, i18n } = useTranslation();

  const staticRecommendations: StaticRecommendation[] = [
    { id: 1, nameKey: "dashboard.gift_smartwatch", fallback: "Smartwatch", emoji: "⌚" },
    { id: 2, nameKey: "dashboard.gift_coffee_maker", fallback: "Coffee Maker", emoji: "☕" },
    { id: 3, nameKey: "dashboard.gift_bluetooth_speaker", fallback: "Bluetooth Speaker", emoji: "🔊" },
    { id: 4, nameKey: "dashboard.gift_desk_lamp", fallback: "Desk Lamp", emoji: "💡" },
  ];

  const [aiRecs, setAiRecs] = useState<AIRecommendation[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

  const edgeFunctionUrl = useMemo(() => {
    if (!supabaseUrl) return "";
    return `${supabaseUrl}/functions/v1/ai-gateway`;
  }, [supabaseUrl]);

  useEffect(() => {
    // Don't spam the gateway; only fetch once per mount/language
    if (!edgeFunctionUrl || !supabaseAnonKey) return;

    const fetchRecs = async () => {
      try {
        setLoading(true);
        setError(null);

        const userLocale = i18n.language === "ar" ? "ar" : "en";
        const systemPrompt =
          "You are Wishly, an AI gifting assistant for a bilingual (Arabic/English) social wishlist app. " +
          "Return ONLY strict JSON with an array field 'items'. Each item must have: id (string), name_en, name_ar, emoji. " +
          "Names should feel local to the Gulf region when possible.";

        const body = {
          model: "deepseek-chat",
          messages: [
            { role: "system", content: systemPrompt },
            {
              role: "user",
              content:
                userLocale === "ar"
                  ? "اقترح 4 هدايا مختصرة مع اسم عربي واسم إنجليزي ورمز تعبيري فقط (بدون سعر). أعد فقط JSON في الحقل items."
                  : "Suggest 4 concise gift ideas with Arabic and English names and an emoji (no prices). Return ONLY JSON in an 'items' array.",
            },
          ],
          temperature: 0.7,
          max_tokens: 512,
        };

        const res = await fetch(edgeFunctionUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${supabaseAnonKey}`,
          },
          body: JSON.stringify(body),
        });

        if (!res.ok) {
          throw new Error(`AI gateway error ${res.status}`);
        }

        // Depending on gateway implementation this may be JSON or streamed text.
        // Try JSON first, then fall back.
        let json: any;
        try {
          json = await res.json();
        } catch {
          const text = await res.text();
          // Attempt to extract JSON object from text if streamed
          const match = text.match(/\{[\s\S]*\}/);
          json = match ? JSON.parse(match[0]) : null;
        }

        let items: any[] | null = null;
        if (json && Array.isArray(json.items)) {
          items = json.items;
        } else if (json?.choices?.[0]?.message?.content) {
          const raw = json.choices[0].message.content as string;
          const match = raw.match(/\{[\s\S]*\}/);
          if (match) {
            const parsed = JSON.parse(match[0]);
            if (Array.isArray(parsed.items)) items = parsed.items;
          }
        }

        if (!items || items.length === 0) {
          throw new Error("AI returned no items");
        }

        const mapped: AIRecommendation[] = items.slice(0, 4).map((it: any, idx: number) => ({
          id: String(it.id ?? idx),
          name_en: String(it.name_en ?? it.name ?? ""),
          name_ar: String(it.name_ar ?? it.name ?? ""),
          emoji: String(it.emoji ?? "🎁"),
        }));

        setAiRecs(mapped);
      } catch (e: any) {
        console.error("AI recommendations error", e);
        setError("ai_error");
        setAiRecs(null);
      } finally {
        setLoading(false);
      }
    };

    fetchRecs();
  }, [edgeFunctionUrl, supabaseAnonKey, i18n.language]);

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
        {loading && !aiRecs && (
          <p className="text-xs text-muted-foreground pb-2">{t('dashboard.ai_loading', 'Asking Wishly for ideas...')}</p>
        )}
        {error && !aiRecs && (
          <p className="text-xs text-destructive pb-2">{t('dashboard.ai_error', 'Using fallback ideas while AI is unavailable.')}</p>
        )}
        <ScrollArea className="w-full whitespace-nowrap">
          <div className="flex gap-4">
            {(aiRecs ?? []).length > 0
              ? aiRecs!.map((item) => (
                  <div
                    key={item.id}
                    className="w-32 shrink-0 space-y-2 rounded-lg bg-card border p-3 hover:shadow-md transition-shadow cursor-pointer"
                  >
                    <div className="aspect-square rounded-md bg-muted flex items-center justify-center text-4xl">
                      {item.emoji}
                    </div>
                    <div>
                      <p className="text-sm font-medium line-clamp-2">
                        {i18n.language === 'ar' && item.name_ar
                          ? item.name_ar
                          : item.name_en || t('dashboard.gift_ideas_title', 'Gift ideas')}
                      </p>
                    </div>
                  </div>
                ))
              : staticRecommendations.map((item) => (
                  <div
                    key={item.id}
                    className="w-32 shrink-0 space-y-2 rounded-lg bg-card border p-3 hover:shadow-md transition-shadow cursor-pointer"
                  >
                    <div className="aspect-square rounded-md bg-muted flex items-center justify-center text-4xl">
                      {item.emoji}
                    </div>
                    <div>
                      <p className="text-sm font-medium line-clamp-2">{t(item.nameKey as any, item.fallback)}</p>
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
