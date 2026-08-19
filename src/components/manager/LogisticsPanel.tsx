import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { PackagePlus } from 'lucide-react';
import type { EventLogisticsItem } from '../../lib/supabase/types';
import { addLogisticsItem, deleteLogisticsItem, getLogisticsItems, updateLogisticsItem } from '../../utils/logistics';
import type { LogisticsItemInput } from '../../utils/logistics';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { LogisticsItemModal, emptyLogisticsForm } from './LogisticsItemModal';
import { LogisticsItemsTable } from './LogisticsItemsTable';

export function LogisticsPanel({ eventId }: { eventId: string }) {
  const [items, setItems] = useState<EventLogisticsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<EventLogisticsItem | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function loadItems() {
    setLoading(true);
    try {
      setItems(await getLogisticsItems(eventId));
    } catch {
      toast.error('טעינת פריטי הלוגיסטיקה נכשלה');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadItems();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId]);

  function openAddModal() {
    setEditingItem(null);
    setModalOpen(true);
  }

  async function handleSubmit(values: LogisticsItemInput) {
    setSubmitting(true);
    try {
      if (editingItem) {
        await updateLogisticsItem(editingItem.id, values);
        toast.success('הפריט עודכן בהצלחה');
      } else {
        await addLogisticsItem(eventId, values);
        toast.success('הפריט נוסף בהצלחה');
      }
      setModalOpen(false);
      await loadItems();
    } catch {
      toast.error('שמירת הפריט נכשלה');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(item: EventLogisticsItem) {
    setDeletingId(item.id);
    try {
      await deleteLogisticsItem(item.id);
      toast.success('הפריט נמחק בהצלחה');
      setItems((current) => current.filter((i) => i.id !== item.id));
    } catch {
      toast.error('מחיקת הפריט נכשלה');
    } finally {
      setDeletingId(null);
    }
  }

  const currentInitial: LogisticsItemInput = editingItem
    ? {
        item_name: editingItem.item_name,
        supplier_name: editingItem.supplier_name ?? '',
        quantity: editingItem.quantity ?? 1,
        cost: editingItem.cost ?? 0,
        status: editingItem.status,
      }
    : emptyLogisticsForm;

  return (
    <Card className="p-6">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-lg font-semibold text-slate-900">לוגיסטיקה וספקים</h3>
        <Button variant="outline" icon={<PackagePlus className="h-4 w-4" />} onClick={openAddModal}>
          הוספת פריט
        </Button>
      </div>

      <LogisticsItemsTable
        items={items}
        loading={loading}
        deletingId={deletingId}
        onEdit={(item) => {
          setEditingItem(item);
          setModalOpen(true);
        }}
        onDelete={handleDelete}
      />

      <LogisticsItemModal
        open={modalOpen}
        initial={currentInitial}
        submitting={submitting}
        onCancel={() => setModalOpen(false)}
        onSubmit={handleSubmit}
      />
    </Card>
  );
}
