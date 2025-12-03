import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { MessageCircle, Send } from "lucide-react";

interface ProductQuestionsProps {
  productId: string;
  brandUserId?: string;
  brandName?: string;
  brandLogo?: string;
  compact?: boolean;
}

interface Question {
  id: string;
  product_id: string;
  user_id: string;
  question: string;
  answer: string | null;
  answered_at: string | null;
  status: "unanswered" | "answered";
  created_at: string;
  user_profiles?: {
    username: string | null;
    full_name: string | null;
    avatar_url: string | null;
  };
}

// Helper to format time ago like Instagram
function timeAgo(dateString: string): string {
  const now = new Date();
  const date = new Date(dateString);
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);
  
  if (seconds < 60) return "now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d`;
  return `${Math.floor(seconds / 604800)}w`;
}

export const ProductQuestions: React.FC<ProductQuestionsProps> = ({
  productId,
  brandUserId,
  brandName = "Brand",
  brandLogo,
  compact = false,
}) => {
  const queryClient = useQueryClient();
  const [newQuestion, setNewQuestion] = useState("");
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [currentUserProfile, setCurrentUserProfile] = useState<{
    username: string | null;
    full_name: string | null;
    avatar_url: string | null;
  } | null>(null);
  const [localQuestions, setLocalQuestions] = useState<Question[]>([]);

  React.useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      const uid = data.user?.id ?? null;
      setCurrentUserId(uid);
      if (uid) {
        const { data: profile } = await (supabase as any)
          .from("user_profiles")
          .select("username, full_name, avatar_url")
          .eq("id", uid)
          .maybeSingle();
        if (profile) {
          setCurrentUserProfile({
            username: profile.username ?? null,
            full_name: profile.full_name ?? null,
            avatar_url: profile.avatar_url ?? null,
          });
        }
      }
    })();
  }, []);

  const isBrandOwner = brandUserId && currentUserId === brandUserId;

  const { data: questions, isLoading, refetch } = useQuery({
    queryKey: ["product-questions", productId],
    queryFn: async () => {
      console.log("🔍 Fetching questions for product:", productId);
      
      // First get the questions
      const { data: rawQuestions, error: qError } = await (supabase as any)
        .from("product_questions")
        .select("*")
        .eq("product_id", productId)
        .order("created_at", { ascending: true });

      if (qError) {
        console.error("❌ Error fetching questions:", qError);
        throw qError;
      }
      
      console.log("📦 Raw questions:", rawQuestions);
      
      if (!rawQuestions || rawQuestions.length === 0) {
        return [] as Question[];
      }
      
      // Get user profiles for each question
      const userIds = [...new Set(rawQuestions.map((q: any) => q.user_id))];
      const { data: profiles } = await (supabase as any)
        .from("user_profiles")
        .select("id, username, full_name, avatar_url")
        .in("id", userIds);
      
      const profileMap = new Map((profiles || []).map((p: any) => [p.id, p]));
      
      const enriched = rawQuestions.map((q: any) => ({
        ...q,
        user_profiles: profileMap.get(q.user_id) || undefined,
      }));
      
      console.log("✅ Enriched questions:", enriched);
      return enriched as Question[];
    },
    enabled: !!productId,
    refetchInterval: 5000,
  });

  // Sync fetched questions into local state for optimistic updates
  React.useEffect(() => {
    if (questions) {
      setLocalQuestions(questions);
    }
  }, [questions]);

  const askMutation = useMutation({
    mutationFn: async (question: string) => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) throw new Error("Please sign in to ask a question");

      const { error } = await (supabase as any)
        .from("product_questions")
        .insert({
          product_id: productId,
          user_id: auth.user.id,
          question,
        });

      if (error) throw error;
    },
    onSuccess: () => {
      const text = newQuestion.trim();
      if (!text) return;
      setNewQuestion("");
      // Optimistically add the new question so it shows instantly
      setLocalQuestions((prev) => [
        ...prev,
        {
          id: `local-${Date.now()}`,
          product_id: productId,
          user_id: currentUserId || "",
          question: text,
          answer: null,
          answered_at: null,
          status: "unanswered",
          created_at: new Date().toISOString(),
          user_profiles: currentUserProfile || undefined,
        },
      ]);
      refetch();
      toast.success("Question posted!");
    },
    onError: (e: any) => {
      toast.error(e?.message || "Failed to post question");
    },
  });

  const answerMutation = useMutation({
    mutationFn: async ({ questionId, answer }: { questionId: string; answer: string }) => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) throw new Error("Not authenticated");

      const { error } = await (supabase as any)
        .from("product_questions")
        .update({
          answer,
          answered_at: new Date().toISOString(),
          answered_by: auth.user.id,
          status: "answered",
        })
        .eq("id", questionId);

      if (error) throw error;
    },
    onSuccess: () => {
      setReplyingTo(null);
      setReplyText("");
      refetch();
      toast.success("Answer posted!");
    },
    onError: (e: any) => {
      toast.error(e?.message || "Failed to post answer");
    },
  });

  const handleAsk = () => {
    if (!newQuestion.trim()) return;
    askMutation.mutate(newQuestion.trim());
  };

  const handleAnswer = (questionId: string) => {
    if (!replyText.trim()) return;
    answerMutation.mutate({ questionId, answer: replyText.trim() });
  };

  if (compact) {
    const count = localQuestions.length;
    return (
      <button className="text-[11px] text-muted-foreground hover:text-foreground transition-colors">
        {count > 0 ? `View all ${count} comments` : "Add a comment..."}
      </button>
    );
  }

  return (
    <div className="mt-2">
      <div className="rounded-xl border border-slate-200/70 bg-white/60 backdrop-blur-sm overflow-hidden">
        {/* Comments list - Instagram style */}
        <div className="max-h-[180px] overflow-y-auto px-3 py-2 space-y-2">
        {isLoading ? (
          <p className="text-xs text-muted-foreground px-2">Loading...</p>
        ) : localQuestions.length === 0 ? (
          <p className="text-xs text-muted-foreground px-2">No comments yet</p>
        ) : (
          localQuestions.map((q) => (
            <div key={q.id} className="space-y-1.5">
              {/* Question - Instagram comment style */}
              <div className="flex items-start gap-2 px-2">
                <div className="w-7 h-7 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex-shrink-0 overflow-hidden">
                  {q.user_profiles?.avatar_url ? (
                    <img
                      src={q.user_profiles.avatar_url}
                      alt=""
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span className="w-full h-full flex items-center justify-center text-white text-xs font-semibold">
                      {(q.user_profiles?.full_name || q.user_profiles?.username || "U").charAt(0).toUpperCase()}
                    </span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] leading-snug">
                    <span className="font-semibold">
                      {q.user_profiles?.username || q.user_profiles?.full_name || "user"}
                    </span>{" "}
                    <span className="text-slate-700">{q.question}</span>
                  </p>
                  <div className="flex items-center gap-3 mt-0.5">
                    <span className="text-[11px] text-muted-foreground">{timeAgo(q.created_at)}</span>
                    {isBrandOwner && q.status === "unanswered" && (
                      <button
                        className="text-[11px] font-semibold text-muted-foreground hover:text-foreground"
                        onClick={() => setReplyingTo(replyingTo === q.id ? null : q.id)}
                      >
                        Reply
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Brand reply - indented */}
              {q.answer && (
                <div className="flex items-start gap-2 px-2 ml-6">
                  <div className="w-6 h-6 rounded-full bg-gradient-to-br from-[hsl(var(--brand-cool-start))] to-[hsl(var(--brand-warm-end))] flex-shrink-0 overflow-hidden ring-2 ring-white">
                    {brandLogo ? (
                      <img src={brandLogo} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <span className="w-full h-full flex items-center justify-center text-white text-[10px] font-bold">
                        {brandName.charAt(0).toUpperCase()}
                      </span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] leading-snug">
                      <span className="font-semibold text-[hsl(var(--brand-cool-start))]">{brandName}</span>{" "}
                      <span className="text-slate-700">{q.answer}</span>
                    </p>
                    <span className="text-[11px] text-muted-foreground">{q.answered_at ? timeAgo(q.answered_at) : ""}</span>
                  </div>
                </div>
              )}

              {/* Reply input for brand owner */}
              {isBrandOwner && replyingTo === q.id && (
                <div className="flex items-center gap-2 px-2 ml-6 mt-1">
                  <input
                    type="text"
                    placeholder="Add a reply..."
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        handleAnswer(q.id);
                      }
                    }}
                    className="flex-1 text-[13px] bg-transparent border-none outline-none placeholder:text-muted-foreground"
                    autoFocus
                  />
                  <button
                    onClick={() => handleAnswer(q.id)}
                    disabled={!replyText.trim() || answerMutation.isPending}
                    className="text-[13px] font-semibold text-[hsl(var(--brand-cool-start))] disabled:opacity-50"
                  >
                    {answerMutation.isPending ? "..." : "Post"}
                  </button>
                </div>
              )}
            </div>
          ))
        )}
        </div>

        {/* Add comment input - Instagram style */}
        {!isBrandOwner && currentUserId && (
          <div className="flex items-center gap-2 px-3 py-2 border-t border-slate-200/80 bg-white/70">
          <MessageCircle className="w-5 h-5 text-muted-foreground" />
          <input
            type="text"
            placeholder="Ask a question..."
            value={newQuestion}
            onChange={(e) => setNewQuestion(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleAsk();
              }
            }}
            className="flex-1 text-[13px] bg-transparent border-none outline-none placeholder:text-muted-foreground"
          />
          <button
            onClick={handleAsk}
            disabled={!newQuestion.trim() || askMutation.isPending}
            className="px-4 py-1.5 rounded-full bg-gradient-to-r from-[hsl(var(--brand-cool-start))] to-[hsl(var(--brand-warm-end))] text-[13px] font-semibold text-white shadow-[0_8px_18px_rgba(15,23,42,0.25)] hover:shadow-[0_10px_22px_rgba(15,23,42,0.30)] active:scale-[0.97] transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none"
          >
            {askMutation.isPending ? "..." : "Post"}
          </button>
        </div>
        )}
      </div>
    </div>
  );
};

export default ProductQuestions;
