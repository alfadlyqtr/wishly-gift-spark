import { EventReminderCard } from "@/components/dashboard/EventReminderCard";
import { SocialWishCard } from "@/components/dashboard/SocialWishCard";
import { AIRecommendationCard } from "@/components/dashboard/AIRecommendationCard";

const Dashboard = () => {
  return (
    <div className="container max-w-2xl mx-auto px-4 py-6 space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-bold">Your Feed</h1>
        <p className="text-muted-foreground">Stay updated with your friends' wishes and upcoming events</p>
      </div>

      <EventReminderCard />
      <SocialWishCard />
      <AIRecommendationCard />
      <SocialWishCard />
    </div>
  );
};

export default Dashboard;
