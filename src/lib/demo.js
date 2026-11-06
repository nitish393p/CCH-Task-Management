// In-browser backend used when no Supabase URL is configured. Same API as live.js.
import { TODAY, dayKey } from "./helpers";

const PWD = "demo1234";
const ts = (days, h, m) => { const d = new Date(); d.setDate(d.getDate() + days); d.setHours(h, m, 0, 0); return d.toISOString(); };
const db = {
  profiles: [
    { id: "u1", login_id: "director", full_name: "Director Sharma", role: "Director", dept: "Management", phone: "", email: "director@cchl.example", must_reset: false, last_reminder: null, pwd: PWD },
    { id: "u2", login_id: "priya.nair", full_name: "Priya Nair", role: "Manager", dept: "Investigation", phone: "+919800000002", email: "priya@cchl.example", must_reset: false, last_reminder: null, pwd: PWD },
    { id: "u3", login_id: "rahul.verma", full_name: "Rahul Verma", role: "Employee", dept: "Cyber Analysis", phone: "", email: "rahul@cchl.example", must_reset: false, last_reminder: null, pwd: PWD },
    { id: "u4", login_id: "sneha.patil", full_name: "Sneha Patil", role: "Employee", dept: "Helpline Support", phone: "+919800000004", email: "sneha@cchl.example", must_reset: true, last_reminder: null, pwd: PWD },
    { id: "u5", login_id: "arjun.mehta", full_name: "Arjun Mehta", role: "Employee", dept: "Legal Liaison", phone: "", email: "arjun@cchl.example", must_reset: false, last_reminder: null, pwd: PWD },
  ],
  tasks: [
    { id: 1, title: "Review complaint #CC-2041 (UPI fraud)", type: "Individual", priority: "High", status: "In Progress", due: dayKey(1), created_by: "u2", task_assignees: [{ user_id: "u2" }] },
    { id: 2, title: "Trace suspicious phishing domains", type: "Individual", priority: "High", status: "To Do", due: dayKey(-2), created_by: "u2", task_assignees: [{ user_id: "u3" }] },
    { id: 3, title: "Call back 12 pending helpline cases", type: "Individual", priority: "Medium", status: "In Progress", due: TODAY, created_by: "u2", task_assignees: [{ user_id: "u4" }] },
    { id: 4, title: "Quarterly cyber-awareness drive", type: "Group", priority: "Medium", status: "In Progress", due: dayKey(5), created_by: "u2", task_assignees: [{ user_id: "u2" }, { user_id: "u3" }, { user_id: "u4" }] },
    { id: 5, title: "Police referral case file", type: "Group", priority: "High", status: "To Do", due: dayKey(3), created_by: "u2", task_assignees: [{ user_id: "u3" }, { user_id: "u5" }] },
    { id: 6, title: "Monthly awareness webinar slides", type: "Individual", priority: "Low", status: "Done", due: dayKey(-1), created_by: "u2", task_assignees: [{ user_id: "u2" }] },
  ],
  holidays: [
    { id: 1, holiday_date: "2026-01-26", name: "Republic Day" },
    { id: 2, holiday_date: "2026-08-15", name: "Independence Day" },
    { id: 3, holiday_date: "2026-10-02", name: "Gandhi Jayanti" },
    { id: 4, holiday_date: "2026-11-08", name: "Diwali (sample)" },
    { id: 5, holiday_date: "2026-12-25", name: "Christmas" },
  ],
  attendance: [
    { id: 1, user_id: "u2", work_date: dayKey(-1), check_in: ts(-1, 9, 0), check_out: ts(-1, 18, 10), on_leave: false },
    { id: 2, user_id: "u3", work_date: dayKey(-1), check_in: ts(-1, 9, 30), check_out: ts(-1, 17, 45), on_leave: false },
    { id: 3, user_id: "u4", work_date: dayKey(-1), check_in: ts(-1, 9, 15), check_out: ts(-1, 18, 0), on_leave: false },
    { id: 4, user_id: "u5", work_date: dayKey(-1), check_in: ts(-1, 9, 50), check_out: ts(-1, 18, 20), on_leave: false },
    { id: 5, user_id: "u2", work_date: TODAY, check_in: ts(0, 9, 5), check_out: null, on_leave: false },
    { id: 6, user_id: "u3", work_date: TODAY, check_in: ts(0, 9, 40), check_out: null, on_leave: false },
    { id: 7, user_id: "u5", work_date: TODAY, check_in: null, check_out: null, on_leave: true },
  ],
};

const KEY = "cch_demo_session";
let current = (() => { try { return localStorage.getItem(KEY); } catch { return null; } })();
const persist = (v) => { try { v ? localStorage.setItem(KEY, v) : localStorage.removeItem(KEY); } catch {} };
const wait = (v) => new Promise((r) => setTimeout(() => r(v), 150));
const fail = (m) => { throw new Error(m); };
const me = () => db.profiles.find((p) => p.id === current);
const isMgr = (p) => !!p && (p.role === "Director" || p.role === "Manager");
const isDir = (p) => !!p && p.role === "Director";
const need = (ok) => { if (!ok) fail("You do not have permission for this"); };
const strip = ({ pwd, ...rest }) => rest;

export const demo = {
  async hasSession() { return !!me(); },
  async signIn(loginId, password) {
    const p = db.profiles.find((x) => x.login_id === loginId.toLowerCase());
    if (!p || p.pwd !== password) fail("Wrong Login ID or password");
    current = p.id; persist(p.id);
    return wait(true);
  },
  async signOut() { current = null; persist(null); },
  async currentProfile() {
    const p = me();
    if (!p) fail("No profile found. Contact the Director.");
    return { ...strip(p) };
  },
  async setNewPassword(pw) {
    if (pw.length < 8) fail("Use at least 8 characters");
    const p = me(); p.pwd = pw; p.must_reset = false;
  },
  async changeOwnPassword(currentPassword, newPassword) {
    const p = me();
    if (!p || p.pwd !== currentPassword) fail("The current password is incorrect.");
    if (newPassword.length < 8) fail("Use at least 8 characters.");
    p.pwd = newPassword;
    return wait(true);
  },
  async loadAll() {
    const p = me();
    return wait({
      profiles: db.profiles.map(strip),
      tasks: db.tasks.filter((t) => isMgr(p) || t.created_by === p.id || t.task_assignees.some((a) => a.user_id === p.id)).map((t) => ({ ...t })),
      holidays: db.holidays.map((h) => ({ ...h })),
      attendance: db.attendance.filter((a) => isMgr(p) || a.user_id === p.id).map((a) => ({ ...a })),
    });
  },
  async createTask(task, assignees) {
    const p = me();
    const manager = isMgr(p);
    need(manager || p?.role === "Employee");
    const taskType = manager ? task.type : "Individual";
    const taskAssignees = manager ? assignees : [p.id];
    db.tasks.push({ id: Date.now(), ...task, type: taskType, status: "To Do", created_by: p.id, task_assignees: taskAssignees.map((u) => ({ user_id: u })) });
    return wait(true);
  },
  async setStatus(id, s) {
    const p = me(); const t = db.tasks.find((x) => x.id === id);
    need(t && (isMgr(p) || t.task_assignees.some((a) => a.user_id === p.id)));
    t.status = s;
    if (t.repeat_daily) t.status_date = TODAY;
    return wait(true);
  },
  async deleteTask(id) {
    need(isMgr(me()));
    db.tasks = db.tasks.filter((t) => t.id !== id); return wait(true);
  },
  async clockIn() {
    const p = me();
    if (db.attendance.some((a) => a.user_id === p.id && a.work_date === TODAY)) fail("You already clocked in today");
    db.attendance.push({ id: Date.now(), user_id: p.id, work_date: TODAY, check_in: new Date().toISOString(), check_out: null, on_leave: false });
    return wait(true);
  },
  async clockOut() {
    const p = me(); const r = db.attendance.find((a) => a.user_id === p.id && a.work_date === TODAY);
    if (!r || !r.check_in) fail("Clock in first");
    r.check_out = new Date().toISOString(); return wait(true);
  },
  async setAttendanceTimes(uid, date, times) {
    need(isMgr(me()));
    let record = db.attendance.find((attendance) => attendance.user_id === uid && attendance.work_date === date);
    if (record) {
      record.check_in = times.check_in;
      record.check_out = times.check_out;
    } else {
      record = {
        id: Date.now(),
        user_id: uid,
        work_date: date,
        check_in: times.check_in,
        check_out: times.check_out,
        on_leave: false,
      };
      db.attendance.push(record);
    }
    return wait(true);
  },
  async markLeave(uid, date) {
    need(isMgr(me()));
    const r = db.attendance.find((a) => a.user_id === uid && a.work_date === date);
    if (r) r.on_leave = !r.on_leave;
    else db.attendance.push({ id: Date.now(), user_id: uid, work_date: date, check_in: null, check_out: null, on_leave: true });
    return wait(true);
  },
  async addHoliday(h) {
    need(isMgr(me()));
    db.holidays.push({ id: Date.now(), ...h }); return wait(true);
  },
  async deleteHoliday(id) {
    need(isMgr(me()));
    db.holidays = db.holidays.filter((h) => h.id !== id); return wait(true);
  },
  async createUser(body) {
    need(isDir(me()));
    const login = String(body.login_id || "").trim().toLowerCase();
    const isEmailLogin = login.includes("@");
    if (isEmailLogin ? !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(login) : !/^[a-z0-9._-]{3,}$/.test(login)) {
      fail("Enter a valid email address or a Login ID with 3+ letters, numbers, dots, dashes or underscores");
    }
    if (!body.full_name) fail("Full name is required");
    if (!body.password || body.password.length < 8) fail("Password must be at least 8 characters");
    if (db.profiles.some((p) => p.login_id === login)) fail("This Login ID is already taken");
    db.profiles.push({ id: "u" + Date.now(), login_id: login, full_name: body.full_name, role: body.role, dept: body.dept || "-", phone: body.phone || "", email: body.email || "-", must_reset: true, last_reminder: null, pwd: body.password });
    return wait({ ok: true });
  },
  async updateUser(id, updates) {
    need(isDir(me()));
    const profile = db.profiles.find((p) => p.id === id);
    if (!profile || profile.role === "Director" || profile.id === me().id) fail("This team member cannot be edited.");
    Object.assign(profile, updates);
    return wait({ ok: true });
  },
  async updateDirectorLogin(email) {
    const director = me();
    need(isDir(director));
    const login = String(email || "").trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(login)) fail("Enter a valid email address.");
    if (db.profiles.some((profile) => profile.id !== director.id && profile.login_id === login)) {
      fail("This Login ID is already in use.");
    }
    director.login_id = login;
    director.email = login;
    return wait({ ok: true });
  },
  async deleteUser(id) {
    need(isDir(me()));
    const profile = db.profiles.find((p) => p.id === id);
    if (!profile || profile.role === "Director" || profile.id === me().id) fail("This account cannot be deleted.");
    db.profiles = db.profiles.filter((p) => p.id !== id);
    db.attendance = db.attendance.filter((a) => a.user_id !== id);
    const director = db.profiles.find((p) => p.role === "Director");
    db.tasks = db.tasks.map((task) => ({
      ...task,
      created_by: task.created_by === id ? null : task.created_by,
      task_assignees: task.task_assignees.some((a) => a.user_id !== id) && task.task_assignees.length === 1
        ? [{ user_id: director.id }]
        : task.task_assignees.filter((a) => a.user_id !== id),
    }));
    return wait({ ok: true });
  },
  async resetPassword(uid, password) {
    need(isDir(me()));
    if (!password || password.length < 8) fail("Password must be at least 8 characters");
    const p = db.profiles.find((x) => x.id === uid); p.pwd = password; p.must_reset = true;
    return wait({ ok: true });
  },
  async markReminded(uid) {
    need(isDir(me()));
    db.profiles.find((x) => x.id === uid).last_reminder = TODAY;
    return wait(true);
  },
};
