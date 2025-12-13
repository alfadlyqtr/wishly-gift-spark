import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

/**
 * CreateWishlistModal
 * - Minimal, mobile-first Dialog with a simple vertical form
 * - Fields: Title (required), Description (optional)
 * - Inserts into `wishlists` with privacy_level = 'private'
 * - On success: toast + navigate to /wishlist/:id
 * - Usage: Wrap a trigger element with <CreateWishlistModal>...</CreateWishlistModal>
 */
export type CreateWishlistModalProps = React.PropsWithChildren<{
  defaultPrivacy?: "private" | "public" | "friends";
}>;

const CreateWishlistModal: React.FC<CreateWishlistModalProps> = ({ children, defaultPrivacy = "private" }) => {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [eventDate, setEventDate] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { t } = useTranslation();

  const handleCreate = async () => {
    if (!title.trim()) {
      toast.error(t("wishlist_detail.title_required", "Title is required"));
      return;
    }

    try {
      setSaving(true);
      const { data: auth } = await supabase.auth.getUser();
      const user = auth.user;
      if (!user) {
        toast.error(t("common.not_authenticated", "Not authenticated"));
        return;
      }

      const { data, error } = await supabase
        .from("wishlists")
        .insert([
          {
            title: title.trim(),
            description: description.trim() || null,
            privacy_level: defaultPrivacy,
            user_id: user.id,
            event_date: eventDate || null,
          },
        ])
        .select("id")
        .single();

      if (error) {
        toast.error(error.message || t("errors.failed_create_wishlist", "Failed to create wishlist"));
        return;
      }

      toast.success(t("success.saved", "Saved"));
      await queryClient.invalidateQueries({ queryKey: ["wishlists"] });
      await queryClient.invalidateQueries({
        predicate: (q) => Array.isArray(q.queryKey) && q.queryKey[0] === 'events'
      });
      setOpen(false);
      setTitle("");
      setDescription("");
      setEventDate("");

      if (data?.id) {
        navigate(`/wishlist/${data.id}`);
      }
    } catch (e: any) {
      toast.error(e?.message || "Something went wrong");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      {/* Wrap children to avoid ref warnings */}
      <span role="button" onClick={() => setOpen(true)} style={{ display: 'inline-flex' }}>
        {children}
      </span>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('wishlist.create_title', 'Create Wishlist')}</DialogTitle>
            <DialogDescription>{t('wishlist.create_hint', 'Start with a title and optional details. You can customize more later.')}</DialogDescription>
          </DialogHeader>

          <div className="mx-auto w-full max-w-2xl rounded-2xl p-[2px] bg-gradient-to-r from-[hsl(var(--brand-cool-start))] via-[hsl(var(--brand-cool-end))] to-[hsl(var(--brand-warm-end))]">
            <div className="rounded-2xl bg-white/90 backdrop-blur p-5 ring-1 ring-white/70 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="wl-title">{t('common.title', 'Title')}</Label>
                <Input
                  id="wl-title"
                  placeholder="Birthday 2026"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="wl-description">{t('common.description_optional', 'Description (optional)')}</Label>
                <Textarea
                  id="wl-description"
                  placeholder="A few words about this wishlist"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="wl-event-date">{t('wishlist.event_date', 'Event Date')}</Label>
                <Input
                  id="wl-event-date"
                  type="date"
                  value={eventDate}
                  onChange={(e) => setEventDate(e.target.value)}
                />
              </div>

              <DialogFooter>
                <div className="flex w-full flex-col gap-2 sm:flex-row sm:justify-end sm:gap-3">
                  <Button variant="secondary" onClick={() => setOpen(false)} disabled={saving}>
                    {t('common.cancel', 'Cancel')}
                  </Button>
                  <Button onClick={handleCreate} disabled={saving || !title.trim()}>
                    {saving ? t('common.creating', 'Creating...') : t('common.create', 'Create')}
                  </Button>
                </div>
              </DialogFooter>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default CreateWishlistModal;
