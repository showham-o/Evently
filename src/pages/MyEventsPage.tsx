import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronDown, ChevronUp, MapPin, Ticket } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../context/AuthProvider';
import { supabase } from '../lib/supabase/client';
import { useMyInvitees } from '../hooks/useMyInvitees';
import type { MyInviteeRow } from '../hooks/useMyInvitees';
import { groupEventsBySeries } from '../utils/recurrence';
import { PageContainer } from '../components/layout/PageContainer';
import { EventCardSkeleton } from '../components/ui/Skeleton';
import { EmptyState } from '../components/ui/EmptyState';
import { StatusBadge } from '../components/ui/StatusBadge';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { formatShortDateTime } from '../utils/format';

type InviteeListItem = MyInviteeRow & { occurrenceCount: number };

function seriesKey(row: MyInviteeRow): string {
  return row.event.recurrence_group_id ?? row.event.id;
}

export function MyEventsPage() {
  const { profile } = useAuth();
  const { invitees, loading, error, refetch } = useMyInvitees(profile?.id);
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

  function renderInviteeCard(row: MyInviteeRow, options?: { compact?: boolean }) {
    return (
      <Card key={row.id} className={options?.compact ? 'flex flex-col gap-2.5 p-4' : 'flex flex-col gap-3 p-5'}>
        <div className="flex items-start justify-between gap-2">
          <h3 className={options?.compact ? 'text-sm font-semibold text-slate-900' : 'font-semibold text-slate-900'}>
            {row.event.title}
          </h3>
          <div className="flex shrink-0 flex-col items-end gap-1">
            <StatusBadge status={row.rsvp_status} />
            <StatusBadge
              status={row.registration_status}
              tone={row.registration_status === 'cancelled' ? 'slate' : undefined}
            />
          </div>
        </div>
        <p className="text-sm text-slate-500">{formatShortDateTime(row.event.event_date)}</p>
        {row.event.location && (
          <p className="flex items-center gap-1.5 text-sm text-slate-500">
            <MapPin className="h-4 w-4 shrink-0" />
            {row.event.location}
          </p>
        )}

        <Link to={`/e/${row.event.id}`}>
          <Button variant="outline" className="w-full">
            צפייה באירוע
          </Button>
        </Link>

        {row.registration_status !== 'cancelled' &&
          (confirmingWithdrawId === row.id ? (
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
          ) : (
            <Button
              variant="ghost"
              onClick={() => setConfirmingWithdrawId(row.id)}
              className="text-red-600"
            >
              ביטול הרשמה
            </Button>
          ))}
      </Card>
    );
  }

  return (
    <PageContainer>
      <div className="mb-8">
        <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-900">
          <Ticket className="h-6 w-6 text-primary-600" />
          האירועים שלי
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
        <div className="flex flex-col gap-6">
          {events.map((row) => {
            const key = seriesKey(row);
            const seriesInvitees = inviteesBySeriesKey.get(key) ?? [row];
            const otherOccurrences = seriesInvitees.filter((inv) => inv.id !== row.id);
            const expanded = expandedSeries.has(key);

            return (
              <div key={row.id} className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <div className="flex flex-col gap-2">
                  {renderInviteeCard(row)}
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

                {expanded &&
                  otherOccurrences.map((occurrence) => (
                    <div key={occurrence.id} className="flex flex-col gap-2">
                      {renderInviteeCard(occurrence, { compact: true })}
                    </div>
                  ))}
              </div>
            );
          })}
        </div>
      )}
    </PageContainer>
  );
}
