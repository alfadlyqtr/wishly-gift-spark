import React, { useState } from "react";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
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
      toast.error("Title is required");
      return;
    }

    try {
      setSaving(true);
      const { data: auth } = await supabase.auth.getUser();
      const user = auth.user;
      if (!user) {
        toast.error("Please sign in to create a wishlist");
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
        toast.error(error.message || "Failed to create wishlist");
        return;
      }

      toast.success("Wishlist created");
      await queryClient.invalidateQueries({ queryKey: ["wishlists"] });
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
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>{children}</SheetTrigger>
      <SheetContent side="bottom" className="max-w-full sm:max-w-md mx-auto w-full rounded-t-xl bottom-6 sm:bottom-8">
        <SheetHeader>
          <SheetTitle>{t('wishlist.create_title', 'Create Wishlist')}</SheetTitle>
          <SheetDescription>{t('wishlist.create_hint', 'Start with a title and optional details. You can customize more later.')}</SheetDescription>
        </SheetHeader>

        <div className="space-y-4">
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
        </div>

        <SheetFooter>
          <Button variant="secondary" onClick={() => setOpen(false)} disabled={saving}>
            {t('common.cancel', 'Cancel')}
          </Button>
          <Button onClick={handleCreate} disabled={saving || !title.trim()}>
            {saving ? t('common.creating', 'Creating...') : t('common.create', 'Create')}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
};

export default CreateWishlistModal;
