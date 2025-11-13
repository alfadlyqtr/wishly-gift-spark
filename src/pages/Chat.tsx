import { useParams, useNavigate } from "react-router-dom";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import BackButton from "@/components/BackButton";
import { MessageSquare, Search, Send, Users } from "lucide-react";
import { openOrCreateDirectThread } from "@/lib/messages";

const Chat = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [text, setText] = useState("");
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const qc = useQueryClient();

  // Get current user id
  const [uid, setUid] = useState<string | null>(null);
  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getUser().then(({ data }) => setUid(data.user?.id ?? null));
  }, []);

  // Demo fallback if Supabase not configured
  const demo = !supabase;

  const { data: messages = [] } = useQuery({
    queryKey: ["messages", id],
    enabled: !!supabase && !!id && id !== "new",
    queryFn: async () => {
      const { data, error } = await supabase
        .from("messages")
        .select("id, content, user_id, created_at")
        .eq("thread_id", id as string)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data || [];
    },
  });

  // Realtime subscription for new messages in this thread
  useEffect(() => {
    if (!supabase || !id || id === "new") return;
    const channel = supabase
      .channel(`chat:${id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `thread_id=eq.${id}` },
        () => {
          qc.invalidateQueries({ queryKey: ["messages", id] });
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [id, qc]);

  const sendMutation = useMutation({
    mutationFn: async (content: string) => {
      if (!supabase || !uid || !id) return;
      const { error } = await supabase.from("messages").insert({
        thread_id: id,
        user_id: uid,
        content,
      });
      if (error) throw error;
      // Emit activity for notifications/feed
      await supabase.from("activities").insert({
        user_id: uid,
        activity_type: "message_sent",
        target_id: id,
      });
    },
    onSuccess: () => {
      setText("");
      qc.invalidateQueries({ queryKey: ["messages", id] });
    },
  });

  const send = () => {
    const v = text.trim();
    if (!v) return;
    if (!id || id === "new") return; // can't send until a thread exists
    sendMutation.mutate(v);
  };

  // Scroll to bottom on list change
  useEffect(() => {
    viewportRef.current?.lastElementChild?.scrollIntoView({ behavior: "smooth" });
  }, [messages?.length]);

  const renderMessages = (!id || id === "new")
    ? []
    : (demo
        ? [
            { id: "m1", content: "Hi there!", user_id: "demo_other", created_at: new Date().toISOString() },
            { id: "m2", content: "Hello 👋", user_id: "demo_me", created_at: new Date().toISOString() },
          ]
        : messages);

  // New Conversation flow (id === 'new')
  const [newQ, setNewQ] = useState("");
  const { data: userResults = [], isLoading: usersLoading } = useQuery({
    queryKey: ["chat-new", newQ],
    enabled: !!supabase && id === "new" && newQ.trim().length > 0,
    queryFn: async () => {
      const s = newQ.trim();
      const { data } = await supabase
        .from("user_profiles")
        .select("id, username, full_name, avatar_url, is_searchable")
        .eq("is_searchable", true)
        .or(`username.ilike.%${s}%,full_name.ilike.%${s}%`)
        .limit(20);
      return data || [];
    },
  });

  const startDirect = async (otherId: string) => {
    const tid = await openOrCreateDirectThread(otherId);
    if (tid) navigate(`/chat/${tid}`);
  };

  return (
    <div className="container max-w-2xl mx-auto px-4 py-6 h-[calc(100vh-6rem)] flex flex-col gap-4">
      {/* Branded header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="relative inline-flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[hsl(var(--brand-cool-start))] via-[hsl(var(--brand-cool-end))] to-[hsl(var(--brand-warm-end))] shadow-[0_12px_30px_rgba(200,80,192,0.45)] ring-1 ring-white/40">
            <MessageSquare className="h-5 w-5 text-white drop-shadow" />
            <span className="absolute -inset-1 rounded-[14px] blur-md bg-gradient-to-br from-[#ffcc70]/20 to-[#c850c0]/10" aria-hidden="true" />
          </div>
          <h2 className="text-2xl font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-[hsl(var(--brand-cool-start))] via-[hsl(var(--brand-cool-end))] to-[hsl(var(--brand-warm-end))] drop-shadow">
            {id === 'new' ? 'New Message' : 'Conversation'}
          </h2>
        </div>
        <BackButton onClick={() => navigate(-1)}>Back</BackButton>
      </div>

      {id === 'new' ? (
        <div className="mx-auto w-full max-w-md space-y-4">
          {/* Explore-like search */}
          <div className="rounded-[14px] p-[2px] bg-gradient-to-r from-[hsl(var(--brand-cool-start))] via-[hsl(var(--brand-cool-end))] to-[hsl(var(--brand-warm-end))] shadow-[0_12px_28px_rgba(200,80,192,0.18)]">
            <div className="relative rounded-[12px] bg-white shadow-sm">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 inline-flex h-8 w-8 items-center justify-center rounded-full bg-white text-[hsl(var(--brand-cool-start))] shadow-[0_3px_8px_rgba(65,88,208,0.18)]">
                <Search className="h-4.5 w-4.5" />
              </span>
              <input
                value={newQ}
                onChange={(e) => setNewQ(e.target.value)}
                placeholder="Search users to message"
                aria-label="Search users"
                className="h-12 w-full rounded-[12px] border-0 pl-12 pr-12 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
              />
            </div>
          </div>
          <div className="space-y-2">
            {usersLoading ? (
              <div className="text-sm text-muted-foreground">Loading...</div>
            ) : (userResults as any[]).length === 0 ? (
              <div className="rounded-2xl bg-white/70 backdrop-blur ring-1 ring-white/70 p-3 text-sm text-muted-foreground">Type a name or username to search.</div>
            ) : (
              (userResults as any[]).map((u: any) => (
                <button key={u.id} onClick={() => startDirect(u.id)} className="w-full flex items-center gap-3 rounded-2xl bg-white/80 backdrop-blur ring-1 ring-white/70 px-3 py-2 hover:shadow-sm">
                  <div className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-[hsl(var(--brand-cool-start))] via-[hsl(var(--brand-cool-end))] to-[hsl(var(--brand-warm-end))] text-white ring-1 ring-white/60">
                    <Users className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 text-left">
                    <div className="font-medium truncate">{u.full_name || u.username || 'User'}</div>
                    {u.username && <div className="text-xs text-muted-foreground">@{u.username}</div>}
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      ) : (
        <>
          {/* Messages viewport */}
          <div ref={viewportRef} className="flex-1 overflow-y-auto rounded-xl bg-white/70 backdrop-blur ring-1 ring-white/70 p-3 space-y-2">
            {renderMessages.map((m: any) => {
              const me = uid ? (m.user_id === uid) : (m.user_id === 'demo_me');
              return (
                <div key={m.id} className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm shadow-sm ${me ? 'ml-auto bg-gradient-to-br from-[hsl(var(--brand-cool-start))] via-[hsl(var(--brand-cool-end))] to-[hsl(var(--brand-warm-end))] text-white' : 'bg-white text-foreground ring-1 ring-black/5'}`}>
                  <div>{m.content}</div>
                  <div className={`mt-1 text-[10px] ${me ? 'text-white/80' : 'text-muted-foreground'}`}>{new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                </div>
              );
            })}
            {renderMessages.length === 0 && (
              <div className="text-sm text-muted-foreground">Say hi to start the conversation.</div>
            )}
          </div>

          {/* Composer — Explore-like framed input with Send button */}
          <div className="mx-auto w-full max-w-md">
            <div className="rounded-[14px] p-[2px] bg-gradient-to-r from-[hsl(var(--brand-cool-start))] via-[hsl(var(--brand-cool-end))] to-[hsl(var(--brand-warm-end))] shadow-[0_12px_28px_rgba(200,80,192,0.18)]">
              <div className="relative flex items-center gap-2 rounded-[12px] bg-white shadow-sm px-2 py-1">
                <input
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder="Type a message"
                  className="h-10 flex-1 rounded-[10px] border-0 px-3 text-sm focus:outline-none"
                  onKeyDown={(e) => { if (e.key === 'Enter') send(); }}
                />
                <button
                  type="button"
                  onClick={send}
                  disabled={!text.trim() || sendMutation.isPending}
                  className="inline-flex h-9 px-3 items-center justify-center gap-1 rounded-xl text-white bg-gradient-to-br from-[hsl(var(--brand-cool-start))] via-[hsl(var(--brand-cool-end))] to-[hsl(var(--brand-warm-end))] shadow-[0_8px_18px_rgba(200,80,192,0.28)] disabled:opacity-60"
                >
                  <Send className="h-4 w-4" />
                  <span>Send</span>
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default Chat;
