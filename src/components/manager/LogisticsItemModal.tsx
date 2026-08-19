import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import type { LogisticsStatus } from '../../lib/supabase/types';
import type { LogisticsItemInput } from '../../utils/logistics';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Modal } from '../ui/Modal';

const statusOptions: { value: LogisticsStatus; label: string }[] = [
  { value: 'pending', label: 'ממתין' },
  { value: 'ordered', label: 'הוזמן' },
  { value: 'received', label: 'התקבל' },
  { value: 'cancelled', label: 'בוטל' },
];

export const emptyLogisticsForm: LogisticsItemInput = {
  item_name: '',
  supplier_name: '',
  quantity: 1,
  cost: 0,
  status: 'pending',
};

export function LogisticsItemModal({
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
