import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { CalendarPlus, LayoutDashboard, PencilLine, Repeat, Trash2, User as UserIcon, Users as UsersIcon } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../../context/AuthProvider';
import { supabase } from '../../lib/supabase/client';
import type { EventWithCreator } from '../../lib/supabase/types';
import { PageContainer } from '../../components/layout/PageContainer';
import { EventCardSkeleton } from '../../components/ui/Skeleton';
import { EmptyState } from '../../components/ui/EmptyState';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { formatShortDateTime } from '../../utils/format';

export function ManagerDashboardPage() {
  const { profile } = useAuth();
  const [events, setEvents] = useState<EventWithCreator[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function loadEvents() {
    if (!profile) return;
    setLoading(true);
    const { data } = await supabase
      .from('events')
      .select('*, creator:profiles!created_by(id,full_name)')
      .order('event_date', { ascending: false });

    const all = (data ?? []) as unknown as EventWithCreator[];
    const mine = profile.role === 'super_admin' ? all : all.filter((event) => event.manager_ids.includes(profile.id));
    setEvents(mine);
    setLoading(false);
  }

  useEffect(() => {
    loadEvents();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile]);

  async function handleDelete(eventId: string) {
    setDeletingId(eventId);
    const { error } = await supabase.from('events').delete().eq('id', eventId);
    setDeletingId(null);

    if (error) {
      toast.error('מחיקת האירוע נכשלה');
      return;
    }

    toast.success('האירוע נמחק בהצלחה');
    setConfirmingDeleteId(null);
    setEvents((current) => current.filter((e) => e.id !== eventId));
  }

  return (
    <PageContainer>
      <div className="mb-8 flex items-center justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-900">
            <LayoutDashboard className="h-6 w-6 text-primary-600" />
            ניהול אירועים
          </h1>
          <p className="mt-1 text-slate-500">האירועים שאתם מנהלים או שותפים בניהולם</p>
        </div>
        <Link to="/manager/events/new">
          <Button icon={<CalendarPlus className="h-4 w-4" />}>אירוע חדש</Button>
        </Link>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <EventCardSkeleton key={i} />
          ))}
        </div>
      ) : events.length === 0 ? (
        <EmptyState
          icon={CalendarPlus}
          title="עדיין אין לך אירועים"
          description="צרו אירוע חדש כדי להתחיל"
          action={
            <Link to="/manager/events/new">
              <Button>יצירת אירוע</Button>
            </Link>
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {events.map((event) => (
            <Card key={event.id} className="flex flex-col gap-3 p-5">
              <div className="flex items-start justify-between gap-2">
                <h3 className="font-semibold text-slate-900">{event.title}</h3>
                <StatusBadge status={event.status} />
              </div>
              <p className="text-sm text-slate-500">{formatShortDateTime(event.event_date)}</p>
              {event.recurrence_label && (
                <p className="flex items-center gap-1.5 text-sm text-slate-500">
                  <Repeat className="h-4 w-4 shrink-0" />
                  {event.recurrence_label}
                </p>
              )}
              {event.creator && (
                <p className="flex items-center gap-1.5 text-sm text-slate-500">
                  <UserIcon className="h-4 w-4 shrink-0" />
                  {event.creator.full_name}
                </p>
              )}
              <div className="mt-2 flex gap-2">
                <Link to={`/manager/events/${event.id}/edit`} className="flex-1">
                  <Button variant="outline" icon={<PencilLine className="h-4 w-4" />} className="w-full">
                    עריכה
                  </Button>
                </Link>
                <Link to={`/manager/events/${event.id}/invitees`} className="flex-1">
                  <Button variant="outline" icon={<UsersIcon className="h-4 w-4" />} className="w-full">
                    נרשמים
                  </Button>
                </Link>
              </div>

              {confirmingDeleteId === event.id ? (
                <div className="flex gap-2">
                  <Button
                    variant="danger"
                    loading={deletingId === event.id}
                    onClick={() => handleDelete(event.id)}
                    className="flex-1"
                  >
                    אישור מחיקה
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() => setConfirmingDeleteId(null)}
                    disabled={deletingId === event.id}
                    className="flex-1"
                  >
                    ביטול
                  </Button>
                </div>
              ) : (
                <Button
                  variant="ghost"
                  icon={<Trash2 className="h-4 w-4 text-red-600" />}
                  onClick={() => setConfirmingDeleteId(event.id)}
                  className="text-red-600"
                >
                  מחיקת אירוע
                </Button>
              )}
            </Card>
          ))}
        </div>
      )}
    </PageContainer>
  );
}
