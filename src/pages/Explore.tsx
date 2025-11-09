import { Store } from "lucide-react";

const Explore = () => {
  return (
    <div className="container max-w-2xl mx-auto px-4 py-6">
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center space-y-4">
        <Store className="h-16 w-16 text-muted-foreground" />
        <h2 className="text-2xl font-bold">Explore</h2>
        <p className="text-muted-foreground max-w-md">
          Discover trending gifts, popular wishlists, and amazing products curated just for you.
        </p>
      </div>
    </div>
  );
};

export default Explore;
