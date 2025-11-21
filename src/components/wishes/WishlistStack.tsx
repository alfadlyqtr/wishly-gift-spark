import { motion, useMotionValue, useTransform } from 'motion/react';
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './WishlistStack.css';
import { Trash2, Share2 } from 'lucide-react';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export type WishlistCard = { id: string; title: string };

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

  function handleDragEnd(_: any, info: any) {
    if (!draggable) return;
    const offX = info?.offset?.x ?? 0;
    const offY = info?.offset?.y ?? 0;
    const velX = info?.velocity?.x ?? 0;
    const velY = info?.velocity?.y ?? 0;
    const distance = Math.hypot(offX, offY);
    const speed = Math.hypot(velX, velY);
    const velocityThreshold = 400;

    if (distance > sensitivity || speed > velocityThreshold) {
      onSendToBack();
    } else {
      x.set(0);
      y.set(0);
    }
  }

  return (
    <motion.div
      className="wl-card-rotate"
      style={{ x, y, rotateX, rotateY }}
      drag={draggable ? true : false}
      dragConstraints={{ top: 0, right: 0, bottom: 0, left: 0 }}
      dragElastic={0.7}
      whileTap={draggable ? { cursor: 'grabbing' } : undefined}
      onDragEnd={handleDragEnd}
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
}: WishlistStackProps) {
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
        toast.success('Link copied. If WhatsApp did not open, paste into any app.');
        return;
      }

      await navigator.clipboard.writeText(url);
      toast.success('Link copied');
    } catch (e: any) {
      toast.error(e?.message || 'Failed to share');
    }
  };

  return (
    <div
      className={["wl-stack-container", className].join(' ')}
      style={{ width: cardDimensions.width, height: cardDimensions.height, perspective: 600 }}
    >
      {stack.map((card, index) => {
        const randomRotate = randomRotation ? Math.random() * 10 - 5 : 0;
        const scale = 1 + index * 0.08 - stack.length * 0.08;

        return (
          <CardRotate
            key={card.id}
            onSendToBack={() => sendToBack(card.id)}
            sensitivity={sensitivity}
            draggable={!viewerMode}
          >
            <motion.div
              className="wl-card"
              onClick={() => {
                if (viewerMode) {
                  handleOpen(card.id);
                  return;
                }
                if (sendToBackOnClick) sendToBack(card.id);
              }}
              animate={{
                rotateZ: (stack.length - index - 1) * 8 + randomRotate,
                scale,
                y: index * 8,
                transformOrigin: '90% 90%',
              }}
              initial={false}
              transition={{ type: 'spring', stiffness: animationConfig.stiffness, damping: animationConfig.damping }}
              style={{ width: cardDimensions.width, height: cardDimensions.height }}
            >
              <div className="wl-card-surface">
                {!viewerMode && allowShare && (
                  <button
                    type="button"
                    className="wl-share-btn"
                    aria-label="Share wishlist"
                    onClick={(e) => {
                      e.stopPropagation();
                      shareWishlist(card.id, card.title);
                    }}
                  >
                    <Share2 className="h-4 w-4" />
                  </button>
                )}
                <div className="wl-card-title">{card.title}</div>
                {!viewerMode && (
                  <div className="flex items-center gap-4">
                    {card.title !== 'My Birthday Wishlist' && (
                      <button
                        type="button"
                        className="wl-delete-btn"
                        aria-label="Delete wishlist"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (card.title === 'My Birthday Wishlist') {
                            toast.error('Birthday wishlist cannot be deleted');
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
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOpen(card.id);
                      }}
                    >
                      Open
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
            <DialogTitle>Delete Wishlist?</DialogTitle>
          </DialogHeader>
          <p>Are you sure you want to delete “{target?.title}”?</p>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setDeleteOpen(false)}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={async () => {
                if (!target) return;
                try {
                  const { error } = await supabase.from('wishlists').delete().eq('id', target.id);
                  if (error) throw error;
                  toast.success('Wishlist deleted');
                  setStack((prev) => prev.filter((c) => c.id !== target.id));
                  setDeleteOpen(false);
                  setTarget(null);
                  await queryClient.invalidateQueries({ queryKey: ['wishlists'] });
                  await queryClient.invalidateQueries({
                    predicate: (q) => Array.isArray(q.queryKey) && q.queryKey[0] === 'events'
                  });
                } catch (e: any) {
                  toast.error(e?.message || 'Failed to delete');
                }
              }}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
