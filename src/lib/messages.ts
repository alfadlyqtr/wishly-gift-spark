import { supabase } from "@/lib/supabase";

/**
 * Finds an existing 1:1 thread between the current user and `otherUserId`.
 * If none exists, creates a new thread and adds both participants.
 * Returns the thread id.
 */
export async function openOrCreateDirectThread(otherUserId: string): Promise<string | null> {
  if (!supabase) return null;

  const { data: auth } = await supabase.auth.getUser();
  const myUserId = auth.user?.id;
  if (!myUserId) return null;
  if (otherUserId === myUserId) return null;

  // 1) Try to find an existing thread where both users participate and exactly 2 participants (1:1)
  const { data: candidateThreads, error: threadsErr } = await supabase
    .from("threads")
    .select(
      "id, thread_participants(id, user_id)"
    )
    .in("id", (
      await supabase
        .from("thread_participants")
        .select("thread_id")
        .eq("user_id", myUserId)
    ).data?.map((r: any) => r.thread_id) || []);

  if (threadsErr) {
    console.error(threadsErr);
  }

  const existing = (candidateThreads || []).find((t: any) => {
    const uids = (t.thread_participants || []).map((p: any) => p.user_id);
    const hasBoth = uids.includes(myUserId) && uids.includes(otherUserId);
    const isDirect = new Set(uids).size === 2; // exactly two distinct users
    return hasBoth && isDirect;
  });

  if (existing) return existing.id as string;

  // 2) Create new thread
  const { data: newThread, error: newErr } = await supabase
    .from("threads")
    .insert({ title: null })
    .select("id")
    .single();
  if (newErr || !newThread) {
    console.error(newErr);
    return null;
  }

  const threadId = newThread.id as string;

  // 3) Add participants (current user and other)
  const { error: partErr } = await supabase.from("thread_participants").insert([
    { thread_id: threadId, user_id: myUserId },
    { thread_id: threadId, user_id: otherUserId },
  ]);
  if (partErr) {
    console.error(partErr);
    return null;
  }

  return threadId;
}
