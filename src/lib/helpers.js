export const pad = (n) => String(n).padStart(2, "0");
export const keyOf = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const TODAY = keyOf(new Date());
export const dayKey = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return keyOf(d); };
export const fmtTime = (ts) => (ts ? new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—");
export const nowTime = () => fmtTime(new Date());
export const dur = (a, b) => {
  if (!a || !b) return "—";
  const m = Math.round((new Date(b) - new Date(a)) / 60000);
  return `${Math.floor(m / 60)}h ${pad(m % 60)}m`;
};
const COLORS = ["#4f46e5", "#db2777", "#0891b2", "#16a34a", "#d97706", "#7c3aed", "#e11d48"];
export const colorFor = (list, id) => COLORS[Math.max(0, list.findIndex((m) => m.id === id)) % COLORS.length];
export const nameOf = (list, id) => list.find((m) => m.id === id)?.full_name || "—";
export const initials = (n) => (n || "?").split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();
export const assigneesOf = (t) => (t.task_assignees || []).map((a) => a.user_id);
export const taskForDate = (task, date) => {
  if (!task.repeat_daily || task.due > date) return task;
  return { ...task, due: date, status: task.status_date === date ? task.status : "To Do" };
};
export const isOverdue = (t) => t.status !== "Done" && t.due < TODAY;
export const genPwd = () => {
  const c = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  const b = crypto.getRandomValues(new Uint32Array(10));
  return Array.from(b, (x) => c[x % c.length]).join("") + "#";
};
export const loginFrom = (name) =>
  name.toLowerCase().replace(/[^a-z\s]/g, "").trim().split(/\s+/).slice(0, 2).join(".");
export const reminderText = (m) =>
  `Hello ${m.full_name}, this is a reminder from Cyber Crime Helpline LLP. Your login ID is ${m.login_id}. Please sign in and change your temporary password as soon as possible. If you did not receive your password, contact the Director.`;
