import { PackagePlus, PencilLine, Trash2 } from 'lucide-react';
import type { LogisticsStatus } from '../../lib/supabase/types';
import { Button } from '../ui/Button';
import { StatusBadge } from '../ui/StatusBadge';
import { EmptyState } from '../ui/EmptyState';

export interface LogisticsDisplayItem {
  id: string;
  item_name: string;
  supplier_name: string | null;
  quantity: number | null;
  cost: number | null;
  status: LogisticsStatus;
}

interface LogisticsItemsTableProps<T extends LogisticsDisplayItem> {
  items: T[];
  loading?: boolean;
  deletingId?: string | null;
  onEdit: (item: T) => void;
  onDelete: (item: T) => void;
}

export function LogisticsItemsTable<T extends LogisticsDisplayItem>({
  items,
  loading,
  deletingId,
  onEdit,
  onDelete,
}: LogisticsItemsTableProps<T>) {
  if (loading) return <p className="text-sm text-slate-400">טוען...</p>;

  if (items.length === 0) {
    return <EmptyState icon={PackagePlus} title="אין עדיין פריטי לוגיסטיקה" description="הוסיפו פריטים וספקים לאירוע" />;
  }

  return (
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
                  <Button variant="ghost" className="!px-2.5 !py-1.5" onClick={() => onEdit(item)} aria-label="עריכה">
                    <PencilLine className="h-4 w-4 text-slate-500" />
                  </Button>
                  <Button
                    variant="ghost"
                    className="!px-2.5 !py-1.5"
                    loading={deletingId === item.id}
                    onClick={() => onDelete(item)}
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
  );
}
