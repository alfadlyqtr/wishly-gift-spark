import { useEffect, useRef } from "react";
import { motion, useInView } from "motion/react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useTranslation } from "react-i18next";
import "./friend-animated-list.css";

export type FriendEventsListFriend = {
  friendId: string;
  avatarUrl: string | null;
  displayName: string;
  handle: string;
  wishlists: {
    id: string;
    title: string | null;
    event_date: string | null;
    description: string | null;
  }[];
};

type FriendEventsListProps = {
  friends: FriendEventsListFriend[];
  onSelect?: (friendId: string) => void;
  onScrollContainerReady?: (node: HTMLDivElement | null) => void;
};

type AnimatedFriendItemProps = {
  friend: FriendEventsListFriend;
  index: number;
  onSelect?: (friendId: string) => void;
};

const AnimatedFriendItem = ({ friend, index, onSelect }: AnimatedFriendItemProps) => {
  const { t } = useTranslation();
  const ref = useRef<HTMLButtonElement | null>(null);
  const inView = useInView(ref, { amount: 0.4, margin: "0px 0px -10% 0px" });

  const initials = friend.displayName?.trim().charAt(0) || friend.handle?.replace("@", "").charAt(0) || "F";
  const count = friend.wishlists.length;

  return (
    <motion.button
      ref={ref}
      type="button"
      className="friend-card"
      data-index={index}
      data-friend-id={friend.friendId}
      onClick={() => onSelect?.(friend.friendId)}
      initial={{ scale: 0.9, opacity: 0 }}
      animate={inView ? { scale: 1, opacity: 1 } : { scale: 0.9, opacity: 0 }}
      transition={{ duration: 0.25, delay: index * 0.04 }}
    >
      <div className="friend-card-header">
        <div className="friend-card-info">
          <Avatar className="h-12 w-12 ring-2 ring-white/40">
            <AvatarImage src={friend.avatarUrl || undefined} alt={friend.displayName} />
            <AvatarFallback>{initials}</AvatarFallback>
          </Avatar>
          <div className="friend-meta">
            <span className="friend-name">{friend.displayName}</span>
            <span className="friend-handle">{friend.handle}</span>
          </div>
        </div>
        <span className="friend-pill">
          <span aria-hidden>✨</span>
          {count} {count === 1 ? t('events.event_singular', 'event') : t('events.event_plural', 'events')}
        </span>
      </div>
    </motion.button>
  );
};

export const FriendEventsList = ({ friends, onSelect, onScrollContainerReady }: FriendEventsListProps) => {
  const listRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    onScrollContainerReady?.(listRef.current);
    return () => {
      onScrollContainerReady?.(null);
    };
  }, [onScrollContainerReady]);

  return (
    <div className="friends-scroll-list-container">
      <div ref={listRef} className="friends-scroll-list">
        {friends.map((friend, index) => (
          <AnimatedFriendItem key={friend.friendId} friend={friend} index={index} onSelect={onSelect} />
        ))}
      </div>
    </div>
  );
};

export default FriendEventsList;
