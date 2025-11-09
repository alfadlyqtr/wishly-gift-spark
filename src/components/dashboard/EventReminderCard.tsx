import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Gift } from "lucide-react";

export const EventReminderCard = () => {
  return (
    <Card className="overflow-hidden bg-gradient-to-br from-brand-cool-start to-brand-cool-end border-none text-white">
      <CardContent className="p-6 space-y-4">
        <div className="flex items-center gap-3">
          <Avatar className="h-12 w-12 border-2 border-white">
            <AvatarImage src="" />
            <AvatarFallback className="bg-primary text-primary-foreground">A</AvatarFallback>
          </Avatar>
          <div>
            <p className="font-semibold text-lg">Ali's Birthday is in 10 days! 🎂</p>
            <p className="text-sm text-white/90">Don't forget to get a gift</p>
          </div>
        </div>
        <div className="flex gap-3">
          <Button 
            className="flex-1 bg-gradient-to-r from-brand-warm-start to-brand-warm-end border-none text-white hover:shadow-lg transition-all"
          >
            <Gift className="mr-2 h-4 w-4" />
            See His Wishlist
          </Button>
          <Button 
            variant="secondary" 
            className="flex-1 bg-white text-primary hover:bg-white/90"
          >
            Start a Group Gift
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
