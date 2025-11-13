import { useNavigate } from "react-router-dom";
import { useWishlists } from "@/hooks/use-wishlists";
import BackButton from "@/components/BackButton";
import WishlistStack from "@/components/wishes/WishlistStack";
import CreateWishlistModal from "@/components/wishes/CreateWishlistModal";
import AddButton from "@/components/AddButton";
import React from "react";

const Wishlists: React.FC = () => {
  const navigate = useNavigate();
  const { data: wishlists, isLoading } = useWishlists();

  const cards = (wishlists || []).map((w) => ({ id: w.id, title: w.title }));

  return (
    <div className="container max-w-2xl mx-auto px-4 py-6 space-y-4">
      <div className="flex items-center justify-between">
        <BackButton onClick={() => navigate(-1)}>Back</BackButton>
        <CreateWishlistModal>
          <AddButton ariaLabel="Add Wishlist" />
        </CreateWishlistModal>
      </div>

      <div className="px-1">
        <h1 className="text-2xl font-extrabold">Your Wishlists</h1>
        <p className="text-sm text-muted-foreground">Flip through and tap a card to open.</p>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading...</p>
      ) : cards.length > 0 ? (
        <div className="w-full flex justify-center py-10 mt-16 sm:mt-24">
          <WishlistStack
            randomRotation={true}
            sensitivity={180}
            sendToBackOnClick={false}
            cardDimensions={{ width: 320, height: 190 }}
            cards={cards}
          />
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">No wishlists yet.</p>
      )}
    </div>
  );
};

export default Wishlists;
