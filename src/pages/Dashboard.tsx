import { EventReminderCard } from "@/components/dashboard/EventReminderCard";
import { SocialWishCard } from "@/components/dashboard/SocialWishCard";
import { AIRecommendationCard } from "@/components/dashboard/AIRecommendationCard";
import { LayoutDashboard } from "lucide-react";

const Dashboard = () => {
  return (
    <div className="container max-w-2xl mx-auto px-4 py-6 space-y-6">
      {/* Branded header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="relative inline-flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[hsl(var(--brand-cool-start))] via-[hsl(var(--brand-cool-end))] to-[hsl(var(--brand-warm-end))] shadow-[0_12px_30px_rgba(200,80,192,0.45)] ring-1 ring-white/40">
            <LayoutDashboard className="h-5 w-5 text-white drop-shadow" />
            <span className="absolute -inset-1 rounded-[14px] blur-md bg-gradient-to-br from-[#ffcc70]/20 to-[#c850c0]/10" aria-hidden="true" />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-[hsl(var(--brand-cool-start))] via-[hsl(var(--brand-cool-end))] to-[hsl(var(--brand-warm-end))] drop-shadow">Dashboard</h1>
            <p className="text-sm text-muted-foreground">Stay updated with your friends' wishes and upcoming events</p>
          </div>
        </div>
      </div>

      <EventReminderCard />
      <SocialWishCard />
      <AIRecommendationCard />
      <SocialWishCard />
    </div>
  );
};

export default Dashboard;
