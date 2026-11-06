// Supabase backend. Used when VITE_SUPABASE_URL is set.
import { supabase as sb } from "./supabase";
import { CONFIG } from "./config";
import { dayKey, TODAY } from "./helpers";

const DOMAIN = "users.cchl.local";
const check = (error) => { if (error) throw new Error(error.message); };
const checkTaskSchema = (error) => {
  if (!error) return;
  if (
    ["PGRST202", "PGRST204"].includes(error.code) &&
    /repeat_daily|set_task_status/i.test(error.message)
  ) {
    throw new Error("The Supabase database is missing the daily-task schema update. Run the latest supabase/schema.sql in the Supabase SQL Editor. If you already ran it, run NOTIFY pgrst, 'reload schema'; then reload the app.");
  }
  check(error);
};
const myId = async () => (await sb.auth.getUser()).data.user.id;
const authEmailFor = (loginId) => {
  const normalized = loginId.trim().toLowerCase();
  return normalized.includes("@") ? normalized : `${normalized}@${DOMAIN}`;
};

async function callFn(body) {
  const { data: { session }, error: sessionError } = await sb.auth.getSession();
  check(sessionError);
  if (!session) throw new Error("Your session expired. Sign out and sign in again.");

  const { data, error } = await sb.functions.invoke("create-user", { body });
  if (error) {
    const response = error.context;
    if (response instanceof Response) {
      const result = await response.clone().json().catch(() => ({}));
      if (
        body.action === "update-profile" &&
        result.error?.includes("Enter a valid email address or a Login ID")
      ) {
        throw new Error("The deployed create-user Edge Function is outdated and does not support editing team members. Deploy the latest supabase/functions/create-user function, then try saving again.");
      }
      if (result.error) throw new Error(result.error);
      if (response.status === 404) {
        throw new Error("The create-user Edge Function is not deployed. Deploy the latest supabase/functions/create-user function to this Supabase project.");
      }
      if (response.status === 401) throw new Error("Your session expired. Sign out and sign in again.");
      if (response.status === 403) throw new Error("Only a Director can create users. Check that your profile role is Director.");
      throw new Error(`Create-user request failed (${response.status}). Check the Supabase Edge Function logs.`);
    }
    if (error.name === "FunctionsFetchError") {
      throw new Error("Could not reach the create-user Edge Function. Check the Supabase project URL and internet connection.");
    }
    throw new Error(error.message || "Could not create user");
  }
  if (!data?.ok) throw new Error("The create-user function returned an unexpected response.");
  return data;
}

export const live = {
  async hasSession() { const { data: { session } } = await sb.auth.getSession(); return !!session; },
  async signIn(loginId, password) {
    const { error } = await sb.auth.signInWithPassword({ email: authEmailFor(loginId), password });
    if (error) {
      if (error.code === "invalid_credentials" || error.message === "Invalid login credentials") {
        throw new Error("Wrong Login ID or password");
      }
      throw new Error(error.message);
    }
  },
  async changeOwnPassword(currentPassword, newPassword) {
    const { data: { user }, error: userError } = await sb.auth.getUser();
    check(userError);
    if (!user?.email) throw new Error("Could not verify the signed-in account email. Sign out and sign in again.");

    const { error: verifyError } = await sb.auth.signInWithPassword({
      email: user.email,
      password: currentPassword,
    });
    if (verifyError) {
      if (verifyError.code === "invalid_credentials" || verifyError.message === "Invalid login credentials") {
        throw new Error("The current password is incorrect.");
      }
      throw new Error(verifyError.message);
    }

    const { error } = await sb.auth.updateUser({ password: newPassword });
    if (error?.status === 422) {
      throw new Error(`Supabase rejected the new password: ${error.message}. Choose a unique password that meets the Authentication password requirements.`);
    }
    check(error);
  },
  async signOut() { await sb.auth.signOut(); },
  async currentProfile() {
    const { data, error } = await sb.from("profiles").select("*").eq("id", await myId()).single();
    if (error || !data) { await sb.auth.signOut(); throw new Error("No profile found. Contact the Director."); }
    return data;
  },
  async setNewPassword(pw) {
    const userId = await myId();
    const pendingKey = `cchl-password-change-pending:${userId}`;
    const passwordAlreadyUpdated = sessionStorage.getItem(pendingKey) === "true";
    if (!passwordAlreadyUpdated) {
      const { error } = await sb.auth.updateUser({ password: pw });
      if (error) {
        if (error.status === 422) {
          throw new Error(`Supabase rejected the new password: ${error.message}. Choose a unique password that meets the requirements in Supabase Authentication settings.`);
        }
        check(error);
      }
      sessionStorage.setItem(pendingKey, "true");
    }

    const { error } = await sb.rpc("finish_password_change");
    if (error) {
      if (["PGRST202", "PGRST203", "42883"].includes(error.code)) {
        throw new Error(`Your password was changed, but Supabase could not finish account setup because finish_password_change is missing or outdated (${error.message}). Run the latest supabase/schema.sql in the SQL Editor, then click Save and continue again.`);
      }
      throw new Error(`Your password was changed, but Supabase could not finish account setup: ${error.message}. Correct the database error, then click Save and continue again.`);
    }
    sessionStorage.removeItem(pendingKey);
  },
  async loadAll() {
    const [p, t, h, a] = await Promise.all([
      sb.from("profiles").select("*").order("full_name"),
      sb.from("tasks").select("*, task_assignees(user_id)").order("due"),
      sb.from("holidays").select("*").order("holiday_date"),
      sb.from("attendance").select("*").gte("work_date", dayKey(-60)),
    ]);
    [p, t, h, a].forEach((x) => check(x.error));
    return { profiles: p.data, tasks: t.data, holidays: h.data, attendance: a.data };
  },
  async createTask(task, assignees) {
    const { data, error } = await sb.from("tasks").insert({ ...task, created_by: await myId() }).select().single();
    checkTaskSchema(error);
    check((await sb.from("task_assignees").insert(assignees.map((u) => ({ task_id: data.id, user_id: u })))).error);
  },
  async setStatus(id, s) { checkTaskSchema((await sb.rpc("set_task_status", { tid: id, s, task_day: TODAY })).error); },
  async deleteTask(id) { check((await sb.from("tasks").delete().eq("id", id)).error); },
  async clockIn() {
    check((await sb.from("attendance").insert({ user_id: await myId(), work_date: TODAY, check_in: new Date().toISOString() })).error);
  },
  async clockOut() {
    check((await sb.from("attendance").update({ check_out: new Date().toISOString() }).eq("user_id", await myId()).eq("work_date", TODAY)).error);
  },
  async setAttendanceTimes(uid, date, times) {
    const { error } = await sb.from("attendance").upsert({
      user_id: uid,
      work_date: date,
      check_in: times.check_in,
      check_out: times.check_out,
    }, { onConflict: "user_id,work_date" });
    check(error);
  },
  async markLeave(uid, date) {
    const { data } = await sb.from("attendance").select("*").eq("user_id", uid).eq("work_date", date).maybeSingle();
    const res = data
      ? await sb.from("attendance").update({ on_leave: !data.on_leave }).eq("id", data.id)
      : await sb.from("attendance").insert({ user_id: uid, work_date: date, on_leave: true });
    check(res.error);
  },
  async addHoliday(h) { check((await sb.from("holidays").insert(h)).error); },
  async deleteHoliday(id) { check((await sb.from("holidays").delete().eq("id", id)).error); },
  createUser(body) { return callFn(body); },
  updateUser(id, profile) { return callFn({ action: "update-profile", user_id: id, ...profile }); },
  updateDirectorLogin(email) { return callFn({ action: "update-director-login", email }); },
  deleteUser(id) { return callFn({ action: "delete-user", user_id: id }); },
  resetPassword(uid, password) { return callFn({ action: "reset", user_id: uid, password }); },
  async markReminded(uid) { check((await sb.from("profiles").update({ last_reminder: TODAY }).eq("id", uid)).error); },
};
