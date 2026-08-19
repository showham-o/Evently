import { useState } from 'react';
import { PackagePlus } from 'lucide-react';
import type { LogisticsItemInput } from '../../utils/logistics';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { LogisticsItemModal, emptyLogisticsForm } from './LogisticsItemModal';
import { LogisticsItemsTable } from './LogisticsItemsTable';

export interface StagedLogisticsItem extends LogisticsItemInput {
  id: string;
}

interface StagedLogisticsPanelProps {
  items: StagedLogisticsItem[];
  onChange: (items: StagedLogisticsItem[]) => void;
}

/**
 * Same add/edit/delete UI as LogisticsPanel, but for an event that doesn't
 * exist in the DB yet - items are held in memory (event_logistics.event_id
 * is a required FK, so nothing can be written until the event is created).
 * The parent (CreateEventPage) persists these items right after the event
 * itself is inserted.
 */
export function StagedLogisticsPanel({ items, onChange }: StagedLogisticsPanelProps) {
  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<StagedLogisticsItem | null>(null);

  function openAddModal() {
    setEditingItem(null);
    setModalOpen(true);
  }

  function handleSubmit(values: LogisticsItemInput) {
    if (editingItem) {
      onChange(items.map((item) => (item.id === editingItem.id ? { ...values, id: editingItem.id } : item)));
    } else {
      onChange([...items, { ...values, id: crypto.randomUUID() }]);
    }
    setModalOpen(false);
  }

  function handleDelete(item: StagedLogisticsItem) {
    onChange(items.filter((i) => i.id !== item.id));
  }

  const currentInitial: LogisticsItemInput = editingItem
    ? {
        item_name: editingItem.item_name,
        supplier_name: editingItem.supplier_name,
        quantity: editingItem.quantity,
        cost: editingItem.cost,
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
      <p className="mb-4 text-sm text-slate-500">הפריטים יישמרו יחד עם יצירת האירוע</p>

      <LogisticsItemsTable
        items={items}
        onEdit={(item) => {
          setEditingItem(item);
          setModalOpen(true);
        }}
        onDelete={handleDelete}
      />

      <LogisticsItemModal
        open={modalOpen}
        initial={currentInitial}
        submitting={false}
        onCancel={() => setModalOpen(false)}
        onSubmit={handleSubmit}
      />
    </Card>
  );
}
