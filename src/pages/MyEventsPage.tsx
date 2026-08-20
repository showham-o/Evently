import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronDown, ChevronUp, Ticket } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../context/AuthProvider';
import { supabase } from '../lib/supabase/client';
import { useMyInvitees } from '../hooks/useMyInvitees';
import type { MyInviteeRow } from '../hooks/useMyInvitees';
import { groupEventsBySeries } from '../utils/recurrence';
import { PageContainer } from '../components/layout/PageContainer';
import { EventCard } from '../components/events/EventCard';
import { EventCardSkeleton } from '../components/ui/Skeleton';
import { EmptyState } from '../components/ui/EmptyState';
import { StatusBadge } from '../components/ui/StatusBadge';
import { Button } from '../components/ui/Button';
import { Seo } from '../components/seo/Seo';

type InviteeListItem = MyInviteeRow & { occurrenceCount: number };

function seriesKey(row: MyInviteeRow): string {
  return row.event.recurrence_group_id ?? row.event.id;
}

export function MyEventsPage() {
  const { profile } = useAuth();
  const { invitees: allInvitees, loading, error, refetch } = useMyInvitees(profile?.id);
  // Cancelled events are visible only to super_admin and the event's own
  // managers (creator/co-managers) - even someone who already registered
  // loses visibility here once it's cancelled (explicit product decision;
  // a cancellation-notification flow is planned separately, not yet built).
  const invitees = allInvitees.filter(
    (inv) =>
      inv.event.status !== 'cancelled' ||
      profile?.role === 'super_admin' ||
      inv.event.manager_ids.includes(profile?.id ?? ''),
  );
  const [confirmingWithdrawId, setConfirmingWithdrawId] = useState<string | null>(null);
  const [withdrawingId, setWithdrawingId] = useState<string | null>(null);
  const [expandedSeries, setExpandedSeries] = useState<Set<string>>(new Set());

  async function handleWithdraw(inviteeId: string) {
    setWithdrawingId(inviteeId);
    const { error: updateError } = await supabase
      .from('event_invitees')
      .update({ registration_status: 'cancelled' })
      .eq('id', inviteeId);
    setWithdrawingId(null);

    if (updateError) {
      toast.error('ביטול ההרשמה נכשל');
      return;
    }

    toast.success('ההרשמה בוטלה בהצלחה');
    setConfirmingWithdrawId(null);
    await refetch();
  }

  function toggleExpanded(key: string) {
    setExpandedSeries((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  // Mirrors ManagerDashboardPage's series-grouping: a recurring series is one
  // invitee row per occurrence, so collapse to one card per series by default,
  // with an option to expand and see/withdraw from every occurrence.
  const groupable = invitees.map((inv) => ({
    ...inv,
    id: inv.id,
    recurrence_group_id: inv.event.recurrence_group_id,
    event_date: inv.event.event_date,
  }));
  const events: InviteeListItem[] = groupEventsBySeries(groupable);
  const inviteesBySeriesKey = new Map<string, MyInviteeRow[]>();
  for (const inv of invitees) {
    const key = seriesKey(inv);
    const list = inviteesBySeriesKey.get(key);
    if (list) list.push(inv);
    else inviteesBySeriesKey.set(key, [inv]);
  }

  function renderInviteeActions(row: MyInviteeRow) {
    const isCancelled = row.registration_status === 'cancelled';
    const isConfirming = confirmingWithdrawId === row.id;
    // Maybe/declined RSVPs get an "update registration" CTA linking to the
    // event's own RsvpForm to resubmit a different status - attending RSVPs
    // keep the plain withdraw-only behavior (explicit product decision).
    const canUpdate = row.rsvp_status === 'maybe' || row.rsvp_status === 'declined';

    return (
      <div className="mt-3 flex flex-col gap-2.5">
        <div className="flex flex-wrap items-center justify-end gap-1.5">
          <StatusBadge status={row.rsvp_status} />
          <StatusBadge status={row.registration_status} tone={isCancelled ? 'slate' : undefined} />
        </div>

        {!isCancelled && canUpdate && (
          <Link to={`/e/${row.event.id}`}>
            <Button variant="primary" className="w-full">
              עדכן הרשמה
            </Button>
          </Link>
        )}

        {!isCancelled &&
          (isConfirming ? (
            <div className="flex gap-2">
              <Button
                variant="danger"
                loading={withdrawingId === row.id}
                onClick={() => handleWithdraw(row.id)}
                className="flex-1"
              >
                אישור ביטול
              </Button>
              <Button
                variant="ghost"
                onClick={() => setConfirmingWithdrawId(null)}
                disabled={withdrawingId === row.id}
                className="flex-1"
              >
                חזרה
              </Button>
            </div>
          ) : canUpdate ? (
            <button
              type="button"
              onClick={() => setConfirmingWithdrawId(row.id)}
              className="self-start text-xs text-slate-500 underline underline-offset-2 hover:text-red-600"
            >
              או, ביטול הרשמה מלא
            </button>
          ) : (
            <Button variant="ghost" onClick={() => setConfirmingWithdrawId(row.id)} className="text-red-600">
              ביטול הרשמה
            </Button>
          ))}
      </div>
    );
  }

  function renderInviteeCard(row: MyInviteeRow, options?: { occurrenceCount?: number }) {
    return (
      <EventCard
        key={row.id}
        event={row.event}
        linkTo={`/e/${row.event.id}`}
        hideCount={row.event.hide_attendee_count}
        occurrenceCount={options?.occurrenceCount}
        footer={renderInviteeActions(row)}
      />
    );
  }

  // Single flat grid, same shape as HomePage's - a series' representative
  // card plus its expand toggle is one grid item; if expanded, each sibling
  // occurrence becomes its own additional grid item right after it, instead
  // of a separate per-series grid (which could misalign columns row to row).
  const gridItems: { key: string; node: React.ReactNode }[] = [];
  for (const row of events) {
    const key = seriesKey(row);
    const seriesInvitees = inviteesBySeriesKey.get(key) ?? [row];
    const otherOccurrences = seriesInvitees.filter((inv) => inv.id !== row.id);
    const expanded = expandedSeries.has(key);

    gridItems.push({
      key: row.id,
      node: (
        <div className="flex flex-col gap-2">
          {renderInviteeCard(row, { occurrenceCount: row.occurrenceCount })}
          {otherOccurrences.length > 0 && (
            <Button
              variant="ghost"
              icon={expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              onClick={() => toggleExpanded(key)}
              className="self-start !px-2.5 !py-1.5 text-slate-500"
            >
              {expanded ? 'הסתרת מופעים נוספים' : `הצגת ${otherOccurrences.length} מופעים נוספים בסדרה`}
            </Button>
          )}
        </div>
      ),
    });

    if (expanded) {
      for (const occurrence of otherOccurrences) {
        gridItems.push({ key: occurrence.id, node: renderInviteeCard(occurrence) });
      }
    }
  }

  return (
    <PageContainer>
      <Seo title="אירועים שנרשמתי | Evently" description="האירועים הקרובים שנרשמת אליהם." path="/my-events" noindex />
      <div className="mb-8">
        <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-900">
          <Ticket className="h-6 w-6 text-primary-600" />
          אירועים שנרשמתי
        </h1>
        <p className="mt-1 text-slate-500">האירועים הקרובים שנרשמת אליהם</p>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <EventCardSkeleton key={i} />
          ))}
        </div>
      ) : error ? (
        <p className="text-sm text-red-600">{error}</p>
      ) : events.length === 0 ? (
        <EmptyState icon={Ticket} title="אינך רשום/ה לאף אירוע קרוב" description="אירועים שתירשמו אליהם יופיעו כאן" />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {gridItems.map((item) => (
            <div key={item.key}>{item.node}</div>
          ))}
        </div>
      )}
    </PageContainer>
  );
}
