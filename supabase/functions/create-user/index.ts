// Edge Function: Director creates users and resets passwords.
// Uses the service role key on the server only, so it never reaches the browser.
import { createClient } from "npm:@supabase/supabase-js@2";

const DOMAIN = "users.cchl.local";
const authEmailFor = (loginId: string) =>
  loginId.includes("@") ? loginId : `${loginId}@${DOMAIN}`;
const isEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const anon = Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_PUBLISHABLE_KEY");
    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || Deno.env.get("SUPABASE_SECRET_KEY");
    if (!url || !anon || !service) {
      return json({ error: "Supabase function secrets are missing. Check the function environment configuration." }, 500);
    }
    const token = (req.headers.get("Authorization") || "").replace("Bearer ", "");
    if (!token) return json({ error: "Please sign in again" }, 401);

    const { data: { user }, error: authError } = await createClient(url, anon).auth.getUser(token);
    if (authError) return json({ error: "Your session is invalid or expired. Sign in again." }, 401);
    if (!user) return json({ error: "Please sign in again" }, 401);

    const admin = createClient(url, service, { auth: { persistSession: false } });
    const { data: me, error: profileError } = await admin.from("profiles").select("role").eq("id", user.id).single();
    if (profileError || me?.role !== "Director") {
      return json({ error: "Only a Director profile can create users. Confirm the signed-in account has role 'Director' in public.profiles." }, 403);
    }

    const body = await req.json();

    if (body.action === "update-director-login") {
      const email = String(body.email || "").trim().toLowerCase();
      if (!isEmail(email)) return json({ error: "Enter a valid email address." }, 400);

      const { data: existingProfile, error: existingProfileError } = await admin
        .from("profiles").select("id").eq("login_id", email).maybeSingle();
      if (existingProfileError) return json({ error: existingProfileError.message }, 500);
      if (existingProfile && existingProfile.id !== user.id) {
        return json({ error: "This Login ID is already in use." }, 409);
      }

      const { error: authUpdateError } = await admin.auth.admin.updateUserById(user.id, {
        email,
        email_confirm: true,
      });
      if (authUpdateError) return json({ error: authUpdateError.message }, 400);

      const { error: profileUpdateError } = await admin
        .from("profiles")
        .update({ login_id: email, email })
        .eq("id", user.id)
        .eq("role", "Director");
      if (profileUpdateError) {
        const { error: rollbackError } = await admin.auth.admin.updateUserById(user.id, {
          email: user.email,
          email_confirm: true,
        });
        if (rollbackError) {
          return json({ error: `Login ID update failed (${profileUpdateError.message}), and restoring the previous Auth email failed (${rollbackError.message}). Contact Supabase support before changing this account again.` }, 500);
        }
        return json({ error: `Could not update the Director profile Login ID: ${profileUpdateError.message}. The previous Auth email was restored.` }, 500);
      }
      return json({ ok: true, login_id: email });
    }

    if (body.action === "update-profile") {
      if (!body.user_id || body.user_id === user.id) {
        return json({ error: "You cannot edit your own profile from this screen." }, 400);
      }
      if (!String(body.full_name || "").trim()) return json({ error: "Full name is required" }, 400);
      if (!["Manager", "Employee"].includes(body.role)) return json({ error: "Only team member roles can be assigned here." }, 400);

      const { data: target, error: targetError } = await admin.from("profiles").select("id, role").eq("id", body.user_id).single();
      if (targetError || !target || target.role === "Director") {
        return json({ error: "Director accounts cannot be edited from Team Management." }, 400);
      }

      const { error } = await admin.from("profiles").update({
        full_name: String(body.full_name).trim(),
        role: body.role,
        dept: String(body.dept || "").trim() || "-",
        phone: String(body.phone || "").trim(),
        email: String(body.email || "").trim() || "-",
      }).eq("id", body.user_id);
      if (error) return json({ error: error.message }, 400);
      return json({ ok: true });
    }

    if (body.action === "delete-user") {
      if (!body.user_id || body.user_id === user.id) {
        return json({ error: "You cannot delete your own account." }, 400);
      }
      const { data: target, error: targetError } = await admin.from("profiles").select("id, role").eq("id", body.user_id).single();
      if (targetError || !target || target.role === "Director") {
        return json({ error: "Director accounts cannot be deleted from Team Management." }, 400);
      }

      const { data: assignments, error: assignmentsError } = await admin
        .from("task_assignees").select("task_id").eq("user_id", body.user_id);
      if (assignmentsError) return json({ error: assignmentsError.message }, 500);
      const taskIds = [...new Set((assignments || []).map((assignment) => assignment.task_id))];
      let soleTaskIds: number[] = [];
      if (taskIds.length) {
        const { data: taskAssignments, error: taskAssignmentsError } = await admin
          .from("task_assignees").select("task_id, user_id").in("task_id", taskIds);
        if (taskAssignmentsError) return json({ error: taskAssignmentsError.message }, 500);
        const assignmentCounts = new Map<number, number>();
        for (const assignment of taskAssignments || []) {
          assignmentCounts.set(assignment.task_id, (assignmentCounts.get(assignment.task_id) || 0) + 1);
        }
        soleTaskIds = taskIds.filter((taskId) => assignmentCounts.get(taskId) === 1);
      }

      let directorId: string | null = null;
      if (soleTaskIds.length) {
        const { data: director, error: directorError } = await admin
          .from("profiles").select("id").eq("role", "Director").neq("id", user.id).limit(1).maybeSingle();
        if (directorError || !director) {
          return json({ error: "Cannot delete this member: they are the only assignee on tasks, and no other Director is available to receive those tasks." }, 400);
        }
        directorId = director.id;
        const { error: transferError } = await admin
          .from("task_assignees").update({ user_id: directorId }).eq("user_id", body.user_id).in("task_id", soleTaskIds);
        if (transferError) return json({ error: `Could not transfer the member's tasks to the Director: ${transferError.message}` }, 500);
      }

      const { error } = await admin.auth.admin.deleteUser(body.user_id);
      if (error) {
        if (directorId && soleTaskIds.length) {
          const { error: restoreError } = await admin
            .from("task_assignees").update({ user_id: body.user_id }).eq("user_id", directorId).in("task_id", soleTaskIds);
          if (restoreError) {
            return json({ error: `Account deletion failed: ${error.message}. Task assignments could not be restored: ${restoreError.message}` }, 500);
          }
        }
        return json({ error: error.message }, 400);
      }
      return json({ ok: true });
    }

    if (body.action === "reset") {
      if (!body.password || String(body.password).length < 8) return json({ error: "Password must be at least 8 characters" }, 400);
      const { error } = await admin.auth.admin.updateUserById(body.user_id, { password: body.password });
      if (error) return json({ error: error.message }, 400);
      const { error: updateError } = await admin.from("profiles").update({ must_reset: true }).eq("id", body.user_id);
      if (updateError) return json({ error: `Password reset, but profile update failed: ${updateError.message}` }, 500);
      return json({ ok: true });
    }

    const login = String(body.login_id || "").trim().toLowerCase();
    if (login.includes("@") ? !isEmail(login) : !/^[a-z0-9._-]{3,}$/.test(login)) {
      return json({ error: "Enter a valid email address or a Login ID with 3+ letters, numbers, dots, dashes or underscores" }, 400);
    }
    if (!String(body.full_name || "").trim()) return json({ error: "Full name is required" }, 400);
    if (!["Director", "Manager", "Employee"].includes(body.role)) return json({ error: "Invalid role" }, 400);
    if (!body.password || String(body.password).length < 8) return json({ error: "Password must be at least 8 characters" }, 400);

    const { data, error } = await admin.auth.admin.createUser({
      email: authEmailFor(login),
      password: body.password,
      email_confirm: true,
    });
    if (error) return json({ error: error.message.includes("already") ? "This Login ID is already taken" : error.message }, 400);

    const { error: pErr } = await admin.from("profiles").insert({
      id: data.user.id,
      login_id: login,
      full_name: String(body.full_name).trim(),
      role: body.role,
      dept: String(body.dept || "").trim() || "-",
      phone: String(body.phone || "").trim(),
      email: String(body.email || "").trim() || (login.includes("@") ? login : "-"),
      must_reset: true,
    });
    if (pErr) {
      const { error: rollbackError } = await admin.auth.admin.deleteUser(data.user.id);
      if (rollbackError) {
        return json({ error: `Profile creation failed: ${pErr.message}. The Auth user could not be rolled back (${rollbackError.message}); remove it from Authentication > Users before retrying.` }, 500);
      }
      return json({ error: pErr.message.includes("duplicate") ? "This Login ID is already taken" : pErr.message }, 400);
    }
    return json({ ok: true, id: data.user.id });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
