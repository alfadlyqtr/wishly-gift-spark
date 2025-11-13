import { Link, useNavigate } from "react-router-dom";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import AddButton from "@/components/AddButton";
import { MessageSquare, Search } from "lucide-react";

const Messages = () => {
  const [q, setQ] = useState("");
  const navigate = useNavigate();
  const { data } = useQuery({
    queryKey: ["threads"],
    queryFn: async () => {
      if (!supabase) return [] as any[];
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth.user?.id;
      if (!uid) return [] as any[];
      // Fetch threads where current user participates, include participants and latest message
      const { data: rows, error } = await supabase
        .from("threads")
        .select(
          "id,title,created_at, thread_participants!inner(user_id, user_profiles(id, username, full_name, avatar_url)), messages(id, content, user_id, created_at)"
        )
        .eq("thread_participants.user_id", uid)
        .order("created_at", { foreignTable: "messages", ascending: false })
        .limit(1, { foreignTable: "messages" });
      if (error) throw error;
      return (rows || []).map((t: any) => {
        const others = (t.thread_participants || []).map((p: any) => p.user_profiles).filter((u: any) => u?.id && u.id !== uid);
        const other = others[0] || (t.thread_participants?.[0]?.user_profiles ?? null);
        const last = (t.messages && t.messages[0]) || null;
        return {
          id: t.id,
          name: other?.full_name || other?.username || t.title || "Conversation",
          last: last?.content || "",
          time: last?.created_at ? new Date(last.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "",
          unread: 0,
        };
      });
    },
  });

  const threads = useMemo(() => {
    const list = (data || []) as Array<{ id: string; name: string; last: string; time: string; unread: number }>;
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
            Messages
          </h2>
        </div>
        <AddButton ariaLabel="New conversation" onClick={() => navigate('/chat/new')} />
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
              placeholder="Search by name, username, or email"
              aria-label="Search"
              className="h-12 w-full rounded-[12px] border-0 pl-12 pr-12 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
            />
          </div>
        </div>
      </div>

      <div className="space-y-2">
        {threads.map((t) => (
          <button
            key={t.id}
            onClick={() => navigate(`/chat/${t.id}`)}
            className="w-full flex items-center justify-between rounded-xl bg-white/70 backdrop-blur px-3 py-2 ring-1 ring-white/70 hover:shadow-sm"
          >
            <div className="flex items-center gap-3">
              <div className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-[hsl(var(--brand-cool-start))] via-[hsl(var(--brand-cool-end))] to-[hsl(var(--brand-warm-end))] text-white ring-1 ring-white/60">{t.name[0]}</div>
              <div className="text-left">
                <div className="font-medium">{t.name}</div>
                <div className="text-xs text-muted-foreground line-clamp-1">{t.last}</div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {t.unread > 0 && (
                <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-black text-white text-[11px] px-1">{t.unread}</span>
              )}
              <span className="text-xs text-muted-foreground">{t.time}</span>
            </div>
          </button>
        ))}
        {threads.length === 0 && (
          <div className="rounded-2xl bg-white/60 px-3 py-2 text-sm text-muted-foreground">No conversations yet.</div>
        )}
      </div>
    </div>
  );
};

export default Messages;
