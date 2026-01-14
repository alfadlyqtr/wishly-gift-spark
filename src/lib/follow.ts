import { supabase } from "@/integrations/supabase/client";

async function dispatchPush(body: Record<string, unknown>) {
  try {
    await supabase.functions.invoke("push-dispatch", { body });
  } catch {
  }
}

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

  await supabase.from("activities").insert({
    user_id: targetUserId,
    activity_type: status === "pending" ? "new_follower" : "new_follower",
    target_id: userId,
  } as any);

  void dispatchPush({ type: "follow_request", targetUserId });
}

export async function removeFollower(followerUserId: string) {
  const { data: auth } = await supabase.auth.getUser();
  const me = auth.user?.id;
  if (!me) throw new Error("Not authenticated");

  const { error } = await supabase
    .from("followers")
    .delete()
    .eq("user_id", followerUserId)
    .eq("following_id", me);
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

  await supabase.from("activities").insert({
    user_id: fromUserId,
    activity_type: "follow_accepted",
    target_id: me,
  } as any);

  await supabase.from("activities").insert({
    user_id: me,
    activity_type: "new_follower",
    target_id: fromUserId,
  } as any);

  void dispatchPush({ type: "follow_accepted", fromUserId });
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

// Brand follow functions
export async function brandFollowUser(targetUserId: string) {
  const { data: auth } = await supabase.auth.getUser();
  const userId = auth.user?.id;
  if (!userId) throw new Error("Not authenticated");

  // Get brand ID
  const { data: brandData } = await (supabase as any)
    .from("brands")
    .select("id")
    .eq("user_id", userId)
    .maybeSingle();

  if (!brandData) throw new Error("Brand not found");

  const { error } = await (supabase as any)
    .from("brand_following")
    .insert({
      brand_id: brandData.id,
      following_id: targetUserId,
      following_type: "user",
      status: "accepted",
    });

  if (error) throw error;
}

export async function brandUnfollowUser(targetUserId: string) {
  const { data: auth } = await supabase.auth.getUser();
  const userId = auth.user?.id;
  if (!userId) throw new Error("Not authenticated");

  // Get brand ID
  const { data: brandData } = await (supabase as any)
    .from("brands")
    .select("id")
    .eq("user_id", userId)
    .maybeSingle();

  if (!brandData) throw new Error("Brand not found");

  const { error } = await (supabase as any)
    .from("brand_following")
    .delete()
    .eq("brand_id", brandData.id)
    .eq("following_id", targetUserId);

  if (error) throw error;
}
