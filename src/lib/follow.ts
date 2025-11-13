import { supabase } from "@/integrations/supabase/client";

export type FollowStatus = "pending" | "accepted";

export async function requestFollow(targetUserId: string) {
  const { data: auth } = await supabase.auth.getUser();
  const userId = auth.user?.id;
  if (!userId) throw new Error("Not authenticated");
  if (userId === targetUserId) throw new Error("Cannot follow yourself");

  // Try insert as 'accepted' when target allows open follows; otherwise policy forces 'pending'
  const { error } = await supabase.from("followers").insert({
    user_id: userId,
    following_id: targetUserId,
    status: "accepted",
  } as any);
  if (error) throw error;
}

export async function cancelFollow(targetUserId: string) {
  const { data: auth } = await supabase.auth.getUser();
  const userId = auth.user?.id;
  if (!userId) throw new Error("Not authenticated");

  const { error } = await supabase
    .from("followers")
    .delete()
    .eq("user_id", userId)
    .eq("following_id", targetUserId);
  if (error) throw error;
}

export async function acceptFollowRequest(fromUserId: string) {
  const { data: auth } = await supabase.auth.getUser();
  const me = auth.user?.id;
  if (!me) throw new Error("Not authenticated");

  const { error } = await supabase
    .from("followers")
    .update({ status: "accepted" } as any)
    .eq("user_id", fromUserId)
    .eq("following_id", me)
    .eq("status", "pending");
  if (error) throw error;
}

export async function declineFollowRequest(fromUserId: string) {
  const { data: auth } = await supabase.auth.getUser();
  const me = auth.user?.id;
  if (!me) throw new Error("Not authenticated");

  const { error } = await supabase
    .from("followers")
    .delete()
    .eq("user_id", fromUserId)
    .eq("following_id", me)
    .eq("status", "pending");
  if (error) throw error;
}
