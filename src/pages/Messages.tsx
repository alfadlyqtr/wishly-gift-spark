import { Link, useNavigate } from "react-router-dom";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import AddButton from "@/components/AddButton";
import { MessageSquare, Search, Trash } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

const Messages = () => {
  const [q, setQ] = useState("");
  const { t } = useTranslation();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const { data } = useQuery({
    queryKey: ["threads"],
    queryFn: async () => {
      if (!supabase) return [] as any[];
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth.user?.id;
      if (!uid) return [] as any[];

      // Fetch all threads current user can see; RLS on threads limits to
      // threads where auth.uid() is a participant via thread_participants.
      const { data: rows, error } = await supabase
        .from("threads")
        .select(
          "id,title,created_at, thread_participants(user_id, user_profiles(id, username, full_name, avatar_url)), messages(id, content, user_id, created_at)"
        )
        .order("created_at", { foreignTable: "messages", ascending: false })
        .limit(1, { foreignTable: "messages" });

      if (error) {
        console.error("Error loading threads rows:", error);
        throw error;
      }

      console.log("Messages.tsx threads raw rows for uid", uid, rows);

      return await Promise.all((rows || []).map(async (row: any) => {
        const participants = (row.thread_participants || [])
          .map((p: any) => p.user_profiles)
          .filter(Boolean);
        const others = participants.filter((u: any) => u.id !== uid);

        // Prefer an explicit other participant
        let other: any = others[0] || null;

        // Fallback: if no other participant, infer from messages
        if (!other && row.messages && (row.messages as any[]).length > 0) {
          const otherMsg = (row.messages as any[]).find((m: any) => m.user_id && m.user_id !== uid);
          if (otherMsg) {
            other = {
              id: otherMsg.user_id,
              full_name: null,
              username: null,
              avatar_url: null,
            };
          }
        }

        // If we only know the other user's id, fetch their profile so we can show their name
        if (other && !other.full_name && !other.username && other.id) {
          try {
            const { data: prof } = await supabase
              .from("user_profiles")
              .select("id, username, full_name, avatar_url")
              .eq("id", other.id)
              .maybeSingle();
            if (prof) {
              other = prof as any;
            }
          } catch {
            // ignore profile fetch errors; we'll fall back to generic label
          }
        }

        let name = "Conversation";
        let avatar_url: string | null = null;

        if (other) {
          name = other.full_name || other.username || t('messages.unknown_user', 'Unknown User');
          avatar_url = other.avatar_url ?? null;
        } else {
          // Truly only you in this thread
          name = t('messages.just_you', 'Just You');
          avatar_url = null;
        }

        const last = (row.messages && row.messages[0]) || null;
        return {
          id: row.id,
          name: name || row.title || "Conversation",
          avatar_url,
          last: last?.content || "",
          time: last?.created_at
            ? new Date(last.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
            : "",
          unread: 0,
        };
      }));
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (threadId: string) => {
      if (!supabase) return;
      await supabase.from("threads").delete().eq("id", threadId);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["threads"] });
    },
  });

  const threads = useMemo(() => {
    const list = (data || []) as Array<{ id: string; name: string; avatar_url?: string; last: string; time: string; unread: number }>;
    if (!q.trim()) return list;
    const k = q.toLowerCase();
    return list.filter((t) =>
      (t.name || "").toLowerCase().includes(k) || (t.last || "").toLowerCase().includes(k)
    );
  }, [data, q]);

  return (
    <div className="container max-w-2xl mx-auto px-4 py-6 space-y-6">
      {/* Header matching Explore/Wishlists style */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="relative inline-flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[hsl(var(--brand-cool-start))] via-[hsl(var(--brand-cool-end))] to-[hsl(var(--brand-warm-end))] shadow-[0_12px_30px_rgba(200,80,192,0.45)] ring-1 ring-white/40">
            <MessageSquare className="h-5 w-5 text-white drop-shadow" />
            <span className="absolute -inset-1 rounded-[14px] blur-md bg-gradient-to-br from-[#ffcc70]/20 to-[#c850c0]/10" aria-hidden="true" />
          </div>
          <h2 className="text-2xl font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-[hsl(var(--brand-cool-start))] via-[hsl(var(--brand-cool-end))] to-[hsl(var(--brand-warm-end))] drop-shadow">
            {t('messages.title', 'Messages')}
          </h2>
        </div>
        <AddButton ariaLabel={t('messages.new_conversation', 'New conversation')} onClick={() => navigate('/chat/new')} />
      </div>

      {/* Search bar styled like Explore */}
      <div className="mx-auto w-full max-w-md">
        <div className="rounded-[14px] p-[2px] bg-gradient-to-r from-[hsl(var(--brand-cool-start))] via-[hsl(var(--brand-cool-end))] to-[hsl(var(--brand-warm-end))] shadow-[0_12px_28px_rgba(200,80,192,0.18)]">
          <div className="relative rounded-[12px] bg-white shadow-sm">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 inline-flex h-8 w-8 items-center justify-center rounded-full bg-white text-[hsl(var(--brand-cool-start))] shadow-[0_3px_8px_rgba(65,88,208,0.18)]">
              <Search className="h-4.5 w-4.5" />
            </span>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={t('messages.search_placeholder', 'Search by name, username, or email')}
              aria-label={t('messages.search_aria', 'Search')}
              className="h-12 w-full rounded-[12px] border-0 pl-12 pr-12 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
            />
          </div>
        </div>
      </div>

      <div className="space-y-3">
        {threads.map((thread) => {
          const handleDelete = (e: React.MouseEvent) => {
            e.stopPropagation();
            e.preventDefault();
            if (!window.confirm(t('messages.delete_confirm', 'Delete this conversation?'))) return;
            deleteMutation.mutate(thread.id);
          };

          return (
          <div
            key={thread.id}
            onClick={() => navigate(`/chat/${thread.id}`)}
            className="w-full flex items-center justify-between rounded-3xl bg-[rgba(200,80,192,0.04)] backdrop-blur px-5 py-3 border border-[hsl(var(--brand-cool-start))]/35 shadow-md hover:border-[hsl(var(--brand-cool-start))]/70 hover:shadow-lg hover:bg-[rgba(200,80,192,0.08)] transition-all duration-150 cursor-pointer"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="relative inline-flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-[hsl(var(--brand-cool-start))] via-[hsl(var(--brand-cool-end))] to-[hsl(var(--brand-warm-end))] ring-2 ring-white shadow-sm">
                <Avatar className="h-9 w-9 bg-background">
                  <AvatarImage src={thread.avatar_url} />
                  <AvatarFallback className="bg-gradient-to-br from-[hsl(var(--brand-cool-start))] via-[hsl(var(--brand-cool-end))] to-[hsl(var(--brand-warm-end))] text-white text-sm font-semibold">
                    {thread.name[0]}
                  </AvatarFallback>
                </Avatar>
              </div>
              <div className="text-left min-w-0">
                <div className="font-semibold truncate max-w-[180px] sm:max-w-xs text-foreground">{thread.name}</div>
                <div className="text-xs text-muted-foreground line-clamp-1">
                  {thread.last || thread.time
                    ? thread.last
                    : thread.name && `Say hi to ${thread.name.split(" ")[0]}`}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0 ml-2">
              <span className="text-[11px] text-muted-foreground whitespace-nowrap">{thread.time}</span>
              <button
                type="button"
                onClick={handleDelete}
                className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-red-200 text-red-500 bg-white/80 hover:bg-red-50 hover:border-red-400 text-[11px]"
              >
                ×
              </button>
            </div>
          </div>
          );
        })}
        {threads.length === 0 && (
          <div className="rounded-2xl bg-white/60 px-3 py-4 text-center text-sm text-muted-foreground">{t('messages.empty_state', 'No conversations yet.')}</div>
        )}
      </div>
    </div>
  );
};

export default Messages;
