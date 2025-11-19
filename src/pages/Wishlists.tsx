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
        <div className="w-full flex flex-col items-center py-10 mt-16 sm:mt-24 space-y-2 relative">
          <WishlistStack
            randomRotation={true}
            sensitivity={180}
            sendToBackOnClick={false}
            cardDimensions={{ width: 320, height: 190 }}
            cards={cards}
          />
          {cards.length > 1 && (
            <div className="mt-4 text-center text-[11px] text-muted-foreground relative z-10">
              <span className="inline-flex items-center justify-center gap-1 px-4 py-[3px] rounded-full bg-muted/40 border border-border/60 shadow-sm">
                <span className="tracking-wide text-[10px]">{"<"} Swipe cards {">"}</span>
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 14 14"
                  aria-hidden="true"
                  className="overflow-visible"
                >
                  <circle cx="3" cy="7" r="3" fill="currentColor">
                    <animateTransform
                      attributeName="transform"
                      type="translate"
                      dur="1.2s"
                      values="0 0; 4 0; 0 0"
                      repeatCount="indefinite"
                    />
                  </circle>
                </svg>
              </span>
            </div>
          )}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">No wishlists yet.</p>
      )}
    </div>
  );
};

export default Wishlists;
