import { useParams, useNavigate } from "react-router-dom";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import BackButton from "@/components/BackButton";
import { MessageSquare, Search, Send, Users, Loader2, Mic, Paperclip, Play, Pause } from "lucide-react";
import { openOrCreateDirectThread } from "@/lib/messages";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

const Chat = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [text, setText] = useState("");
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordingStartRef = useRef<number | null>(null);
  const [pendingImage, setPendingImage] = useState<File | null>(null);
  const [pendingImagePreview, setPendingImagePreview] = useState<string | null>(null);
  const [pendingAudio, setPendingAudio] = useState<Blob | null>(null);
  const [pendingAudioDuration, setPendingAudioDuration] = useState<number | null>(null);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const audioRefs = useRef<Record<string, HTMLAudioElement | null>>({});
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [audioPosition, setAudioPosition] = useState<Record<string, number>>({});
  const [audioRate, setAudioRate] = useState<Record<string, number>>({});
  const [activeReactionFor, setActiveReactionFor] = useState<string | null>(null);
  const qc = useQueryClient();
  const { t, i18n } = useTranslation();
  const [isUploading, setIsUploading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);

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
        .select("id, content, user_id, created_at, pinned, attachment_type, attachment_url, attachment_duration_seconds, attachment_size_bytes")
        .eq("thread_id", id as string)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data || [];
    },
  });

  const [localPinned, setLocalPinned] = useState<Record<string, boolean>>({});

  const pinMutation = useMutation({
    mutationFn: async ({ messageId, pinned }: { messageId: string; pinned: boolean }) => {
      if (!supabase) return;
      const { error } = await supabase
        .from("messages" as any)
        .update({ pinned })
        .eq("id", messageId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["messages", id] });
    },
    onError: (error: any, variables) => {
      console.error("Failed to update pin state", error);
      if (variables?.messageId) {
        setLocalPinned((prev) => ({
          ...prev,
          [variables.messageId]: !variables.pinned,
        }));
      }
      toast.error(error?.message || t("chat.error_pin", "Failed to save message"));
    },
  });

  // Reactions for all messages in this thread
  const { data: messageReactions = [] } = useQuery({
    queryKey: ["message-reactions", id, messages.length],
    enabled: !!supabase && !!id && id !== "new" && !!uid && (messages as any[]).length > 0,
    queryFn: async () => {
      try {
        const ids = (messages as any[]).map((m: any) => m.id);
        const { data, error } = await supabase
          .from("message_reactions" as any)
          .select("id, message_id, user_id, emoji, created_at")
          .in("message_id", ids as any);
        if (error) {
          console.warn("message_reactions query failed", error);
          return [] as any[];
        }
        return data || [];
      } catch (e) {
        console.warn("message_reactions query threw", e);
        return [] as any[];
      }
    },
  });

  // Header: other participant profile for existing threads
  const { data: otherProfile } = useQuery({
    queryKey: ["chat-header", id, uid],
    enabled: !!supabase && !!id && id !== "new" && !!uid,
    queryFn: async () => {
      // 1) Try to find the other participant from thread_participants
      const { data, error } = await supabase
        .from("thread_participants")
        .select("user_id, user_profiles(id, username, full_name, avatar_url)")
        .eq("thread_id", id as string);
      if (error) throw error;
      const rows = data || [];
      const participants = rows
        .map((r: any) => r.user_profiles)
        .filter(Boolean);
      let other: any = participants.find((u: any) => u.id !== uid) || null;

      // 2) Fallback: infer other user from messages if participants list is empty or incomplete
      if (!other) {
        const { data: msgs, error: msgErr } = await supabase
          .from("messages")
          .select("user_id")
          .eq("thread_id", id as string)
          .order("created_at", { ascending: false })
          .limit(20);
        if (msgErr) throw msgErr;

        const otherMsg = (msgs || []).find((m: any) => m.user_id && m.user_id !== uid);
        if (otherMsg) {
          const { data: prof } = await supabase
            .from("user_profiles")
            .select("id, username, full_name, avatar_url")
            .eq("id", otherMsg.user_id)
            .maybeSingle();
          if (prof) {
            other = prof as any;
          }
        }
      }

      // 3) If we found the other user, check if they're a brand and use brand name/logo
      if (other && other.id) {
        const { data: brandData } = await (supabase as any)
          .from("brands")
          .select("brand_name, logo_url")
          .eq("user_id", other.id)
          .maybeSingle();
        
        if (brandData) {
          // Override with brand info
          other = {
            ...other,
            full_name: brandData.brand_name || other.full_name,
            avatar_url: brandData.logo_url || other.avatar_url,
            is_brand: true,
          };
        }
      }

      if (!other) {
        // Truly only you in this thread
        return {
          full_name: "Just You",
          username: "",
          avatar_url: null,
        };
      }

      return other;
    },
  });

  const handleTogglePlay = (messageId: string) => {
    const current = audioRefs.current[messageId];
    if (!current) return;

    // Stop any other playing audio
    if (playingId && playingId !== messageId) {
      const prev = audioRefs.current[playingId];
      if (prev) {
        prev.pause();
        prev.currentTime = 0;
      }
    }

    if (!current.paused && playingId === messageId) {
      current.pause();
      setPlayingId(null);
    } else {
      current.play().catch(() => {});
      setPlayingId(messageId);
    }
  };

  const handleAudioTimeUpdate = (messageId: string, el: HTMLAudioElement) => {
    setAudioPosition((prev) => ({ ...prev, [messageId]: el.currentTime || 0 }));
  };

  const handleAudioEnded = (messageId: string) => {
    setPlayingId((prev) => (prev === messageId ? null : prev));
    setAudioPosition((prev) => ({ ...prev, [messageId]: 0 }));
  };

  const handleSeek = (messageId: string, value: number) => {
    const el = audioRefs.current[messageId];
    if (!el || Number.isNaN(value)) return;
    el.currentTime = value;
    setAudioPosition((prev) => ({ ...prev, [messageId]: value }));
  };

  const handleToggleSpeed = (messageId: string) => {
    const el = audioRefs.current[messageId];
    if (!el) return;
    const current = audioRate[messageId] || 1;
    const next = current === 1 ? 1.5 : current === 1.5 ? 2 : 1;
    el.playbackRate = next;
    setAudioRate((prev) => ({ ...prev, [messageId]: next }));
  };

  const formatSeconds = (secs: number | undefined) => {
    if (!secs || !Number.isFinite(secs)) return "0:00";
    const s = Math.max(0, Math.floor(secs));
    const m = Math.floor(s / 60);
    const r = s % 60;
    return `${m}:${r.toString().padStart(2, "0")}`;
  };

  const allowedReactions = ["👍", "❤️", "😂", "😮", "😢", "😡", "🙏"] as const;

  const reactionMutation = useMutation({
    mutationFn: async ({ messageId, emoji }: { messageId: string; emoji: string }) => {
      if (!supabase || !uid) return;

      // Find existing reaction by this user on this message
      const existing = (messageReactions as any[]).find(
        (r: any) => r.message_id === messageId && r.user_id === uid
      );

      // If the same emoji is chosen again, remove the reaction
      if (existing && existing.emoji === emoji) {
        const { error } = await supabase
          .from("message_reactions" as any)
          .delete()
          .eq("id", existing.id);
        if (error) throw error;
        return;
      }

      if (existing) {
        const { error } = await supabase
          .from("message_reactions" as any)
          .update({ emoji })
          .eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("message_reactions" as any).insert({
          message_id: messageId,
          user_id: uid,
          emoji,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["message-reactions", id] });
    },
    onError: (error: any) => {
      console.error("Failed to update reaction", error);
      toast.error(error?.message || t("chat.error_reaction", "Failed to update reaction"));
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
      await supabase.from("activities").insert({
        user_id: uid,
        activity_type: "message_sent",
        target_id: id,
      });

      try {
        const pushResult = await supabase.functions.invoke("push-dispatch", { body: { type: "message_sent", threadId: id } });
        if (import.meta.env.DEV) {
          console.log("[Push] message_sent dispatch result:", pushResult);
        }
      } catch (pushErr) {
        if (import.meta.env.DEV) {
          console.error("[Push] message_sent dispatch error:", pushErr);
        }
      }
    },
    onSuccess: () => {
      setText("");
      qc.invalidateQueries({ queryKey: ["messages", id] });
    },
    onError: (error: any) => {
      console.error("Failed to send message:", error);
      toast.error(error?.message || t('chat.error_sending', 'Failed to send message'));
    },
  });

  const send = () => {
    if (!id || id === "new") return; // can't send until a thread exists

    // 1) If an image is staged, send it first
    if (pendingImage) {
      (async () => {
        try {
          setIsUploading(true);
          await uploadAttachment({ file: pendingImage, type: "image" });
          setPendingImage(null);
          if (pendingImagePreview) {
            URL.revokeObjectURL(pendingImagePreview);
          }
          setPendingImagePreview(null);
          setText("");
        } catch (err: any) {
          console.error("Image send failed", err);
          toast.error(err?.message || t('chat.error_upload_image', 'Failed to upload image'));
        } finally {
          setIsUploading(false);
        }
      })();
      return;
    }

    // 2) If a voice note is staged, send it
    if (pendingAudio) {
      (async () => {
        try {
          setIsUploading(true);
          await uploadAttachment({
            file: pendingAudio,
            type: "audio",
            durationSeconds: pendingAudioDuration ?? undefined,
          });
          setPendingAudio(null);
          setPendingAudioDuration(null);
          setText("");
        } catch (err: any) {
          console.error("Audio send failed", err);
          toast.error(err?.message || t('chat.error_upload_audio', 'Failed to upload voice note'));
        } finally {
          setIsUploading(false);
        }
      })();
      return;
    }

    // 3) Otherwise send plain text
    const v = text.trim();
    if (!v) return;
    sendMutation.mutate(v);
  };

  const uploadAttachment = async (params: {
    file: File | Blob;
    type: "image" | "audio";
    durationSeconds?: number | null;
  }) => {
    if (!supabase || !uid || !id) return;

    const size = (params.file as any).size ?? ("size" in params.file ? (params.file as File).size : 0);
    const ext = params.type === "image" && "name" in params.file
      ? (params.file as File).name.split(".").pop() || "img"
      : params.type === "audio"
        ? "webm"
        : "bin";

    const path = `${id}/${uid}/${Date.now()}.${ext}`;
    const contentType = params.type === "image" ? ("type" in params.file ? (params.file as File).type : "image/*") : "audio/webm";

    const { error: uploadError } = await supabase.storage
      .from("chat-attachments")
      .upload(path, params.file, {
        cacheControl: "3600",
        upsert: false,
        contentType,
      });
    if (uploadError) throw uploadError;

    const { data: publicData } = supabase.storage.from("chat-attachments").getPublicUrl(path);
    const url = publicData?.publicUrl;

    const { error: insertError } = await supabase.from("messages").insert({
      thread_id: id,
      user_id: uid,
      content: "",
      attachment_type: params.type,
      attachment_url: url,
      attachment_duration_seconds: params.durationSeconds ?? null,
      attachment_size_bytes: size,
    });
    if (insertError) throw insertError;

    try {
      await supabase.functions.invoke("push-dispatch", { body: { type: "message_sent", threadId: id } });
    } catch {}

    qc.invalidateQueries({ queryKey: ["messages", id] });
  };

  const handlePickImage = () => {
    if (!fileInputRef.current || !uid || !id) return;
    fileInputRef.current.click();
  };

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (file.size > 15 * 1024 * 1024) {
      toast.error(t('chat.image_too_large', 'Image must be 15MB or less'));
      return;
    }

    // Clear previous preview if any
    if (pendingImagePreview) {
      URL.revokeObjectURL(pendingImagePreview);
    }

    const previewUrl = URL.createObjectURL(file);
    setPendingImage(file);
    setPendingImagePreview(previewUrl);
  };

  const toggleRecording = async () => {
    if (!supabase || !uid || !id) return;

    if (isRecording) {
      const rec = mediaRecorderRef.current;
      if (rec && rec.state === "recording") {
        rec.stop();
      }
      setIsRecording(false);
      return;
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      toast.error(t('chat.no_mic', 'Microphone not available'));
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const chunks: BlobPart[] = [];
      const recorder = new MediaRecorder(stream, { mimeType: "audio/webm" });

      recorder.ondataavailable = (ev: BlobEvent) => {
        if (ev.data && ev.data.size > 0) chunks.push(ev.data);
      };

      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunks, { type: recorder.mimeType || "audio/webm" });
        if (!blob.size) {
          setIsRecording(false);
          setRecordingSeconds(0);
          recordingStartRef.current = null;
          return;
        }
        const startedAt = recordingStartRef.current;
        const durationSec = startedAt ? Math.min(60, Math.round((Date.now() - startedAt) / 1000)) : null;
        setPendingAudio(blob);
        setPendingAudioDuration(durationSec ?? null);
        setIsRecording(false);
        setRecordingSeconds(0);
        recordingStartRef.current = null;
      };

      recordingStartRef.current = Date.now();
      mediaRecorderRef.current = recorder;
      setIsRecording(true);
      setRecordingSeconds(0);
      recorder.start();
      // safety stop at 61s
      const stopAt = setTimeout(() => {
        if (recorder.state === "recording") recorder.stop();
      }, 61000);

      // simple countdown timer
      const started = Date.now();
      const timer = setInterval(() => {
        const elapsed = Math.floor((Date.now() - started) / 1000);
        setRecordingSeconds(elapsed);
        if (elapsed >= 60) {
          clearInterval(timer);
        }
      }, 1000);

      recorder.onstop = ((origOnStop) => async () => {
        clearInterval(timer);
        clearTimeout(stopAt);
        await (origOnStop as any)();
      })(recorder.onstop as any);
    } catch (err: any) {
      console.error("Mic error", err);
      toast.error(err?.message || t('chat.error_mic', 'Could not access microphone'));
    }
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
  const [isSelecting, setIsSelecting] = useState(false);
  const { data: userResults = [], isLoading: usersLoading } = useQuery({
    // Depend on uid so that we only run once the current user is known
    queryKey: ["chat-new", newQ, uid],
    enabled: !!supabase && !!uid && id === "new" && newQ.trim().length > 0,
    queryFn: async () => {
      const s = newQ.trim().toLowerCase();

      // 1) Load follower relationships that involve the current user
      //    We rely on RLS on the followers table to only return rows
      //    where auth.uid() is either user_id or following_id.
      const { data: rels, error: relsError } = await supabase
        .from("followers")
        .select("user_id, following_id, status")
        .eq("status", "accepted")
        .or(`user_id.eq.${uid},following_id.eq.${uid}`);

      if (relsError) throw relsError;

      // 2) Compute mutual relationships (both follow each other)
      const outgoing = new Set((rels || []).filter(r => r.user_id === uid).map(r => r.following_id as string));
      const incoming = new Set((rels || []).filter(r => r.following_id === uid).map(r => r.user_id as string));

      const mutualIds: string[] = [];
      outgoing.forEach(id => {
        if (incoming.has(id)) mutualIds.push(id);
      });

      if (mutualIds.length === 0) return [];

      // 3) Fetch profiles for mutual friends
      const { data: profiles, error: profilesError } = await supabase
        .from("user_profiles")
        .select("id, username, full_name, avatar_url")
        .in("id", mutualIds);

      if (profilesError) throw profilesError;

      const list = (profiles || []) as any[];

      // 4) Filter by search text on username/full_name (case-insensitive)
      if (!s) return list;

      return list.filter((u) => {
        const uname = (u.username || "").toString().toLowerCase();
        const fname = (u.full_name || "").toString().toLowerCase();
        return uname.includes(s) || fname.includes(s);
      });
    },
  });

  const startDirect = async (otherId: string) => {
    if (isSelecting) return;
    setIsSelecting(true);
    try {
      const { id: tid, error } = await openOrCreateDirectThread(otherId);
      if (error) {
        console.error(error);
        toast.error(error.message || error.details || t('chat.error_creating_thread', 'Could not create conversation'));
      } else if (tid) {
        navigate(`/chat/${tid}`);
      }
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message || t('chat.error_generic', 'Something went wrong'));
    } finally {
      setIsSelecting(false);
    }
  };

  return (
    <>
      <style>{`
        audio::-webkit-media-controls-mute-button,
        audio::-webkit-media-controls-volume-slider {
          display: none !important;
        }
      `}</style>
      <div className="container max-w-2xl mx-auto px-4 pt-4 pb-2 h-full flex flex-col overflow-hidden">
      {/* Branded header */}
      <div className="flex items-center justify-between gap-4 mb-4 shrink-0">
        <div className="flex items-center gap-3">
          <div className="relative inline-flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[hsl(var(--brand-cool-start))] via-[hsl(var(--brand-cool-end))] to-[hsl(var(--brand-warm-end))] shadow-[0_12px_30px_rgba(200,80,192,0.45)] ring-1 ring-white/40">
            <MessageSquare className="h-5 w-5 text-white drop-shadow" />
            <span className="absolute -inset-1 rounded-[14px] blur-md bg-gradient-to-br from-[#ffcc70]/20 to-[#c850c0]/10" aria-hidden="true" />
          </div>
          <h2 className="text-2xl font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-[hsl(var(--brand-cool-start))] via-[hsl(var(--brand-cool-end))] to-[hsl(var(--brand-warm-end))] drop-shadow">
            {id === 'new' ? t('chat.new_message_title', 'New Message') : t('chat.conversation_title', 'Conversation')}
          </h2>
        </div>
        <BackButton onClick={() => navigate(-1)}>{t('common.back', 'Back')}</BackButton>
      </div>

      {id === 'new' ? (
        <div className="mx-auto w-full max-w-md space-y-4 overflow-y-auto p-1">
          {/* Explore-like search */}
          <div className="rounded-[14px] p-[2px] bg-gradient-to-r from-[hsl(var(--brand-cool-start))] via-[hsl(var(--brand-cool-end))] to-[hsl(var(--brand-warm-end))] shadow-[0_12px_28px_rgba(200,80,192,0.18)]">
            <div className="relative rounded-[12px] bg-white shadow-sm">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 inline-flex h-8 w-8 items-center justify-center rounded-full bg-white text-[hsl(var(--brand-cool-start))] shadow-[0_3px_8px_rgba(65,88,208,0.18)]">
                <Search className="h-4.5 w-4.5" />
              </span>
              <input
                value={newQ}
                onChange={(e) => setNewQ(e.target.value)}
                placeholder={t('chat.search_users_placeholder', 'Search users to message')}
                aria-label={t('chat.search_users_aria', 'Search users')}
                className="h-12 w-full rounded-[12px] border-0 pl-12 pr-12 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
              />
            </div>
          </div>
          <div className="space-y-2">
            {usersLoading ? (
              <div className="text-sm text-muted-foreground">{t('common.loading', 'Loading...')}</div>
            ) : (userResults as any[]).length === 0 ? (
              <div className="rounded-2xl bg-white/70 backdrop-blur ring-1 ring-white/70 p-3 text-sm text-muted-foreground">{t('chat.search_hint', 'Type a name or username to search.')}</div>
            ) : (
              (userResults as any[]).map((u: any) => (
                <button
                  key={u.id}
                  onClick={() => startDirect(u.id)}
                  disabled={isSelecting}
                  className="w-full flex items-center gap-3 rounded-2xl bg-white/80 backdrop-blur ring-1 ring-white/70 px-3 py-2 hover:shadow-sm disabled:opacity-70 transition-all"
                >
                  <div className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-[hsl(var(--brand-cool-start))] via-[hsl(var(--brand-cool-end))] to-[hsl(var(--brand-warm-end))] text-white ring-1 ring-white/60">
                    {isSelecting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Users className="h-4 w-4" />}
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
        <div className="flex-1 min-h-0 flex items-center justify-center">
          <div className="w-full max-w-2xl rounded-3xl bg-white/90 backdrop-blur shadow-md border border-[hsl(var(--brand-cool-start))]/30 px-4 py-3 flex flex-col">
        {/* Thread header chip */}
          {otherProfile && (
            <div className="mb-1 flex flex-col items-center gap-1">
              <div className="inline-flex items-center gap-2 rounded-full bg-white/90 px-3 py-1 shadow-sm ring-1 ring-white/70">
                <Avatar className="h-7 w-7">
                  <AvatarImage src={otherProfile.avatar_url} />
                  <AvatarFallback className="text-xs font-semibold bg-gradient-to-br from-[hsl(var(--brand-cool-start))] via-[hsl(var(--brand-cool-end))] to-[hsl(var(--brand-warm-end))] text-white">
                    {(otherProfile.full_name || otherProfile.username || "?")[0]}
                  </AvatarFallback>
                </Avatar>
                <div className="text-xs text-foreground">
                  <div className="font-medium leading-tight truncate max-w-[160px]">
                    {otherProfile.full_name || otherProfile.username}
                  </div>
                  <div className="text-[10px] text-muted-foreground leading-tight">{t('chat.direct_message', 'Direct message')}</div>
                </div>
              </div>
              <div className="text-[10px] text-muted-foreground/80">
                {t('chat.autodelete_notice', 'Messages auto-delete after 7 days unless you pin them.')}
              </div>
            </div>
          )}

          {/* Messages viewport (scrolls inside the box) */}
          <div
            ref={viewportRef}
            className="flex-1 min-h-[220px] max-h-[420px] overflow-y-auto rounded-2xl bg-white/70 ring-1 ring-white/70 p-3 space-y-8 mb-2"
          >
            {renderMessages.map((m: any) => {
              const me = uid ? (m.user_id === uid) : (m.user_id === 'demo_me');
              const isImage = m.attachment_type === 'image' && m.attachment_url;
              const isAudio = m.attachment_type === 'audio' && m.attachment_url;
              const isThankYouCard = m.attachment_type === 'thank_you_card';
              const isPinned = localPinned[m.id] ?? !!m.pinned;
              const timeLabel = (() => {
                const d = new Date(m.created_at);
                const opts: Intl.DateTimeFormatOptions = { hour: '2-digit', minute: '2-digit' };
                return i18n.language === 'ar'
                  ? d.toLocaleTimeString('ar-EG', opts)
                  : d.toLocaleTimeString([], opts);
              })();

              const thankYou = (() => {
                if (!isThankYouCard) return null;
                try {
                  const parsed = JSON.parse(String(m.content || ''));
                  return parsed && typeof parsed === 'object' ? parsed : null;
                } catch {
                  return null;
                }
              })();

              return (
                <div
                  key={m.id}
                  className={`flex w-full ${me ? 'justify-end' : 'justify-start'} mb-0`}
                >
                  <div className="relative group max-w-[78%]">
                    <div
                      className={`w-full rounded-xl pl-3 pr-8 py-1.5 text-sm shadow-sm whitespace-pre-wrap break-words ${
                        me
                          ? 'bg-gradient-to-br from-[hsl(var(--brand-cool-start))] via-[hsl(var(--brand-cool-end))] to-[hsl(var(--brand-warm-end))] text-white'
                          : 'bg-white text-foreground ring-1 ring-black/5'
                      }`}
                    >
                      {isThankYouCard && thankYou && (
                        <div className="w-[220px] rounded-[20px] overflow-hidden shadow-[12px_12px_0px_rgba(0,0,0,0.1)] bg-white">
                          {/* Landscape section - 70% height */}
                          <div className="relative h-[180px] overflow-hidden">
                            {/* Sky gradient */}
                            <div className="absolute inset-0 bg-gradient-to-b from-[#e96594] to-[#f7e157]" />
                            
                            {/* Sun with glow - smaller dusk style */}
                            <div className="absolute bottom-[50%] left-[20%] w-[28px] h-[28px] rounded-full bg-white/90 flex items-center justify-center drop-shadow-[0_0_8px_rgba(255,200,150,0.8)]">
                              <div className="absolute w-[130%] h-[130%] rounded-full bg-orange-200/30" />
                            </div>
                            
                            {/* Ocean/sand area */}
                            <div className="absolute bottom-0 w-full h-[28%] bg-gradient-to-b from-[#f7da96] to-[#f1c07d]">
                              {/* Reflections */}
                              <div className="absolute top-[5%] left-[32%] w-10 h-2.5 bg-white/50" style={{clipPath:'polygon(0% 0%, 100% 0%, 50% 100%)'}} />
                              <div className="absolute top-[15%] left-[39%] w-20 h-4 bg-white/50" style={{clipPath:'polygon(0% 0%, 100% 0%, 60% 100%, 40% 100%)'}} />
                            </div>
                            
                            {/* Hills */}
                            <div className="absolute right-[-25%] bottom-[20%] w-[150px] h-[40px] rounded-full bg-[#e6b29d]" />
                            <div className="absolute right-[-36%] bottom-[10%] w-[150px] h-[80px] rounded-full bg-[#c29182]" />
                            <div className="absolute left-[-45%] bottom-[-15%] w-[200px] h-[80px] rounded-full bg-[#b77873] z-[3]" />
                            <div className="absolute right-[-45%] bottom-[-20%] w-[200px] h-[80px] rounded-full bg-[#a16773] z-[3]" />
                            
                            {/* Trees - smaller, fewer */}
                            <svg className="absolute bottom-[18%] left-[8%] w-[30px] h-[45px] z-[3]" viewBox="0 0 50 70">
                              <ellipse cx="25" cy="20" rx="18" ry="20" fill="#a16773" />
                              <rect x="22" y="35" width="6" height="35" fill="#8b5a5a" />
                            </svg>
                            <svg className="absolute bottom-[12%] right-[8%] w-[35px] h-[50px] z-[3]" viewBox="0 0 65 80">
                              <ellipse cx="32" cy="22" rx="22" ry="22" fill="#a16773" />
                              <rect x="28" y="40" width="8" height="40" fill="#8b5a5a" />
                            </svg>
                            
                            {/* Avatar + Name + Gift - top left */}
                            <div className="absolute top-3 left-3 z-10 flex items-center gap-2">
                              <Avatar className="h-10 w-10 ring-2 ring-white/60 shadow-lg">
                                <AvatarImage src={thankYou?.recipient?.avatar_url || ''} />
                                <AvatarFallback className="bg-white/30 text-white font-semibold">
                                  {String(thankYou?.recipient?.full_name || thankYou?.recipient?.username || 'U').charAt(0)}
                                </AvatarFallback>
                              </Avatar>
                              <div className="text-white drop-shadow">
                                <div className="text-sm font-bold">{thankYou?.recipient?.full_name?.split(' ')[0] || thankYou?.recipient?.username || 'Friend'}</div>
                                {thankYou?.item?.title && (
                                  <div className="text-[10px] opacity-90">🎁 {thankYou.item.title}</div>
                                )}
                              </div>
                            </div>
                            
                            {/* THANK YOU - lower so sun is visible */}
                            <div className="absolute bottom-[25%] left-1/2 -translate-x-1/2 z-10">
                              <div className="bg-white/20 backdrop-blur-sm rounded-2xl px-5 py-3 shadow-lg">
                                <div className="flex items-center justify-center gap-2 text-xl font-bold text-white drop-shadow-md whitespace-nowrap">
                                  <span>Thank</span>
                                  <span>You</span>
                                  <span aria-hidden>💝</span>
                                </div>
                              </div>
                            </div>
                            
                            {/* Fade filter */}
                            <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-white/20 z-[5]" />
                          </div>
                          
                          {/* Content section */}
                          <div className="p-4 flex flex-col gap-2">
                            {/* Message */}
                            <div className="text-sm text-gray-600 leading-relaxed">
                              {thankYou?.message || t('thank_you.card_fallback', 'Thank you!')}
                            </div>
                            
                            {thankYou?.photo_url && (
                              <div className="overflow-hidden rounded-lg">
                                <img src={thankYou.photo_url} alt="" className="w-full max-h-20 object-cover" />
                              </div>
                            )}
                            
                            <div className="w-full h-[2px] bg-gray-200 rounded-full" />
                            
                            <div className="flex justify-center gap-3 text-sm">
                              <span>🧡</span>
                              <span>💗</span>
                              <span>💛</span>
                            </div>
                          </div>
                        </div>
                      )}
                      {isImage && (
                        <div className="mb-1">
                          <img
                            src={m.attachment_url}
                            alt={t('chat.image_message', 'Image message')}
                            className="max-h-56 rounded-2xl object-cover"
                          />
                        </div>
                      )}
                      {isAudio && (
                        <div className="mb-1 flex flex-col gap-1">
                          <audio
                            ref={(el) => {
                              if (el) audioRefs.current[m.id] = el;
                            }}
                            src={m.attachment_url}
                            {...{ controlsList: 'nodownload' }}
                            className="hidden"
                            onTimeUpdate={(e) => handleAudioTimeUpdate(m.id, e.currentTarget)}
                            onEnded={() => handleAudioEnded(m.id)}
                          />
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => handleTogglePlay(m.id)}
                              className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium shadow-[0_6px_14px_rgba(200,80,192,0.35)] bg-gradient-to-r from-[hsl(var(--brand-cool-start))] via-[hsl(var(--brand-cool-end))] to-[hsl(var(--brand-warm-end))] text-white"
                            >
                              <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-white/20">
                                {playingId === m.id ? (
                                  <Pause className="h-3 w-3" />
                                ) : (
                                  <Play className="h-3 w-3" />
                                )}
                              </span>
                              <span className="truncate max-w-[80px] text-[11px]">
                                {m.attachment_duration_seconds
                                  ? t('chat.voice_note_with_duration', '{{seconds}}s voice note', { seconds: m.attachment_duration_seconds })
                                  : t('chat.voice_note', 'Voice note')}
                              </span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleToggleSpeed(m.id)}
                              className="text-[10px] px-2 py-1 rounded-full bg-white/70 text-[hsl(var(--brand-cool-start))] shadow-[0_2px_6px_rgba(0,0,0,0.12)]"
                            >
                              {(audioRate[m.id] || 1)}x
                            </button>
                          </div>
                          <div className="flex items-center gap-2 px-1">
                            <input
                              type="range"
                              min={0}
                              max={m.attachment_duration_seconds || 0}
                              step={0.1}
                              value={audioPosition[m.id] ?? 0}
                              onChange={(e) => handleSeek(m.id, Number(e.target.value))}
                              className="flex-1 h-1 rounded-full bg-white/40 accent-white"
                              aria-label={t('chat.audio_progress', 'Audio playback progress')}
                            />
                            <span className="text-[10px] text-white/90">
                              {formatSeconds(audioPosition[m.id])}
                            </span>
                          </div>
                        </div>
                      )}
                      {m.content && !isThankYouCard && (
                        <div>{m.content}</div>
                      )}

                      {/* Aggregated reactions under the bubble */}
                      {(() => {
                        const allForMessage = (messageReactions as any[]).filter(
                          (r: any) => r.message_id === m.id
                        );
                        if (allForMessage.length === 0) return null;

                        const byEmoji = new Map<string, { count: number; reactedByMe: boolean }>();
                        for (const r of allForMessage) {
                          const entry = byEmoji.get(r.emoji) || { count: 0, reactedByMe: false };
                          entry.count += 1;
                          if (r.user_id === uid) entry.reactedByMe = true;
                          byEmoji.set(r.emoji, entry);
                        }

                        return (
                          <div className={`mt-1 flex flex-wrap gap-1 ${me ? 'justify-end' : 'justify-start'}`}>
                            {Array.from(byEmoji.entries()).map(([emoji, info]) => (
                              <div
                                key={emoji}
                                className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] shadow-[0_2px_6px_rgba(15,23,42,0.12)] bg-white/90 ${
                                  info.reactedByMe
                                    ? 'ring-1 ring-[hsl(var(--brand-cool-start))] text-[hsl(var(--brand-cool-start))]'
                                    : 'text-foreground/80'
                                }`}
                              >
                                <span>{emoji}</span>
                                <span className="text-[9px] text-muted-foreground/80">{info.count}</span>
                              </div>
                            ))}
                          </div>
                        );
                      })()}

                      <div
                        className={`mt-1 text-[10px] text-right ${
                          me ? 'text-white/80' : 'text-muted-foreground'
                        }`}
                      >
                        {timeLabel}
                      </div>
                    </div>

                    {/* Pin + reaction controls */}
                    <button
                      type="button"
                      onClick={() => {
                        setLocalPinned((prev) => ({
                          ...prev,
                          [m.id]: !isPinned,
                        }));
                        pinMutation.mutate({ messageId: m.id, pinned: !isPinned });
                      }}
                      className={`absolute top-1 right-2 inline-flex items-center justify-center rounded-full border transition-all duration-150 cursor-pointer ${
                        isPinned
                          ? 'h-5 w-5 text-[10px] bg-gradient-to-br from-[hsl(var(--brand-cool-start))] via-[hsl(var(--brand-cool-end))] to-[hsl(var(--brand-warm-end))] border-transparent text-white shadow-[0_0_0_1px_rgba(255,255,255,0.9),0_6px_16px_rgba(200,80,192,0.65)] scale-105'
                          : 'h-4 w-4 text-[9px] bg-white/70 border-slate-200 text-slate-300 shadow-[0_1px_3px_rgba(15,23,42,0.16)] opacity-70 hover:opacity-100'
                      }`}
                      aria-label={isPinned ? t('chat.unpin_message', 'Unpin message') : t('chat.pin_message', 'Pin message')}
                    >
                      📌
                    </button>

                    {/* Reaction trigger button & picker */}
                    <button
                      type="button"
                      onClick={() =>
                        setActiveReactionFor((prev) => (prev === m.id ? null : m.id))
                      }
                      className={`absolute bottom-1 right-2 inline-flex h-4 w-4 items-center justify-center rounded-full bg-gradient-to-br from-[hsl(var(--brand-cool-start))] via-[hsl(var(--brand-cool-end))] to-[hsl(var(--brand-warm-end))] text-[9px] text-white shadow-[0_3px_8px_rgba(200,80,192,0.55)] ring-1 ring-white/70 opacity-70 group-hover:opacity-100 transition-opacity`}
                      aria-label={t('chat.add_reaction', 'Add reaction')}
                    >
                      +
                    </button>

                    {activeReactionFor === m.id && (
                      <div
                        className={`absolute -bottom-9 ${
                          me ? 'right-0' : 'left-0'
                        } inline-flex items-center gap-1 rounded-full bg-white/95/ backdrop-blur px-2.5 py-1 shadow-[0_10px_25px_rgba(15,23,42,0.15)] ring-1 ring-white/70 z-10`}
                      >
                        {allowedReactions.map((emoji) => (
                          <button
                            key={emoji}
                            type="button"
                            onClick={() => {
                              reactionMutation.mutate({ messageId: m.id, emoji });
                              setActiveReactionFor(null);
                            }}
                            className="h-7 w-7 flex items-center justify-center rounded-full bg-white/90 text-base shadow-[0_2px_5px_rgba(15,23,42,0.15)] hover:bg-[rgba(200,80,192,0.06)] hover:shadow-[0_4px_10px_rgba(200,80,192,0.35)] transition-all"
                          >
                            <span>{emoji}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
            {renderMessages.length === 0 && (
              <div className="text-sm text-muted-foreground text-center py-8">
                {t('chat.empty_thread', 'Say hi to start the conversation.')}
              </div>
            )}
          </div>

          {/* Composer — Explore-like framed input with Send button */}
          <div className="mx-auto w-full max-w-md shrink-0 mt-1">
            <div className="rounded-[14px] p-[2px] bg-gradient-to-r from-[hsl(var(--brand-cool-start))] via-[hsl(var(--brand-cool-end))] to-[hsl(var(--brand-warm-end))] shadow-[0_12px_28px_rgba(200,80,192,0.18)]">
              <div className="relative flex items-center gap-2 rounded-[12px] bg-white shadow-sm px-2 py-1">
                <textarea
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder={t('chat.type_message', 'Type a message')}
                  className="flex-1 rounded-[10px] border-0 px-3 py-2 text-sm focus:outline-none resize-none min-h-[40px] max-h-[64px] overflow-y-auto pr-10"
                  rows={1}
                  maxLength={200}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      send();
                    }
                  }}
                />
                <span className="pointer-events-none absolute bottom-1 right-3 text-[10px] text-muted-foreground/70">
                  {text.length}/200
                </span>
                {pendingImagePreview && (
                  <div className="mr-1 flex items-center gap-1">
                    <img
                      src={pendingImagePreview}
                      alt={t('chat.image_preview', 'Image preview')}
                      className="h-9 w-9 rounded-lg object-cover border border-[hsl(var(--brand-cool-start))]/30"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setPendingImage(null);
                        if (pendingImagePreview) {
                          URL.revokeObjectURL(pendingImagePreview);
                        }
                        setPendingImagePreview(null);
                      }}
                      className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-red-200 text-red-500 bg-white hover:bg-red-50 text-[11px]"
                      aria-label={t('chat.remove_image', 'Remove image')}
                    >
                      ×
                    </button>
                  </div>
                )}
                {pendingAudio && (
                  <div className="mr-1 flex items-center gap-1 rounded-full bg-[rgba(200,80,192,0.04)] px-2 py-1 border border-[hsl(var(--brand-cool-start))]/30">
                    <Mic className="h-3 w-3 text-[hsl(var(--brand-cool-start))]" />
                    <span className="text-[11px] text-muted-foreground">
                      {pendingAudioDuration ? `${pendingAudioDuration}s` : t('chat.voice_note_ready', 'Voice note ready')}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setPendingAudio(null);
                        setPendingAudioDuration(null);
                      }}
                      className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-red-200 text-red-500 bg-white hover:bg-red-50 text-[10px]"
                      aria-label={t('chat.remove_voice', 'Remove voice note')}
                    >
                      ×
                    </button>
                  </div>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  aria-label={t('chat.attach_image', 'Attach image')}
                  title={t('chat.attach_image', 'Attach image')}
                  className="hidden"
                  onChange={handleImageChange}
                />
                <button
                  type="button"
                  onClick={handlePickImage}
                  disabled={isUploading || !id || id === 'new'}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[hsl(var(--brand-cool-start))]/30 text-[hsl(var(--brand-cool-start))] bg-white/90 hover:bg-[rgba(200,80,192,0.06)] disabled:opacity-50"
                  aria-label={t('chat.attach_image', 'Attach image')}
                >
                  <Paperclip className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={toggleRecording}
                  disabled={isUploading || !id || id === 'new'}
                  className={`inline-flex h-9 w-9 items-center justify-center rounded-full border ${
                    isRecording
                      ? 'border-red-400 bg-red-50 text-red-500'
                      : 'border-[hsl(var(--brand-cool-start))]/30 text-[hsl(var(--brand-cool-start))] bg-white/90 hover:bg-[rgba(200,80,192,0.06)]'
                  } disabled:opacity-50`}
                  aria-label={isRecording ? t('chat.stop_recording', 'Stop recording') : t('chat.start_recording', 'Start recording')}
                >
                  <Mic className="h-4 w-4" />
                </button>
                {isRecording && (
                  <span className="text-[11px] text-red-500 font-medium mr-1">
                    {Math.max(0, 60 - recordingSeconds)}s
                  </span>
                )}
                <button
                  type="button"
                  onClick={send}
                  disabled={(!text.trim() && !pendingImage && !pendingAudio) || sendMutation.isPending || isUploading}
                  className="inline-flex h-9 px-3 items-center justify-center gap-1 rounded-xl text-white bg-gradient-to-br from-[hsl(var(--brand-cool-start))] via-[hsl(var(--brand-cool-end))] to-[hsl(var(--brand-warm-end))] shadow-[0_8px_18px_rgba(200,80,192,0.28)] disabled:opacity-60"
                >
                  <Send className="h-4 w-4" />
                  <span>{t('chat.send', 'Send')}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
      )}
      </div>
    </>
  );
}

export default Chat;


