import { Calendar } from "lucide-react";

const Events = () => {
  return (
    <div className="container max-w-2xl mx-auto px-4 py-6">
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center space-y-4">
        <Calendar className="h-16 w-16 text-muted-foreground" />
        <h2 className="text-2xl font-bold">Events</h2>
        <p className="text-muted-foreground max-w-md">
          Keep track of upcoming birthdays, holidays, and special occasions to never miss a gift-giving moment.
        </p>
      </div>
    </div>
  );
};

export default Events;
