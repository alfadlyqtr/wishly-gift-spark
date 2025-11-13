import { useMemo, useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import ReactCountryFlag from "react-country-flag";
import { useProfileData } from "@/hooks/use-profile";
// General events will be filtered by user's country and is_public_holiday

type MyEvent = {
  id: string;
  title: string | null;
  event_date: string | null;
  user_id: string;
  privacy_level: string | null;
  description: string | null;
};

type PublicEvent = any;

function useMyEvents() {
  return useQuery({
    queryKey: ["events", "me"],
    queryFn: async (): Promise<MyEvent[]> => {
      const { data: auth } = await supabase.auth.getUser();
      const user = auth.user;
      if (!user) return [];
      const { data, error } = await supabase
        .from("wishlists")
        .select("id, title, event_date, user_id, privacy_level, description")
        .eq("user_id", user.id)
        .not("event_date", "is", null)
        .order("event_date", { ascending: true });
      if (error) return [];
      return (data ?? []) as MyEvent[];
    },
    staleTime: 60_000,
  });
}

// Removed live AI fallback; backend Edge Function will populate DB periodically

function useFriendsEvents() {
  return useQuery({
    queryKey: ["events", "friends"],
    queryFn: async (): Promise<MyEvent[]> => {
      const { data: auth } = await supabase.auth.getUser();
      const user = auth.user;
      if (!user) return [];
      try {
        // Attempt to resolve following IDs from a plausible relationships table.
        // If the table doesn't exist, this will throw and we'll gracefully return [].
        const { data: following, error: relErr } = await (supabase as any)
          .from("user_followers")
          .select("following_id")
          .eq("follower_id", user.id);
        if (relErr || !following || following.length === 0) return [];
        const followingIds = following.map((r: any) => r.following_id);
        const { data, error } = await (supabase as any)
          .from("wishlists")
          .select("id, title, event_date, user_id, privacy_level, description")
          .in("user_id", followingIds)
          .neq("privacy_level", "private")
          .not("event_date", "is", null)
          .order("event_date", { ascending: true });
        if (error) return [];
        return (data ?? []) as MyEvent[];
      } catch {
        return [];
      }
    },
    staleTime: 60_000,
  });
}

function usePublicEvents() {
  return useQuery({
    queryKey: ["events", "public"],
    queryFn: async (): Promise<PublicEvent[]> => {
      try {
        let query = (supabase as any)
          .from("events")
          .select("*")
          .eq("is_public_holiday", true);
        const { data, error } = await query.order("date", { ascending: true });
        if (error) return [];
        return (data ?? []) as any[];
      } catch {
        return [];
      }
    },
    staleTime: 60_000,
  });
}

const Events = () => {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { data: myEvents, isLoading: loadingMy } = useMyEvents();
  const { data: friendsEvents, isLoading: loadingFriends } = useFriendsEvents();
  // Profile no longer needed for public holiday display
  const { data: publicEvents, isLoading: loadingPublic } = usePublicEvents();
  const [refreshing, setRefreshing] = useState(false);
  const [monthFilter, setMonthFilter] = useState<number | 'all'>('all');
  const { data: profileBundle } = useProfileData();
  

  const today = useMemo(() => new Date(), []);

  const eventBadge = (title?: string | null) => {
    const t = (title || '').toLowerCase();
    let glyph = '📅';
    if (/birth/.test(t)) glyph = '🎂';
    else if (/party|celebrat/.test(t)) glyph = '🎉';
    else if (/meet|coffee|dinner/.test(t)) glyph = '🗓️';
    return (
      <span
        className="inline-flex h-8 w-8 items-center justify-center rounded-xl text-base text-white shadow-[0_8px_18px_rgba(200,80,192,0.28)] ring-1 ring-white/50 bg-gradient-to-br from-[#FFCC70] via-[#C850C0] to-[#4158D0]"
        aria-hidden="true"
      >
        {glyph}
      </span>
    );
  };

  useEffect(() => {
    (async () => {
      const dobIso = profileBundle?.profile?.dob as string | null | undefined;
      if (!dobIso) return;
      const { data: auth } = await supabase.auth.getUser();
      const user = auth.user;
      if (!user) return;
      const dob = new Date(dobIso);
      if (isNaN(dob.getTime())) return;
      const now = new Date();
      const targetYear = (now.getMonth() > dob.getMonth() || (now.getMonth() === dob.getMonth() && now.getDate() > dob.getDate())) ? now.getFullYear() + 1 : now.getFullYear();
      const nextBirthday = new Date(targetYear, dob.getMonth(), dob.getDate());
      const yyyy = nextBirthday.getFullYear();
      const mm = String(nextBirthday.getMonth() + 1).padStart(2, '0');
      const dd = String(nextBirthday.getDate()).padStart(2, '0');
      const nextBirthdayIso = `${yyyy}-${mm}-${dd}`;
      const title = 'My Birthday Wishlist';
      const { data: exists, error: selErr } = await (supabase as any)
        .from('wishlists')
        .select('id, event_date')
        .eq('user_id', user.id)
        .eq('title', title)
        .limit(1);
      if (selErr) return;
      if (exists && exists.length > 0) {
        const current = exists[0];
        if ((current as any)?.event_date !== nextBirthdayIso) {
          await (supabase as any)
            .from('wishlists')
            .update({ event_date: nextBirthdayIso, description: 'My Birthday Wishlist' })
            .eq('id', (current as any).id);
        }
      } else {
        await (supabase as any)
          .from('wishlists')
          .insert({
            user_id: user.id,
            title,
            description: 'My Birthday Wishlist',
            event_date: nextBirthdayIso,
            privacy_level: 'private'
          });
      }
      await queryClient.invalidateQueries({ queryKey: ['events', 'me'] });
    })();
  }, [profileBundle?.profile?.dob, queryClient]);

  return (
    <div className="container max-w-2xl mx-auto px-4 py-6 space-y-6">
      <div className="flex items-center gap-3">
        <div className="relative inline-flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[#4158D0] via-[#C850C0] to-[#FFCC70] shadow-[0_12px_30px_rgba(200,80,192,0.45)] ring-1 ring-white/40">
          <Calendar className="h-5 w-5 text-white drop-shadow" />
          <span className="absolute -inset-1 rounded-[14px] blur-md bg-gradient-to-br from-[#ffcc70]/20 to-[#c850c0]/10" aria-hidden="true" />
        </div>
        <h2 className="text-2xl font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-[#4158D0] via-[#C850C0] to-[#FFCC70] drop-shadow">{t('events.title', 'Events')}</h2>
      </div>

      <Tabs defaultValue="mine" className="w-full">
        <TabsList className="grid grid-cols-3 rounded-2xl bg-white/40 backdrop-blur px-1 py-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.6)] ring-1 ring-white/50">
          <TabsTrigger value="mine" className="data-[state=active]:bg-white data-[state=active]:shadow-sm rounded-xl transition">{t('events.tab_my', 'My Events')}</TabsTrigger>
          <TabsTrigger value="friends" className="data-[state=active]:bg-white data-[state=active]:shadow-sm rounded-xl transition">{t('events.tab_friends', "Friends' Events")}</TabsTrigger>
          <TabsTrigger value="public" className="data-[state=active]:bg-white data-[state=active]:shadow-sm rounded-xl transition">{t('events.tab_general', 'General Events')}</TabsTrigger>
        </TabsList>

        <TabsContent value="mine" className="pt-4">
          <Card className="border-0 rounded-2xl ring-1 ring-white/30 bg-gradient-to-br from-[#4158D0]/10 via-[#C850C0]/10 to-[#FFCC70]/10 shadow-[0_18px_40px_rgba(0,0,0,0.20)]">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold">{t('events.tab_my', 'My Events')}</CardTitle>
            </CardHeader>
            <CardContent>
              {loadingMy ? (
                <p className="text-sm text-muted-foreground">{t('common.loading', 'Loading...')}</p>
              ) : (myEvents?.length ?? 0) === 0 ? (
                <p className="text-sm text-muted-foreground">{t('events.empty_my', 'No upcoming events.')}</p>
              ) : (
                <div className="divide-y divide-white/20">
                  {myEvents!.map((e) => (
                    <div key={e.id} className="py-2">
                      <div className="flex items-center justify-between rounded-xl bg-white/50 backdrop-blur px-3 py-2 ring-1 ring-white/60 shadow-sm hover:shadow-md transition-transform hover:-translate-y-[1px]">
                        <div className="flex items-center gap-3 min-w-0">
                          {eventBadge(e.title)}
                          <div className="min-w-0">
                            <div className="font-medium truncate">{(() => {
                              const raw = e.title || t('events.untitled', 'Untitled');
                              return raw === 'My Birthday Wishlist' ? 'My Birthday' : raw;
                            })()}</div>
                            {e.description && (
                              <div className="text-sm text-muted-foreground line-clamp-1">{e.description}</div>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="text-sm text-muted-foreground">
                            {e.event_date ? new Date(e.event_date).toLocaleDateString('en-GB', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' }) : ''}
                          </div>
                          {e.title !== 'My Birthday Wishlist' && (
                            <>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="hover:scale-105 transition"
                                aria-label="Edit event"
                                onClick={async () => {
                                  const newTitle = window.prompt('Edit title', e.title ?? '') ?? undefined;
                                  const newDesc = window.prompt('Edit description', e.description ?? '') ?? undefined;
                                  if (newTitle === undefined && newDesc === undefined) return;
                                  try {
                                    const payload: any = {};
                                    if (typeof newTitle === 'string') payload.title = newTitle;
                                    if (typeof newDesc === 'string') payload.description = newDesc;
                                    if (Object.keys(payload).length === 0) return;
                                    await (supabase as any)
                                      .from('wishlists')
                                      .update(payload)
                                      .eq('id', e.id);
                                    await queryClient.invalidateQueries({ queryKey: ['events', 'me'] });
                                  } catch {}
                                }}
                              >
                                <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-white bg-gradient-to-br from-[#7dd3fc] via-[#a78bfa] to-[#f472b6] ring-1 ring-white/50 shadow-[0_6px_14px_rgba(124,58,237,0.28)]">
                                  <Pencil className="h-4 w-4" />
                                </span>
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="hover:scale-105 transition"
                                aria-label="Delete event"
                                onClick={async () => {
                                  const ok = window.confirm('Delete this event?');
                                  if (!ok) return;
                                  try {
                                    await (supabase as any)
                                      .from('wishlists')
                                      .delete()
                                      .eq('id', e.id);
                                    await queryClient.invalidateQueries({ queryKey: ['events', 'me'] });
                                  } catch {}
                                }}
                              >
                                <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-white bg-gradient-to-br from-[#fca5a5] via-[#f97316] to-[#f59e0b] ring-1 ring-white/50 shadow-[0_6px_14px_rgba(249,115,22,0.28)]">
                                  <Trash2 className="h-4 w-4" />
                                </span>
                              </Button>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="friends" className="pt-4">
          <Card className="border-0 rounded-2xl ring-1 ring-white/30 bg-gradient-to-br from-[#4158D0]/10 via-[#C850C0]/10 to-[#FFCC70]/10 shadow-[0_18px_40px_rgba(0,0,0,0.20)]">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold">{t('events.tab_friends', "Friends' Events")}</CardTitle>
            </CardHeader>
            <CardContent>
              {loadingFriends ? (
                <p className="text-sm text-muted-foreground">{t('common.loading', 'Loading...')}</p>
              ) : (friendsEvents?.length ?? 0) === 0 ? (
                <p className="text-sm text-muted-foreground">{t('events.empty_friends', "No friends' events.")}</p>
              ) : (
                <div className="divide-y divide-white/20">
                  {friendsEvents!.map((e) => (
                    <div key={e.id} className="py-2">
                      <div className="flex items-center justify-between rounded-xl bg-white/50 backdrop-blur px-3 py-2 ring-1 ring-white/60 shadow-sm">
                        <div className="flex items-center gap-3 min-w-0">
                          {eventBadge(e.title)}
                          <div className="min-w-0">
                            <div className="font-medium truncate">{e.title || t('events.untitled', 'Untitled')}</div>
                            {e.description && (
                              <div className="text-sm text-muted-foreground line-clamp-1">{e.description}</div>
                            )}
                          </div>
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {e.event_date ? new Date(e.event_date).toLocaleDateString(undefined, { weekday: 'long', month: 'numeric', day: 'numeric', year: 'numeric' }) : ''}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="public" className="pt-4">
          <Card className="border-0 rounded-2xl ring-1 ring-white/30 bg-gradient-to-br from-[#4158D0]/10 via-[#C850C0]/10 to-[#FFCC70]/10 shadow-[0_18px_40px_rgba(0,0,0,0.20)]">
            <CardHeader className="pb-3 flex flex-row items-center justify-between">
              <div className="flex flex-col">
                <CardTitle className="text-base font-semibold">{t('events.tab_general', 'General Events')}</CardTitle>
                <span className="text-xs text-muted-foreground">{t('events.public_holiday_disclaimer', 'Public holiday dates can vary.')}</span>
              </div>
              <div className="flex items-center gap-2">
                <select
                  className="border rounded-md px-2 py-1 text-sm"
                  value={monthFilter === 'all' ? 'all' : String(monthFilter)}
                  onChange={(e) => {
                    const v = e.target.value;
                    setMonthFilter(v === 'all' ? 'all' : Number(v));
                  }}
                  aria-label="Filter by month"
                >
                  <option value="all">All months</option>
                  <option value="1">January</option>
                  <option value="2">February</option>
                  <option value="3">March</option>
                  <option value="4">April</option>
                  <option value="5">May</option>
                  <option value="6">June</option>
                  <option value="7">July</option>
                  <option value="8">August</option>
                  <option value="9">September</option>
                  <option value="10">October</option>
                  <option value="11">November</option>
                  <option value="12">December</option>
                </select>
              <Button
                variant="outline"
                size="sm"
                disabled={refreshing}
                onClick={async () => {
                  try {
                    setRefreshing(true);
                    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
                    const supabaseAnon = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
                    if (supabaseUrl && supabaseAnon) {
                      await fetch(`${supabaseUrl}/functions/v1/update-public-events`, {
                        method: 'POST',
                        headers: {
                          'Content-Type': 'application/json',
                          apikey: supabaseAnon,
                          Authorization: `Bearer ${supabaseAnon}`,
                        },
                      });
                    } else {
                      await supabase.functions.invoke('update-public-events');
                    }
                    await queryClient.invalidateQueries({
                      predicate: (q) => Array.isArray(q.queryKey) && q.queryKey[0] === 'events' && q.queryKey[1] === 'public'
                    });
                    await queryClient.invalidateQueries({
                      predicate: (q) => Array.isArray(q.queryKey) && q.queryKey[0] === 'events'
                    });
                  } finally {
                    setRefreshing(false);
                  }
                }}
              >
                {refreshing ? t('common.loading', 'Loading...') : t('events.refresh_holidays', 'Refresh Holidays')}
              </Button>
              </div>
            </CardHeader>
            <CardContent>
              {loadingPublic ? (
                <p className="text-sm text-muted-foreground">{t('common.loading', 'Loading...')}</p>
              ) : (
                (() => {
                  const rows = publicEvents ?? [];
                  // Group Eid holidays into ranges by country/year
                  const isFitr = (s: string) => /eid\s*al[- ]fitr/i.test(s);
                  const isAdha = (s: string) => /eid\s*al[- ]adha/i.test(s);
                  type Row = any;
                  type GroupKey = string;
                  const groups = new Map<GroupKey, { name: string; country_tag: string; dates: string[] }>();
                  const passthrough: Row[] = [];
                  for (const e of rows as Row[]) {
                    const name = String(e?.name || e?.title || '');
                    const cc = String(e?.country_code || e?.country || '');
                    const d = String(e?.date || e?.event_date || '');
                    const year = d.slice(0, 4);
                    if ((isFitr(name) || isAdha(name)) && /\d{4}-\d{2}-\d{2}/.test(d)) {
                      const kind = isFitr(name) ? 'fitr' : 'adha';
                      const key: GroupKey = `${cc}__${year}__${kind}`;
                      if (!groups.has(key)) groups.set(key, { name: isFitr(name) ? 'Eid al-Fitr' : 'Eid al-Adha', country_tag: cc, dates: [] });
                      groups.get(key)!.dates.push(d);
                    } else {
                      passthrough.push(e);
                    }
                  }
                  const grouped: Row[] = Array.from(groups.values()).map((g) => {
                    const sorted = g.dates.sort();
                    const start = sorted[0];
                    const end = sorted[sorted.length - 1];
                    return { id: `${g.country_tag}-${g.name}-${start}-${end}`, name: g.name, country_code: g.country_tag, date_start: start, date_end: end };
                  });
                  // Merge and sort by start date
                  let merged: Row[] = [...passthrough, ...grouped].sort((a, b) => {
                    const da = new Date(a.date_start || a.date || a.event_date || 0).getTime();
                    const db = new Date(b.date_start || b.date || b.event_date || 0).getTime();
                    return da - db;
                  });
                  if (monthFilter !== 'all') {
                    const m = Number(monthFilter) - 1; // JS months are 0-based
                    merged = merged.filter((e: any) => {
                      const dRef = e.date_start || e.date || e.event_date;
                      if (!dRef) return false;
                      const d = new Date(dRef);
                      return d.getMonth() === m;
                    });
                  }
                  return rows.length === 0 ? (
                    <p className="text-sm text-muted-foreground">{t('events.empty_general', 'No public events.')}</p>
                  ) : (
                    <div className="divide-y divide-white/20">
                      {merged.map((e: any) => (
                        <div key={e.id || `${e.name}-${e.date}-${e.country_code || e.country}`} className="py-2">
                          <div className="flex items-center justify-between rounded-xl bg-white/50 backdrop-blur px-3 py-2 ring-1 ring-white/60 shadow-sm">
                            <div className="min-w-0">
                              <div className="font-medium truncate">{e?.name || e?.title || t('events.untitled', 'Untitled')}</div>
                              {(() => {
                                const raw = (e?.name || e?.title || '').toString();
                                const name = raw.toLowerCase();
                                const countryRaw = (e?.country_code || e?.country || '').toString().trim();
                                const normalize = (s: string) => s.trim().toLowerCase();
                                const toIso2 = (s: string): string => {
                                  const n = normalize(s);
                                  const map: Record<string, string> = {
                                    qatar: 'QA', 'saudi arabia': 'SA', 'united arab emirates': 'AE', uae: 'AE',
                                    bahrain: 'BH', kuwait: 'KW', oman: 'OM', egypt: 'EG', jordan: 'JO', lebanon: 'LB',
                                    'united states': 'US', usa: 'US', 'united kingdom': 'GB', uk: 'GB'
                                  };
                                  if (/^[A-Za-z]{2}$/.test(s)) return s.toUpperCase();
                                  return map[n] ? map[n] : '';
                                };
                                const cc = toIso2(countryRaw);
                                let iconNode: any = <span>📅</span>;
                                let text = 'Mark the date';
                                // prioritize sports before national so National Sports Day shows sports remark
                                if (/sports?|sport/.test(name)) { iconNode = <span>🏃</span>; text = "Let's keep in shape"; }
                                else if (/ramadan/.test(name)) { iconNode = <span>🌙</span>; text = 'Month of reflection'; }
                                else if (/eid\s*al[- ]fitr/.test(name)) { iconNode = <span>🎉</span>; text = 'Feast after fasting'; }
                                else if (/eid\s*al[- ]adha/.test(name)) { iconNode = <span>🕋</span>; text = 'Festival of sacrifice'; }
                                else if (/(national|independence).*day/.test(name)) {
                                  iconNode = cc ? (
                                    <ReactCountryFlag svg countryCode={cc} style={{ width: '18px', height: '14px' }} aria-label={cc} />
                                  ) : (
                                    <span>🏛️</span>
                                  );
                                  text = 'Celebrate the nation';
                                }
                                else if (/bank/.test(name)) { iconNode = <span>🏦</span>; text = 'Banks closed'; }
                                else if (/(labor|labour)\s*day/.test(name)) { iconNode = <span>🛠️</span>; text = 'Workers’ day'; }
                                else if (/christmas/.test(name)) { iconNode = <span>🎄</span>; text = 'Merry and bright'; }
                                else if (/equinox|solstice/.test(name)) { iconNode = <span>🌌</span>; text = 'Seasonal balance'; }
                                else if (/new year'?s\s+day/.test(name)) { iconNode = <span>🎉</span>; text = 'Fresh start'; }
                                else if (/new year'?s/.test(name)) { iconNode = <span>🎉</span>; text = 'New beginnings'; }
                                return (
                                  <div className="text-sm text-muted-foreground line-clamp-1 flex items-center gap-1">
                                    {iconNode}
                                    <span>{text}</span>
                                  </div>
                                );
                              })()}
                              {(() => {
                                const raw = (e?.name || e?.title || '').toString().toLowerCase();
                                const isNational = /(national|independence).*day/.test(raw);
                                const hasCountry = Boolean(e?.country_code || e?.country);
                                if (!isNational && hasCountry) {
                                  return (
                                    <div className="text-sm text-muted-foreground">{e.country_code || e.country}</div>
                                  );
                                }
                                return null;
                              })()}
                            </div>
                            <div className="text-sm text-muted-foreground">
                              {(() => {
                                const dStart = e?.date_start || e?.date || e?.event_date || '';
                                const dEnd = e?.date_end || '';
                                const fmt = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' });
                                if (dStart && dEnd && dStart !== dEnd) {
                                  return `${fmt(dStart)} → ${fmt(dEnd)}`;
                                }
                                return (e?.date || e?.event_date) ? fmt(e?.date || e?.event_date) : '';
                              })()}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                })()
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Events;
