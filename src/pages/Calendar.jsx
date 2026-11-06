import { useState } from "react";
import { TODAY, keyOf, assigneesOf, nameOf, taskForDate } from "../lib/helpers";
import { Chip } from "../components/parts";

export default function Calendar({ ctx }) {
  const { data } = ctx;
  const now = new Date();
  const [y, setY] = useState(now.getFullYear());
  const [m, setM] = useState(now.getMonth());
  const [sel, setSel] = useState(TODAY);
  const move = (n) => { const d = new Date(y, m + n, 1); setY(d.getFullYear()); setM(d.getMonth()); };
  const first = new Date(y, m, 1).getDay();

  const cells = Array.from({ length: 42 }, (_, i) => {
    const d = new Date(y, m, i - first + 1);
    const k = keyOf(d);
    const hol = data.holidays.find((h) => h.holiday_date === k);
    const due = data.tasks.filter((t) => t.due === k || (t.repeat_daily && t.due < k)).length;
    return (
      <button key={i} className={`day ${d.getMonth() !== m ? "other" : ""} ${k === TODAY ? "today" : ""} ${k === sel ? "sel" : ""}`} onClick={() => setSel(k)}>
        <span className="num">{d.getDate()}</span>
        {hol && <span className="dot h">{hol.name}</span>}
        {due > 0 && <span className="dot t">{due} due</span>}
      </button>
    );
  });

  const hol = data.holidays.find((h) => h.holiday_date === sel);
  const due = data.tasks
    .filter((t) => t.due === sel || (t.repeat_daily && t.due < sel))
    .map((t) => taskForDate(t, sel));
  return (
    <div className="two calendar-layout">
      <div className="card">
        <div className="cal-head">
          <button className="btn sm ghost" onClick={() => move(-1)}>‹ Prev</button>
          <b>{new Date(y, m, 1).toLocaleString("en-US", { month: "long", year: "numeric" })}</b>
          <button className="btn sm ghost" onClick={() => move(1)}>Next ›</button>
        </div>
        <div className="cal">
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => <div key={d} className="dow">{d}</div>)}
          {cells}
        </div>
      </div>
      <div className="card">
        <b>{sel}</b>
        {hol && <div className="banner" style={{ marginTop: 10 }}>🎉 {hol.name}</div>}
        {due.map((t) => (
          <div key={t.id} className="list-item">
            <div><b>{t.title}</b><div className="meta">{assigneesOf(t).map((id) => nameOf(data.profiles, id)).join(", ")}{t.repeat_daily && " · repeats daily"}</div></div>
            <Chip cls="s-prog">{t.status}</Chip>
          </div>
        ))}
        {!due.length && <div className="empty">No tasks due this day</div>}
      </div>
    </div>
  );
}
