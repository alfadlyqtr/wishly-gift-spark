import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Heart, Repeat2, MessageCircle } from "lucide-react";

export const SocialWishCard = () => {
  const mockWishes = [
    { id: 1, name: "Wireless Headphones", image: "🎧" },
    { id: 2, name: "Bestseller Book", image: "📚" },
    { id: 3, name: "Indoor Plant", image: "🪴" },
  ];

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-3">
          <Avatar className="h-10 w-10">
            <AvatarImage src="" />
            <AvatarFallback className="bg-primary text-primary-foreground">S</AvatarFallback>
          </Avatar>
          <div>
            <p className="font-semibold">Sara</p>
            <p className="text-sm text-muted-foreground">Added 3 wishes to her Birthday list</p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pb-3">
        <div className="grid grid-cols-3 gap-3">
          {mockWishes.map((wish) => (
            <div
              key={wish.id}
              className="aspect-square rounded-lg bg-muted flex items-center justify-center text-4xl hover:bg-muted/80 transition-colors cursor-pointer"
            >
              {wish.image}
            </div>
          ))}
        </div>
      </CardContent>
      <CardFooter className="flex justify-around border-t pt-3">
        <Button variant="ghost" size="sm" className="flex items-center gap-2">
          <Heart className="h-4 w-4" />
          <span className="text-sm">Like</span>
        </Button>
        <Button variant="ghost" size="sm" className="flex items-center gap-2">
          <Repeat2 className="h-4 w-4" />
          <span className="text-sm">Share</span>
        </Button>
        <Button variant="ghost" size="sm" className="flex items-center gap-2">
          <MessageCircle className="h-4 w-4" />
          <span className="text-sm">Comment</span>
        </Button>
      </CardFooter>
    </Card>
  );
};
