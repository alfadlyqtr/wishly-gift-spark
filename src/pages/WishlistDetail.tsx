import { useParams, useNavigate, Link } from "react-router-dom";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import BackButton from "@/components/BackButton";
import WishAddDialog from "@/components/wishes/WishAddDialog";
import { useWishlists } from "@/hooks/use-wishlists";
import { toast } from "sonner";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { Database } from "@/integrations/supabase/types";

type Wishlist = Database["public"]["Tables"]["wishlists"]["Row"];
type WishlistItem = Database["public"]["Tables"]["wishlist_items"]["Row"];

const WishlistDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<WishlistItem | null>(null);
  const { data: wishlistsData } = useWishlists();

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["wishlist-detail", id],
    queryFn: async (): Promise<{ wishlist: Wishlist | null; items: WishlistItem[] }> => {
      if (!id) return { wishlist: null, items: [] };

      const [{ data: wl, error: wlErr }, { data: items, error: itemsErr }] = await Promise.all([
        supabase.from("wishlists").select("*").eq("id", id).maybeSingle(),
        supabase.from("wishlist_items").select("*").eq("wishlist_id", id).order("added_at", { ascending: false }),
      ]);

      if (wlErr) throw wlErr;
      if (itemsErr) throw itemsErr;

      return { wishlist: wl as Wishlist, items: (items as WishlistItem[]) ?? [] };
    },
  });

  const items = useMemo(() => data?.items ?? [], [data]);
  const wishlistsOptions = useMemo(
    () => (wishlistsData ?? []).map(w => ({ id: w.id, name: w.title || w.id })),
    [wishlistsData]
  );

  const desireEmoji = (d?: number | null) => {
    const arr = ["😐","😌","🙂","😊","😍"] as const;
    const idx = typeof d === "number" ? Math.max(0, Math.min(4, d)) : 3; // default to middle if missing
    return arr[idx];
  };

  const eventDateText = (() => {
    const d = data?.wishlist?.event_date ? new Date(data.wishlist.event_date) : null;
    if (!d || isNaN(d.getTime())) return null;
    const weekday = d.toLocaleDateString('en-GB', { weekday: 'long' });
    const day = d.getDate();
    const month = d.toLocaleDateString('en-GB', { month: 'long' });
    return `${weekday}, ${day} ${month} ${d.getFullYear()}`;
  })();

  if (isLoading) {
    return (
      <div className="container max-w-2xl mx-auto px-4 py-6">
        <p className="text-sm text-muted-foreground">Loading...</p>
      </div>
    );
  }

  return (
    <div className="container max-w-2xl mx-auto px-4 py-6 space-y-4">
      <div className="flex items-center gap-2">
        <BackButton onClick={() => navigate(-1)}>{t("wishlist_detail_back", "Back")}</BackButton>
      </div>

      {/* Detail inside the same gradient card style as the stack */}
      <div className="mx-auto mt-12" style={{ width: 420 }}>
        <div className="wl-card" style={{ width: 420 }}>
          <div className="wl-card-surface p-5 text-white" style={{ alignItems: 'flex-start', justifyContent: 'flex-start' }}>
            <div className="w-full">
              <h2 className="text-2xl font-extrabold wl-card-title" style={{ textAlign: 'left' }}>{data?.wishlist?.title || "Wishlist"}</h2>
              <p className="mt-0.5 text-xs opacity-90 drop-shadow-[0_2px_8px_rgba(0,0,0,0.6)]">This wishlist contains ({items.length}/10)</p>
              {data?.wishlist?.description && (
                <p className="mt-1 text-sm opacity-90 drop-shadow-[0_2px_8px_rgba(0,0,0,0.6)]">{data.wishlist.description}</p>
              )}
              {eventDateText && (
                <p className="mt-1 text-xs opacity-90 drop-shadow-[0_2px_8px_rgba(0,0,0,0.6)]">{eventDateText}</p>
              )}

              <div className="mt-3 bg-white/5 rounded-md p-3 w-full" style={{ maxHeight: 5 * 76, overflowY: 'auto' }}>
                <h3 className="text-base font-semibold drop-shadow-[0_2px_6px_rgba(0,0,0,0.5)]">Items</h3>
                {items.length > 0 ? (
                  <div className="mt-2 divide-y divide-white/10">
                    {items.map((it) => (
                      <div key={it.id} className="py-3">
                        <div className="flex items-start gap-3">
                          {it.image_url ? (
                            <img
                              src={it.image_url}
                              alt={it.title}
                              className="h-16 w-16 flex-none rounded-md object-cover ring-1 ring-white/30 shadow-sm"
                              loading="lazy"
                            />
                          ) : null}
                          <div className="flex min-w-0 flex-1 flex-col">
                            <div className="flex items-center gap-2">
                              <span className="text-lg leading-none">{desireEmoji((it as any).desire)}</span>
                              <span className="font-medium truncate">{it.title}</span>
                            </div>
                            {(it as any)?.brand ? (
                              <span className="text-xs opacity-90">{(it as any).brand}</span>
                            ) : null}
                            {it.description && (
                              <span className="text-xs opacity-90 line-clamp-2">{it.description}</span>
                            )}
                            {it.item_url && (
                              <a href={it.item_url} target="_blank" className="text-[11px] underline" rel="noreferrer">
                                {it.item_url}
                              </a>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              className="text-white/90 hover:text-white transition"
                              onClick={() => {
                                setEditingItem(it);
                                setEditOpen(true);
                              }}
                              aria-label="Edit"
                            >
                              <Pencil className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              className="text-white/90 hover:text-white transition"
                              onClick={async () => {
                                const ok = window.confirm("Delete this item?");
                                if (!ok) return;
                                const { error } = await supabase.from("wishlist_items").delete().eq("id", it.id);
                                if (error) {
                                  toast.error(error.message || "Failed to delete");
                                } else {
                                  toast.success("Deleted");
                                  await refetch();
                                }
                              }}
                              aria-label="Delete"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm opacity-80 mt-1">No items yet.</p>
                )}
              </div>
            </div>
            {/* Floating circular + button inside card (bottom-right) */}
            <div className="absolute bottom-4 right-4">
              <button
                type="button"
                onClick={() => setOpen(true)}
                className="w-12 h-12 rounded-full bg-black text-white flex items-center justify-center shadow-[0_16px_34px_rgba(0,0,0,0.5)] ring-2 ring-white/30"
                aria-label="Add"
              >
                <Plus className="h-6 w-6" />
              </button>
            </div>
            <WishAddDialog
              open={open}
              onOpenChange={setOpen}
              wishlists={wishlistsOptions}
              fixedWishlistId={data?.wishlist?.id || id || ""}
              onSubmit={async ({ wishlistId, title, brand, description, desire, imageFile }) => {
                try {
                  const { data: { user } } = await supabase.auth.getUser();
                  if (!user) {
                    toast.error("You must be signed in");
                    return;
                  }

                  let publicImageUrl: string | null = null;
                  if (imageFile) {
                    const bucket = "wishlist_images";
                    const filePath = `wishlist-items/${user.id}/${Date.now()}_${imageFile.name}`;
                    const { error: uploadError } = await supabase.storage
                      .from(bucket)
                      .upload(filePath, imageFile, { upsert: false, contentType: imageFile.type });
                    if (uploadError) throw uploadError;
                    const { data: pub } = supabase.storage.from(bucket).getPublicUrl(filePath);
                    publicImageUrl = pub.publicUrl;
                  }

                  const payload: any = {
                    title,
                    brand: brand || null,
                    description: description || (brand ? `Brand: ${brand}` : null),
                    image_url: publicImageUrl,
                    item_url: null,
                    price: null,
                    status: null,
                    wishlist_id: wishlistId,
                    added_at: new Date().toISOString(),
                    desire,
                  };
                  const { error } = await supabase.from("wishlist_items").insert([payload]);
                  if (error) throw error;
                  toast.success("Wish saved");
                  await refetch();
                } catch (e: any) {
                  toast.error(e?.message || "Failed to save wish");
                }
              }}
            />

            <WishAddDialog
              open={editOpen}
              onOpenChange={(o) => {
                setEditOpen(o);
                if (!o) setEditingItem(null);
              }}
              wishlists={wishlistsOptions}
              initialWishlistId={editingItem?.wishlist_id || undefined}
              onSubmit={async ({ itemId, wishlistId, title, brand, description, desire, imageFile }) => {
                try {
                  if (!itemId) return;
                  const { data: { user } } = await supabase.auth.getUser();
                  if (!user) {
                    toast.error("You must be signed in");
                    return;
                  }

                  let publicImageUrl: string | undefined;
                  if (imageFile) {
                    const bucket = "wishlist_images";
                    const filePath = `wishlist-items/${user.id}/${Date.now()}_${imageFile.name}`;
                    const { error: uploadError } = await supabase.storage
                      .from(bucket)
                      .upload(filePath, imageFile, { upsert: false, contentType: imageFile.type });
                    if (uploadError) throw uploadError;
                    const { data: pub } = supabase.storage.from(bucket).getPublicUrl(filePath);
                    publicImageUrl = pub.publicUrl;
                  }

                  const updates: any = {
                    title,
                    brand: brand || null,
                    description: description || (brand ? `Brand: ${brand}` : null),
                    wishlist_id: wishlistId,
                    desire,
                  };
                  if (typeof publicImageUrl === "string") updates.image_url = publicImageUrl;

                  const { error } = await supabase.from("wishlist_items").update(updates).eq("id", itemId);
                  if (error) throw error;
                  toast.success("Wish updated");
                  await refetch();
                } catch (e: any) {
                  toast.error(e?.message || "Failed to update wish");
                }
              }}
              itemId={editingItem?.id || undefined}
              initialTitle={editingItem?.title || ""}
              initialBrand={(editingItem as any)?.brand || ""}
              initialDescription={editingItem?.description || ""}
              initialDesire={(editingItem as any)?.desire ?? 3}
              initialImageUrl={editingItem?.image_url || null}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default WishlistDetail;
