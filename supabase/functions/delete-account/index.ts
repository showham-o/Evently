// Deletes an Evently account: the caller's own account (self-service), or -
// when called by a super_admin with { targetUserId } - another user's account
// ("force delete"). This is the ONLY place in the app that touches the
// service-role key; it never leaves this server-side function.
//
// Deploy:
//   supabase functions deploy delete-account
//
// SUPABASE_URL / SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY are injected
// automatically by the Supabase platform - no manual secret configuration
// needed for those three.

import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SOLE_MANAGER_DELETE_BLOCK_ERROR =
  'לא ניתן למחוק את החשבון כיוון שאתה מנהל יחיד באירועים עתידיים. עליך להעביר את הניהול למשתמש אחר או למחוק את האירוע.';

interface Profile {
  id: string;
  auth_user_id: string;
  full_name: string | null;
  email: string;
  phone: string | null;
  age: number | null;
  role: string;
}

interface EventRow {
  id: string;
  event_date: string;
  manager_ids: string[];
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return json({ error: 'Missing Authorization header' }, 401);

    const supabaseCaller = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    const {
      data: { user: callerAuthUser },
      error: callerAuthError,
    } = await supabaseCaller.auth.getUser();

    if (callerAuthError || !callerAuthUser) return json({ error: 'Unauthorized' }, 401);

    const { data: callerProfile } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('auth_user_id', callerAuthUser.id)
      .maybeSingle();

    if (!callerProfile) return json({ error: 'Caller profile not found' }, 404);

    let body: { targetUserId?: string } = {};
    try {
      body = await req.json();
    } catch {
      // no body -> self-service deletion
    }

    const isAdminForced = !!body.targetUserId && body.targetUserId !== callerProfile.id;

    if (isAdminForced && callerProfile.role !== 'super_admin') {
      return json({ error: 'רק מנהל-על יכול למחוק חשבונות של משתמשים אחרים' }, 403);
    }

    let targetProfile: Profile = callerProfile;
    if (isAdminForced) {
      const { data: adminTarget } = await supabaseAdmin
        .from('profiles')
        .select('*')
        .eq('id', body.targetUserId)
        .maybeSingle();

      if (!adminTarget) return json({ error: 'המשתמש לא נמצא' }, 404);
      targetProfile = adminTarget as Profile;
    }

    const { data: managedEventsData, error: managedEventsError } = await supabaseAdmin
      .from('events')
      .select('id, event_date, manager_ids')
      .contains('manager_ids', [targetProfile.id]);

    if (managedEventsError) throw managedEventsError;
    const managedEvents = (managedEventsData ?? []) as EventRow[];

    const now = new Date();

    if (!isAdminForced) {
      // Self-service: block if the target is the sole manager of any event
      // they'd otherwise orphan. The spec calls out future events
      // specifically; a past event left with zero managers would also
      // violate the DB's "at least one manager" constraint and there's no
      // fallback identity to substitute in a self-service context, so the
      // same guard applies to every event, not just future ones.
      const wouldOrphan = managedEvents.some((event) => event.manager_ids.length === 1);

      if (wouldOrphan) {
        return json({ error: SOLE_MANAGER_DELETE_BLOCK_ERROR }, 400);
      }
    }

    // Reassign/clean up manager_ids before touching anything irreversible.
    for (const event of managedEvents) {
      const remaining = event.manager_ids.filter((id) => id !== targetProfile.id);
      const nextManagerIds = remaining.length > 0 ? remaining : [callerProfile.id];

      const { error: updateError } = await supabaseAdmin
        .from('events')
        .update({ manager_ids: nextManagerIds })
        .eq('id', event.id);

      if (updateError) throw updateError;
    }

    // Archive before deleting anything, so the data isn't lost if a later step fails.
    const expiresAt = new Date(now);
    expiresAt.setFullYear(expiresAt.getFullYear() + 1);

    const { error: archiveError } = await supabaseAdmin.from('archived_profiles').insert({
      original_profile_id: targetProfile.id,
      full_name: targetProfile.full_name,
      email: targetProfile.email,
      phone: targetProfile.phone,
      age: targetProfile.age,
      archived_at: now.toISOString(),
      expires_at: expiresAt.toISOString(),
    });

    if (archiveError) throw archiveError;

    const { error: deleteProfileError } = await supabaseAdmin.from('profiles').delete().eq('id', targetProfile.id);
    if (deleteProfileError) throw deleteProfileError;

    const { error: deleteAuthError } = await supabaseAdmin.auth.admin.deleteUser(targetProfile.auth_user_id);
    if (deleteAuthError) throw deleteAuthError;

    return json({ success: true });
  } catch (err) {
    console.error('delete-account failed', err);
    return json({ error: 'מחיקת החשבון נכשלה, נסו שוב מאוחר יותר' }, 500);
  }
});
