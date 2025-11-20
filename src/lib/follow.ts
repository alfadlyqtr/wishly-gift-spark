import { supabase } from "@/integrations/supabase/client";

export type FollowStatus = "pending" | "accepted";

export async function requestFollow(targetUserId: string) {
  const { data: auth } = await supabase.auth.getUser();
  const userId = auth.user?.id;
  if (!userId) throw new Error("Not authenticated");
  if (userId === targetUserId) throw new Error("Cannot follow yourself");

  // Look up whether target requires approval
  const { data: profileRow, error: profileError } = await supabase
    .from("user_profiles")
    .select("require_follow_approval")
    .eq("id", targetUserId)
    .maybeSingle();

  if (profileError) throw profileError;

  const requireApproval = Boolean((profileRow as any)?.require_follow_approval);
  const status: FollowStatus = requireApproval ? "pending" : "accepted";

  const { error } = await supabase.from("followers").insert({
    user_id: userId,
    following_id: targetUserId,
    status,
  } as any);
  if (error) throw error;

  // Notify the target user that someone wants to follow them (or now follows them)
  await supabase.from("activities").insert({
    user_id: targetUserId,
    activity_type: status === "pending" ? "new_follower" : "new_follower",
    target_id: userId,
  } as any);
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

  // Activity for the requester: their follow request was accepted
  await supabase.from("activities").insert({
    user_id: fromUserId,
    activity_type: "follow_accepted",
    target_id: me,
  } as any);

  // Activity for the target: they have a new follower
  await supabase.from("activities").insert({
    user_id: me,
    activity_type: "new_follower",
    target_id: fromUserId,
  } as any);
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
