import { supabase } from '../lib/supabase/client';
import type { EventLogisticsItem, LogisticsStatus } from '../lib/supabase/types';

export async function getLogisticsItems(eventId: string): Promise<EventLogisticsItem[]> {
  const { data, error } = await supabase
    .from('event_logistics')
    .select('*')
    .eq('event_id', eventId)
    .order('created_at', { ascending: true });

  if (error) throw error;
  return (data ?? []) as EventLogisticsItem[];
}

export interface LogisticsItemInput {
  item_name: string;
  supplier_name: string;
  quantity: number;
  cost: number;
  status: LogisticsStatus;
}

export async function addLogisticsItem(eventId: string, input: LogisticsItemInput): Promise<EventLogisticsItem> {
  const { data, error } = await supabase
    .from('event_logistics')
    .insert({
      event_id: eventId,
      item_name: input.item_name,
      supplier_name: input.supplier_name || null,
      quantity: input.quantity,
      cost: input.cost,
      status: input.status,
    })
    .select()
    .single();

  if (error) throw error;
  return data as EventLogisticsItem;
}

export async function updateLogisticsItem(id: string, input: LogisticsItemInput): Promise<EventLogisticsItem> {
  const { data, error } = await supabase
    .from('event_logistics')
    .update({
      item_name: input.item_name,
      supplier_name: input.supplier_name || null,
      quantity: input.quantity,
      cost: input.cost,
      status: input.status,
    })
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data as EventLogisticsItem;
}

export async function deleteLogisticsItem(id: string): Promise<void> {
  const { error } = await supabase.from('event_logistics').delete().eq('id', id);
  if (error) throw error;
}
