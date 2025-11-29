import { useNavigate } from "react-router-dom";
import { useWishlists } from "@/hooks/use-wishlists";
import BackButton from "@/components/BackButton";
import WishlistStack from "@/components/wishes/WishlistStack";
import CreateWishlistModal from "@/components/wishes/CreateWishlistModal";
import AddButton from "@/components/AddButton";
import { Card, CardContent } from "@/components/ui/card";
import React from "react";
import { useTranslation } from "react-i18next";

const Wishlists: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { data: wishlists, isLoading } = useWishlists();

  const cards = (wishlists || []).map((w) => ({ id: w.id, title: w.title }));

  return (
    <div className="container max-w-2xl mx-auto px-4 py-6 space-y-4">
      <div className="flex items-center justify-between">
        <BackButton onClick={() => navigate(-1)}>{t("common.back", "Back")}</BackButton>
        <CreateWishlistModal>
          <AddButton ariaLabel={t("wishlist.add_button_aria", "Add Wishlist")} />
        </CreateWishlistModal>
      </div>

      <div className="px-1">
        <h1 className="text-2xl font-extrabold">
          {t("wishlist.hub_title", "Your Wishlists")}
        </h1>
        <p className="text-sm text-muted-foreground">
          {t("wishlist.hub_subtitle", "Flip through and tap a card to open.")}
        </p>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">
          {t("common.loading", "Loading...")}
        </p>
      ) : cards.length > 0 ? (
        <Card className="border-0 rounded-2xl ring-1 ring-white/30 bg-gradient-to-br from-[#4158D0]/10 via-[#C850C0]/10 to-[#FFCC70]/10 shadow-[0_18px_40px_rgba(0,0,0,0.20)]">
          <CardContent className="p-6 pt-2">
            <div className="w-full flex flex-col items-center py-8 sm:py-10 space-y-2 relative">
              <WishlistStack
                randomRotation={true}
                sensitivity={180}
                sendToBackOnClick={false}
                cardDimensions={{ width: 320, height: 190 }}
                cards={cards}
              />
              {cards.length > 1 && (
                <div className="absolute bottom-[-2.5rem] left-1/2 -translate-x-1/2 text-center text-[11px] text-muted-foreground z-10">
                  <span className="inline-flex items-center justify-center gap-1 px-4 py-[3px] rounded-full bg-muted/40 border border-border/60 shadow-sm">
                    <span className="tracking-wide text-[10px]">
                      {t("wishlist.swipe_hint", "< Swipe cards >")}
                    </span>
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 16 16"
                      aria-hidden="true"
                      className="overflow-visible"
                    >
                      <g>
                        <animateTransform
                          attributeName="transform"
                          type="translate"
                          dur="1.1s"
                          values="0 0; 3 0; 0 0"
                          repeatCount="indefinite"
                        />
                        <text
                          x="2"
                          y="11"
                          fontSize="10"
                        >
                          🤚
                        </text>
                      </g>
                    </svg>
                  </span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      ) : (
        <p className="text-sm text-muted-foreground">
          {t("wishlist.empty", "No wishlists yet.")}
        </p>
      )}
    </div>
  );
};

export default Wishlists;
