import React, { useEffect, useRef, useState } from "react";
import { Input } from "./input";
import { Avatar, AvatarFallback, AvatarImage } from "./avatar";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";

interface UserProfile {
  id: string;
  username: string | null;
  full_name: string | null;
  avatar_url: string | null;
}

interface MentionInputProps
  extends React.ComponentProps<typeof Input> {
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

export const MentionInput: React.FC<MentionInputProps> = ({
  value,
  onChange,
  ...props
}) => {
  const [internalValue, setInternalValue] = useState(value || "");
  const [isMentioning, setIsMentioning] = useState(false);
  const [mentionQuery, setMentionQuery] = useState("");
  const [mentionStart, setMentionStart] = useState<number | null>(null);
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const { data: users = [], isLoading } = useQuery<UserProfile[]>({
    queryKey: ["mentionable-users", mentionQuery],
    enabled: isMentioning && mentionQuery.length > 0,
    queryFn: async () => {
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth.user?.id;
      if (!uid || !mentionQuery) return [];

      const followerSelect =
        "id,user_id,following_id,status,user_profiles!followers_user_id_fkey(id,username,full_name,avatar_url)";
      const followingSelect =
        "id,user_id,following_id,status,user_profiles!followers_following_id_fkey(id,username,full_name,avatar_url)";

      const [followersRes, followingRes] = await Promise.all([
        supabase
          .from("followers" as any)
          .select(followerSelect)
          .eq("following_id", uid)
          .eq("status", "accepted"),
        supabase
          .from("followers" as any)
          .select(followingSelect)
          .eq("user_id", uid)
          .eq("status", "accepted"),
      ]);

      if (followersRes.error) throw followersRes.error;
      if (followingRes.error) throw followingRes.error;

      const profilesById = new Map<string, UserProfile>();

      for (const row of (followersRes.data as any[]) || []) {
        const p = (row as any).user_profiles as UserProfile | null;
        if (p && p.id) {
          profilesById.set(p.id, p);
        }
      }

      for (const row of (followingRes.data as any[]) || []) {
        const p = (row as any).user_profiles as UserProfile | null;
        if (p && p.id) {
          profilesById.set(p.id, p);
        }
      }

      if (profilesById.size === 0) return [];

      const q = mentionQuery.toLowerCase();
      const allProfiles = Array.from(profilesById.values());

      return allProfiles
        .filter((p) => {
          const uname = (p.username || "").toLowerCase();
          const fname = (p.full_name || "").toLowerCase();
          return uname.includes(q) || fname.includes(q);
        })
        .slice(0, 8);
    },
  });

  useEffect(() => {
    setInternalValue(value || "");
  }, [value]);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (!containerRef.current) return;
      if (!containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setIsMentioning(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const text = e.target.value;
    setInternalValue(text);

    const cursor = e.target.selectionStart ?? text.length;
    const before = text.slice(0, cursor);
    const atIndex = before.lastIndexOf("@");

    if (atIndex >= 0 && (atIndex === 0 || /\s/.test(before[atIndex - 1]))) {
      const query = before.slice(atIndex + 1);
      if (query.length > 0) {
        setIsMentioning(true);
        setMentionQuery(query);
        setMentionStart(atIndex);
        setOpen(true);
      } else {
        setIsMentioning(true);
        setMentionQuery("");
        setMentionStart(atIndex);
        setOpen(false);
      }
    } else {
      setIsMentioning(false);
      setMentionQuery("");
      setMentionStart(null);
      setOpen(false);
    }

    onChange(e);
  };

  const handleSelect = (u: UserProfile) => {
    if (mentionStart === null) return;
    const username = u.username || "";
    if (!username) return;

    const cursor = inputRef.current?.selectionStart ?? internalValue.length;
    const before = internalValue.slice(0, mentionStart);
    const after = internalValue.slice(mentionStart + 1 + mentionQuery.length);
    const inserted = `@${username} `;
    const nextValue = before + inserted + after;

    setInternalValue(nextValue);
    setIsMentioning(false);
    setMentionQuery("");
    setMentionStart(null);
    setOpen(false);

    const synthetic = {
      ...({} as React.ChangeEvent<HTMLInputElement>),
      target: { value: nextValue } as any,
    };
    onChange(synthetic);

    requestAnimationFrame(() => {
      if (inputRef.current) {
        const pos = (before + inserted).length;
        inputRef.current.setSelectionRange(pos, pos);
        inputRef.current.focus();
      }
    });
  };

  return (
    <div className="relative w-full" ref={containerRef}>
      <Input
        {...props}
        ref={inputRef}
        value={internalValue}
        onChange={handleChange}
      />
      {open && (isLoading || users.length > 0) && (
        <div className="absolute left-0 right-0 top-full z-40 mt-1 max-h-60 overflow-y-auto rounded-md border bg-popover p-1 text-sm shadow-md">
          {isLoading ? (
            <div className="px-2 py-1 text-xs text-muted-foreground">
              Loading...
            </div>
          ) : (
            users.map((u) => {
              const name = u.full_name || u.username || "User";
              return (
                <button
                  key={u.id}
                  type="button"
                  className="flex w-full items-center gap-2 rounded px-2 py-1 text-left hover:bg-muted"
                  onClick={() => handleSelect(u)}
                >
                  <Avatar className="h-6 w-6">
                    <AvatarImage src={u.avatar_url || ""} />
                    <AvatarFallback>
                      {name.toString().charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex flex-col min-w-0">
                    <span className="truncate text-xs font-medium">{name}</span>
                    {u.username && (
                      <span className="truncate text-[11px] text-muted-foreground">
                        @{u.username}
                      </span>
                    )}
                  </div>
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
};
