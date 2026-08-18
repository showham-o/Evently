-- Evently: lock down event_logistics to the event's own managers/super_admin.
-- The original schema left this table world-readable/writable
-- ("FOR ALL ... USING (true)" for anon+authenticated) since nothing used it
-- yet - now that the app writes supplier/cost data here, that's too broad
-- for what should be manager-only business data.
-- Run once in the Supabase SQL editor, after the previous migrations.

DROP POLICY IF EXISTS "Public logistics all" ON public.event_logistics;

CREATE POLICY "event_logistics_managers_all"
  ON public.event_logistics FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      JOIN public.events e ON e.id = event_logistics.event_id
      WHERE p.auth_user_id = auth.uid() AND (p.role = 'super_admin' OR p.id = ANY (e.manager_ids))
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      JOIN public.events e ON e.id = event_logistics.event_id
      WHERE p.auth_user_id = auth.uid() AND (p.role = 'super_admin' OR p.id = ANY (e.manager_ids))
    )
  );
