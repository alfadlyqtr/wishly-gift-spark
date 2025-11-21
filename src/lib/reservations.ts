import { supabase } from "@/integrations/supabase/client";

export type ReservationStatus = "pending" | "approved" | "declined" | "unclaim_requested";

type ReservationRow = {
  id: string;
  status: ReservationStatus;
  item_id: string;
  reserved_by_id: string;
};

type OwnerProfile = {
  auto_approve_claims?: boolean;
  auto_approve_unclaims?: boolean;
};

async function ensureAuthenticated() {
  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;
  const userId = data.user?.id;
  if (!userId) {
    throw new Error("Not authenticated");
  }
  return userId;
}

async function updateReservation(
  reservationId: string,
  updates: Partial<{ status: ReservationStatus; approved_at: string | null }>,
  allowedStatuses: ReservationStatus[]
): Promise<ReservationRow> {
  await ensureAuthenticated();

  let query = supabase
    .from("wishlist_reservations")
    .update(updates as any)
    .eq("id", reservationId);

  if (allowedStatuses.length) {
    query = query.in("status", allowedStatuses);
  }

  const { data, error } = await (query as any)
    .select("id,status,item_id,reserved_by_id")
    .limit(1);

  if (error) throw error;
  const row = data?.[0];
  if (!row) {
    throw new Error("Reservation not found or already processed");
  }

  return row as ReservationRow;
}

async function emitClaimerActivity(
  reservation: ReservationRow,
  activityType: "wish_claim_approved" | "wish_claim_declined"
) {
  if (!reservation.reserved_by_id) return;

  await supabase.from("activities").insert({
    user_id: reservation.reserved_by_id,
    activity_type: activityType,
    target_id: reservation.item_id,
  } as any);
}

export async function approveReservation(reservationId: string) {
  const reservation = await updateReservation(
    reservationId,
    {
      status: "approved",
      approved_at: new Date().toISOString(),
    },
    ["pending"]
  );

  await emitClaimerActivity(reservation, "wish_claim_approved");
  return reservation;
}

export async function declineReservation(reservationId: string) {
  const reservation = await updateReservation(
    reservationId,
    {
      status: "declined",
      approved_at: null,
    },
    ["pending"]
  );

  await emitClaimerActivity(reservation, "wish_claim_declined");
  return reservation;
}

async function getOwnerProfile(itemId: string): Promise<OwnerProfile | null> {
  try {
    // First get the wishlist owner ID
    const { data: itemData, error: itemError } = await supabase
      .from('wishlist_items')
      .select('wishlist_id, wishlists!inner(user_id)')
      .eq('id', itemId)
      .maybeSingle();
    
    if (itemError || !itemData) {
      console.error('Failed to get item data:', itemError);
      return null;
    }
    
    const ownerId = (itemData as any)?.wishlists?.user_id;
    if (!ownerId) {
      console.error('No owner ID found');
      return null;
    }
    
    // Then get the owner's profile settings
    const { data: profileData, error: profileError } = await supabase
      .from('user_profiles')
      .select('auto_approve_claims, auto_approve_unclaims')
      .eq('id', ownerId)
      .maybeSingle();
    
    if (profileError) {
      console.error('Failed to get profile data:', profileError);
      return null;
    }
    
    return profileData as OwnerProfile;
  } catch (err) {
    console.error('Error in getOwnerProfile:', err);
    return null;
  }
}

export async function requestUnclaim(reservationId: string) {
  const userId = await ensureAuthenticated();
  
  // Get reservation details
  const { data: reservation, error: fetchError } = await (supabase as any)
    .from('wishlist_reservations')
    .select('id, status, item_id, reserved_by_id')
    .eq('id', reservationId)
    .eq('reserved_by_id', userId)
    .eq('status', 'approved')
    .maybeSingle();
  
  if (fetchError) throw fetchError;
  if (!reservation) throw new Error('Reservation not found or not approved');
  
  // Check if owner has auto-approve enabled
  const ownerProfile = await getOwnerProfile(reservation.item_id);
  
  if (ownerProfile?.auto_approve_unclaims) {
    // Auto-delete the reservation
    const { error: deleteError } = await supabase
      .from('wishlist_reservations')
      .delete()
      .eq('id', reservationId);
    
    if (deleteError) throw deleteError;
    return { autoApproved: true };
  }
  
  // Request unclaim approval
  const { error: updateError } = await (supabase as any)
    .from('wishlist_reservations')
    .update({
      status: 'unclaim_requested',
      unclaim_requested_at: new Date().toISOString()
    })
    .eq('id', reservationId);
  
  if (updateError) throw updateError;
  
  // Emit activity for owner
  const { data: wishlistData } = await (supabase as any)
    .from('wishlist_items')
    .select('wishlists!inner(user_id)')
    .eq('id', reservation.item_id)
    .maybeSingle();
  
  if (wishlistData?.wishlists?.user_id) {
    await supabase.from('activities').insert({
      user_id: wishlistData.wishlists.user_id,
      activity_type: 'wish_unclaim_requested',
      target_id: userId,
    } as any);
  }
  
  return { autoApproved: false };
}

export async function approveUnclaim(reservationId: string) {
  await ensureAuthenticated();
  
  // Delete the reservation
  const { error } = await supabase
    .from('wishlist_reservations')
    .delete()
    .eq('id', reservationId)
    .eq('status', 'unclaim_requested');
  
  if (error) throw error;
  return { approved: true };
}

export async function declineUnclaim(reservationId: string) {
  const reservation = await updateReservation(
    reservationId,
    {
      status: "approved",
      approved_at: new Date().toISOString(),
    },
    ["unclaim_requested"]
  );
  
  return reservation;
}
