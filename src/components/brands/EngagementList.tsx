import React from "react";
import { useTranslation } from "react-i18next";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface UserProfile {
  id: string;
  name: string;
  username: string | null;
  avatar_url: string | null;
}

interface EngagementListProps {
  users: UserProfile[];
  label: string;
  emptyMessage?: string;
}

export const EngagementList: React.FC<EngagementListProps> = ({ users, label, emptyMessage }) => {
  const { t } = useTranslation();

  // Group users and count occurrences
  const groupedUsers = users.reduce((acc, user) => {
    if (!acc[user.id]) {
      acc[user.id] = { ...user, count: 1 };
    } else {
      acc[user.id].count += 1;
    }
    return acc;
  }, {} as Record<string, UserProfile & { count: number }>);

  const displayUsers = Object.values(groupedUsers);

  return (
    <div className="space-y-2">
      <h4 className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">{label}</h4>
      {displayUsers.length === 0 ? (
        <p className="text-[10px] text-muted-foreground italic px-1">{emptyMessage || t("brand.no_activity_yet", "No activity yet")}</p>
      ) : (
        <ScrollArea className="h-auto max-h-[150px] w-full rounded-xl border border-slate-100 bg-white p-1.5 shadow-sm">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
            {displayUsers.map((user) => (
              <div 
                key={user.id} 
                className="flex items-center gap-2 p-1.5 rounded-lg bg-slate-50/50 border border-slate-100/50 hover:bg-slate-100/50 transition-colors relative group"
              >
                <Avatar className="h-7 w-7 border-2 border-white shadow-sm">
                  <AvatarImage src={user.avatar_url || ""} alt={user.name} />
                  <AvatarFallback className="text-[10px] bg-gradient-to-br from-[hsl(var(--brand-cool-start))] to-[hsl(var(--brand-warm-end))] text-white font-bold">
                    {user.name?.charAt(0)?.toUpperCase() || "?"}
                  </AvatarFallback>
                </Avatar>
                <div className="flex flex-col min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-[11px] font-semibold truncate leading-none mb-0.5">{user.name}</span>
                    {user.count > 1 && (
                      <span className="text-[9px] font-bold text-white bg-slate-800 rounded-full px-1.5 py-0.5 flex-shrink-0 animate-in zoom-in duration-300">
                        x{user.count}
                      </span>
                    )}
                  </div>
                  {user.username && (
                    <span className="text-[9px] text-muted-foreground truncate leading-none">@{user.username}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      )}
    </div>
  );
};
