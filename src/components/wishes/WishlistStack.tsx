import { motion, useMotionValue, useTransform } from 'motion/react';
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './WishlistStack.css';
import { Trash2 } from 'lucide-react';
import { ShareButton } from '@/components/ui/ShareButton';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';

export type WishlistCard = { id: string; title: string; subtitle?: string };

type CardRotateProps = {
  children: React.ReactNode;
  onSendToBack: () => void;
  sensitivity: number;
  draggable?: boolean;
};

function CardRotate({ children, onSendToBack, sensitivity, draggable = true }: CardRotateProps) {
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const rotateX = useTransform(y, [-100, 100], [60, -60]);
  const rotateY = useTransform(x, [-100, 100], [-60, 60]);
  const [isDragging, setIsDragging] = React.useState(false);
  
  // Visual feedback based on drag distance
  const opacity = useTransform(
    x,
    [-sensitivity, 0, sensitivity],
    [0.5, 1, 0.5]
  );

  function handleDragEnd(_: any, info: any) {
    if (!draggable) return;
    const offX = info?.offset?.x ?? 0;
    const offY = info?.offset?.y ?? 0;
    const velX = info?.velocity?.x ?? 0;
    const velY = info?.velocity?.y ?? 0;
    
    // Calculate total distance and speed
    const distance = Math.hypot(offX, offY);
    const speed = Math.hypot(velX, velY);
    
    // Improved thresholds for mobile swipe gestures
    const velocityThreshold = 300; // Lower threshold for easier swipes
    const distanceThreshold = sensitivity * 0.8; // 80% of sensitivity for better responsiveness
    
    // Directional swipe detection
    const isHorizontalSwipe = Math.abs(velX) > Math.abs(velY);
    const isVerticalSwipe = Math.abs(velY) > Math.abs(velX);
    
    // Trigger card change on:
    // 1. Fast swipe (high velocity)
    // 2. Long drag (distance threshold)
    // 3. Directional swipe with moderate speed
    const shouldSendToBack = 
      speed > velocityThreshold ||
      distance > distanceThreshold ||
      (isHorizontalSwipe && Math.abs(velX) > 200) ||
      (isVerticalSwipe && Math.abs(velY) > 200);

    if (shouldSendToBack) {
      onSendToBack();
    } else {
      x.set(0);
      y.set(0);
    }
  }

  return (
    <motion.div
      className="wl-card-rotate"
      style={{ x, y, rotateX, rotateY, opacity }}
      drag={draggable ? true : false}
      dragConstraints={{ top: 0, right: 0, bottom: 0, left: 0 }}
      dragElastic={0.6}
      dragTransition={{ bounceStiffness: 600, bounceDamping: 20 }}
      whileTap={draggable ? { cursor: 'grabbing', scale: 1.02 } : undefined}
      whileDrag={{ scale: 1.05, zIndex: 10 }}
      onDragStart={() => setIsDragging(true)}
      onDragEnd={(e, info) => {
        handleDragEnd(e, info);
        // Small delay to prevent click from firing after drag
        setTimeout(() => setIsDragging(false), 100);
      }}
      data-dragging={isDragging}
    >
      {children}
    </motion.div>
  );
}

export type WishlistStackProps = {
  randomRotation?: boolean;
  sensitivity?: number;
  cardDimensions?: { width: number; height: number };
  cards: WishlistCard[];
  animationConfig?: { stiffness: number; damping: number };
  sendToBackOnClick?: boolean;
  className?: string;
  viewerMode?: boolean;
  onCardOpen?: (id: string) => void;
  // When true, the "My Birthday Wishlist" card shows normally but its Open
  // button is disabled. Used when the user has not set a Date of Birth yet.
  disableBirthdayOpen?: boolean;
};

export default function WishlistStack({
  randomRotation = true,
  sensitivity = 240,
  cardDimensions = { width: 260, height: 170 },
  cards,
  animationConfig = { stiffness: 260, damping: 20 },
  sendToBackOnClick = true,
  className = '',
  viewerMode = false,
  onCardOpen,
  disableBirthdayOpen = false,
}: WishlistStackProps) {
  const { t } = useTranslation();
  const [stack, setStack] = useState(cards);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [target, setTarget] = useState<{ id: string; title: string } | null>(null);
  const [allowShare, setAllowShare] = useState<boolean>(true);

  useEffect(() => {
    setStack(cards);
  }, [cards]);

  const sendToBack = (id: string) => {
    setStack((prev) => {
      const newCards = [...prev];
      const index = newCards.findIndex((c) => c.id === id);
      if (index === -1) return prev;
      const [card] = newCards.splice(index, 1);
      newCards.unshift(card);
      return newCards;
    });
  };


  const openWishlist = (id: string) => {
    navigate(`/wishlist/${id}`);
  };

  const handleOpen = (id: string) => {
    if (onCardOpen) {
      onCardOpen(id);
    } else {
      openWishlist(id);
    }
  };

  // Load user's share preference (hide share icon when disabled)
  useEffect(() => {
    if (viewerMode) return;
    (async () => {
      try {
        const { data: auth } = await supabase.auth.getUser();
        const uid = auth.user?.id;
        if (!uid) return;
        const { data } = await (supabase as any)
          .from('user_profiles')
          .select('allow_wishlist_sharing')
          .eq('id', uid)
          .maybeSingle();
        if (typeof (data as any)?.allow_wishlist_sharing === 'boolean') {
          setAllowShare((data as any).allow_wishlist_sharing);
        }
      } catch {}
    })();
  }, [viewerMode]);

  const shareWishlist = async (id: string, title: string) => {
    try {
      const publicBase = (import.meta as any).env?.VITE_PUBLIC_SITE_URL as string | undefined;
      const origin = (publicBase && /^https?:\/\//i.test(publicBase)) ? publicBase.replace(/\/$/, '') : window.location.origin;
      const url = `${origin}/w/${id}`;
      const shareTitle = title || 'Wishlist';
      const text = `${shareTitle} — ${url}`;

      const nav: any = navigator as any;
      if (nav?.share) {
        const payload: any = { title: shareTitle, text, url };
        if (!nav.canShare || nav.canShare(payload)) {
          try {
            await nav.share(payload);
            return;
          } catch (err: any) {
            // fall through to other strategies
          }
        }
      }

      // Mobile WhatsApp deep link fallback (best-effort)
      const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
      if (isMobile) {
        const waDeepLink = `whatsapp://send?text=${encodeURIComponent(text)}`;
        const waWeb = `https://wa.me/?text=${encodeURIComponent(text)}`;
        try {
          // Try deep link first
          window.location.href = waDeepLink;
          // If it doesn't resolve (e.g., no app), the user can still use the web link we copy below
        } catch {}
        // Also copy to clipboard as a reliable fallback
        await navigator.clipboard.writeText(text);
        toast.success(t('wishlist.link_copied', 'Link copied. If WhatsApp did not open, paste into any app.'));
      return;
    }

    await navigator.clipboard.writeText(url);
    toast.success(t('wishlist.link_copied', 'Link copied'));
  } catch (e: any) {
    toast.error(e?.message || t('wishlist.share_failed', 'Failed to share'));
  }
};

  return (
    <div
      className={["wl-stack-container", className].join(' ')}
      style={{ width: cardDimensions.width, height: cardDimensions.height, perspective: 600 }}
    >
      {stack.map((card, index) => {
        const isBirthday = card.title === 'My Birthday Wishlist';
        const randomRotate = randomRotation ? Math.random() * 10 - 5 : 0;
        const scale = 1 + index * 0.06 - stack.length * 0.06;

        return (
          <CardRotate
            key={card.id}
            onSendToBack={() => sendToBack(card.id)}
            sensitivity={sensitivity}
            draggable={true}
          >
            <motion.div
              className="wl-card"
              onClick={(e) => {
                // Check if we were dragging - if so, don't open
                const wasDragging = (e.currentTarget.closest('[data-dragging]') as HTMLElement)?.dataset.dragging === 'true';
                if (wasDragging) {
                  return;
                }
                
                if (viewerMode) {
                  handleOpen(card.id);
                  return;
                }
                if (sendToBackOnClick) sendToBack(card.id);
              }}
              animate={{
                // Stronger fan so multiple cards are clearly visible behind the top one
                rotateZ: (stack.length - index - 1) * 14 + randomRotate,
                scale,
                y: index * 12,
                transformOrigin: '90% 90%',
              }}
              initial={false}
              transition={{ type: 'spring', stiffness: animationConfig.stiffness, damping: animationConfig.damping }}
              style={{ width: cardDimensions.width, height: cardDimensions.height }}
            >
              <div className="wl-card-surface">
                {!viewerMode && allowShare && (
                  <div 
                    className="wl-share-btn-container"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <ShareButton
                      url={`${window.location.origin}/w/${card.id}`}
                      title={card.title || 'Wishlist'}
                      size="sm"
                    />
                  </div>
                )}
                <div className="wl-card-title">
                  {card.title === 'My Birthday Wishlist' 
                    ? t('wishlist.my_birthday_wishlist', 'My Birthday Wishlist') 
                    : card.title}
                </div>
                {card.subtitle && (
                  <div className="wl-card-subtitle">
                    {card.subtitle}
                  </div>
                )}
                {viewerMode && (
                  <button
                    type="button"
                    className="wl-viewer-open-btn"
                    aria-label={t('wishlist.open', 'Open')}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleOpen(card.id);
                    }}
                  >
                    {t('wishlist.open', 'Open')}
                  </button>
                )}
                {!viewerMode && (
                  <div className="flex items-center gap-4">
                    {!isBirthday && (
                      <button
                        type="button"
                        className="wl-delete-btn"
                        aria-label={t('wishlist.delete_aria', 'Delete wishlist')}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (card.title === 'My Birthday Wishlist') {
                            toast.error(t('wishlist.birthday_cannot_delete', 'Birthday wishlist cannot be deleted'));
                            return;
                          }
                          setTarget({ id: card.id, title: card.title });
                          setDeleteOpen(true);
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                    <button
                      type="button"
                      className="wl-open-btn"
                      disabled={disableBirthdayOpen && isBirthday}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (disableBirthdayOpen && isBirthday) {
                          return;
                        }
                        handleOpen(card.id);
                      }}
                    >
                      {t('wishlist.open', 'Open')}
                    </button>
                  </div>
                )}
              </div>
            </motion.div>
          </CardRotate>
        );
      })}
      <Dialog open={deleteOpen && !viewerMode} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('wishlist.delete_title', 'Delete Wishlist?')}</DialogTitle>
          </DialogHeader>
          <p>{t('wishlist.delete_confirm', 'Are you sure you want to delete "{{title}}"?', { title: target?.title })}</p>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setDeleteOpen(false)}>{t('common.cancel', 'Cancel')}</Button>
            <Button
              variant="destructive"
              onClick={async () => {
                if (!target) return;
                try {
                  const { error } = await supabase.from('wishlists').delete().eq('id', target.id);
                  if (error) throw error;
                  toast.success(t('wishlist.deleted', 'Wishlist deleted'));
                  setStack((prev) => prev.filter((c) => c.id !== target.id));
                  setDeleteOpen(false);
                  setTarget(null);
                  await queryClient.invalidateQueries({ queryKey: ['wishlists'] });
                  await queryClient.invalidateQueries({
                    predicate: (q) => Array.isArray(q.queryKey) && q.queryKey[0] === 'events'
                  });
                } catch (e: any) {
                  toast.error(e?.message || t('wishlist.delete_failed', 'Failed to delete'));
                }
              }}
            >
              {t('common.delete', 'Delete')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
