import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { toast } from 'sonner';
import { PackagePlus, PencilLine, Trash2 } from 'lucide-react';
import type { EventLogisticsItem, LogisticsStatus } from '../../lib/supabase/types';
import {
  addLogisticsItem,
  deleteLogisticsItem,
  getLogisticsItems,
  updateLogisticsItem,
} from '../../utils/logistics';
import type { LogisticsItemInput } from '../../utils/logistics';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Modal } from '../ui/Modal';
import { StatusBadge } from '../ui/StatusBadge';
import { EmptyState } from '../ui/EmptyState';

const statusOptions: { value: LogisticsStatus; label: string }[] = [
  { value: 'pending', label: 'ממתין' },
  { value: 'ordered', label: 'הוזמן' },
  { value: 'received', label: 'התקבל' },
  { value: 'cancelled', label: 'בוטל' },
];

const emptyForm: LogisticsItemInput = {
  item_name: '',
  supplier_name: '',
  quantity: 1,
  cost: 0,
  status: 'pending',
};

function ItemFormModal({
  open,
  initial,
  submitting,
  onCancel,
  onSubmit,
}: {
  open: boolean;
  initial: LogisticsItemInput;
  submitting: boolean;
  onCancel: () => void;
  onSubmit: (values: LogisticsItemInput) => void;
}) {
  const [values, setValues] = useState<LogisticsItemInput>(initial);

  useEffect(() => {
    if (open) setValues(initial);
  }, [open, initial]);

  function update<K extends keyof LogisticsItemInput>(key: K, value: LogisticsItemInput[K]) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    onSubmit(values);
  }

  return (
    <Modal open={open} title="פריט לוגיסטי" onClose={onCancel}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Input
          id="itemName"
          label="שם הפריט"
          required
          value={values.item_name}
          onChange={(e) => update('item_name', e.target.value)}
        />
        <Input
          id="supplierName"
          label="ספק"
          value={values.supplier_name}
          onChange={(e) => update('supplier_name', e.target.value)}
        />
        <div className="grid grid-cols-2 gap-4">
          <Input
            id="quantity"
            type="number"
            min={0}
            label="כמות"
            value={String(values.quantity)}
            onChange={(e) => update('quantity', Number(e.target.value))}
          />
          <Input
            id="cost"
            type="number"
            min={0}
            step="0.01"
            label="עלות"
            value={String(values.cost)}
            onChange={(e) => update('cost', Number(e.target.value))}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="itemStatus" className="text-sm font-medium text-slate-700">
            סטטוס
          </label>
          <select
            id="itemStatus"
            value={values.status}
            onChange={(e) => update('status', e.target.value as LogisticsStatus)}
            className="rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/30"
          >
            {statusOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        <div className="mt-2 flex gap-2">
          <Button type="submit" loading={submitting} className="flex-1">
            שמירה
          </Button>
          <Button type="button" variant="outline" onClick={onCancel} disabled={submitting} className="flex-1">
            ביטול
          </Button>
        </div>
      </form>
    </Modal>
  );
}

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

  function openEditModal(item: EventLogisticsItem) {
    setEditingItem(item);
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

  async function handleDelete(id: string) {
    setDeletingId(id);
    try {
      await deleteLogisticsItem(id);
      toast.success('הפריט נמחק בהצלחה');
      setItems((current) => current.filter((item) => item.id !== id));
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
    : emptyForm;

  return (
    <Card className="p-6">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-lg font-semibold text-slate-900">לוגיסטיקה וספקים</h3>
        <Button variant="outline" icon={<PackagePlus className="h-4 w-4" />} onClick={openAddModal}>
          הוספת פריט
        </Button>
      </div>

      {loading ? (
        <p className="text-sm text-slate-400">טוען...</p>
      ) : items.length === 0 ? (
        <EmptyState icon={PackagePlus} title="אין עדיין פריטי לוגיסטיקה" description="הוסיפו פריטים וספקים לאירוע" />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="w-full text-start text-sm">
            <thead className="bg-slate-50 text-slate-500">
              <tr>
                <th className="px-4 py-2.5 text-start font-medium">פריט</th>
                <th className="px-4 py-2.5 text-start font-medium">ספק</th>
                <th className="px-4 py-2.5 text-start font-medium">כמות</th>
                <th className="px-4 py-2.5 text-start font-medium">עלות</th>
                <th className="px-4 py-2.5 text-start font-medium">סטטוס</th>
                <th className="px-4 py-2.5 text-start font-medium">פעולות</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.map((item) => (
                <tr key={item.id}>
                  <td className="px-4 py-2.5 text-slate-900">{item.item_name}</td>
                  <td className="px-4 py-2.5 text-slate-500">{item.supplier_name || '-'}</td>
                  <td className="px-4 py-2.5 text-slate-500">{item.quantity ?? '-'}</td>
                  <td className="px-4 py-2.5 text-slate-500">
                    <span dir="ltr">₪{(item.cost ?? 0).toLocaleString()}</span>
                  </td>
                  <td className="px-4 py-2.5">
                    <StatusBadge status={item.status} />
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="flex gap-2">
                      <Button
                        variant="ghost"
                        className="!px-2.5 !py-1.5"
                        onClick={() => openEditModal(item)}
                        aria-label="עריכה"
                      >
                        <PencilLine className="h-4 w-4 text-slate-500" />
                      </Button>
                      <Button
                        variant="ghost"
                        className="!px-2.5 !py-1.5"
                        loading={deletingId === item.id}
                        onClick={() => handleDelete(item.id)}
                        aria-label="מחיקה"
                      >
                        <Trash2 className="h-4 w-4 text-red-600" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <ItemFormModal
        open={modalOpen}
        initial={currentInitial}
        submitting={submitting}
        onCancel={() => setModalOpen(false)}
        onSubmit={handleSubmit}
      />
    </Card>
  );
}
