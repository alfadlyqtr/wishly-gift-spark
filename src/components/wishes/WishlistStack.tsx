import { motion, useMotionValue, useTransform } from 'motion/react';
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './WishlistStack.css';

export type WishlistCard = { id: string; title: string };

type CardRotateProps = {
  children: React.ReactNode;
  onSendToBack: () => void;
  sensitivity: number;
};

function CardRotate({ children, onSendToBack, sensitivity }: CardRotateProps) {
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const rotateX = useTransform(y, [-100, 100], [60, -60]);
  const rotateY = useTransform(x, [-100, 100], [-60, 60]);

  function handleDragEnd(_: any, info: any) {
    const offX = info?.offset?.x ?? 0;
    const offY = info?.offset?.y ?? 0;
    const velX = info?.velocity?.x ?? 0;
    const velY = info?.velocity?.y ?? 0;
    const distance = Math.hypot(offX, offY);
    const speed = Math.hypot(velX, velY);
    const velocityThreshold = 900; // require a real flick

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
      drag
      dragConstraints={{ top: 0, right: 0, bottom: 0, left: 0 }}
      dragElastic={0.6}
      whileTap={{ cursor: 'grabbing' }}
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
};

export default function WishlistStack({
  randomRotation = true,
  sensitivity = 240,
  cardDimensions = { width: 260, height: 170 },
  cards,
  animationConfig = { stiffness: 260, damping: 20 },
  sendToBackOnClick = true,
  className = '',
}: WishlistStackProps) {
  const [stack, setStack] = useState(cards);
  const navigate = useNavigate();

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

  return (
    <div
      className={["wl-stack-container", className].join(' ')}
      style={{ width: cardDimensions.width, height: cardDimensions.height, perspective: 600 }}
    >
      {stack.map((card, index) => {
        const randomRotate = randomRotation ? Math.random() * 10 - 5 : 0;
        const scale = 1 + index * 0.08 - stack.length * 0.08;

        return (
          <CardRotate key={card.id} onSendToBack={() => sendToBack(card.id)} sensitivity={sensitivity}>
            <motion.div
              className="wl-card"
              onClick={() => {
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
                <div className="wl-card-title">{card.title}</div>
                <button
                  type="button"
                  className="wl-open-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    openWishlist(card.id);
                  }}
                >
                  Open
                </button>
              </div>
            </motion.div>
          </CardRotate>
        );
      })}
    </div>
  );
}
