import { useState } from "react";
import { api } from "../lib/api";
import { TODAY } from "../lib/helpers";

export default function Holidays({ ctx }) {
  const { data, isMgr, run, open } = ctx;
  return (
    <>
      {isMgr && (
        <div className="row" style={{ justifyContent: "flex-end", marginBottom: 14 }}>
          <button className="btn" onClick={() => open(<HolidayForm ctx={ctx} />)}>+ Add holiday</button>
        </div>
      )}
      <div className="card">
        {data.holidays.map((h) => {
          const d = new Date(h.holiday_date + "T00:00:00");
          return (
            <div key={h.id} className="list-item">
              <div className="row" style={{ flexWrap: "nowrap", gap: 14 }}>
                <div className="hol-date"><b>{d.getDate()}</b><span>{d.toLocaleString("en-US", { month: "short" })}</span></div>
                <div><b>{h.name}</b><div className="meta">{d.toLocaleString("en-US", { weekday: "long" })}</div></div>
              </div>
              {isMgr && <button className="btn sm ghost" onClick={() => run(() => api.deleteHoliday(h.id))}>Remove</button>}
            </div>
          );
        })}
        {!data.holidays.length && <div className="empty">No holidays yet</div>}
      </div>
    </>
  );
}

function HolidayForm({ ctx }) {
  const { run, close, toast } = ctx;
  const [name, setName] = useState("");
  const [date, setDate] = useState(TODAY);
  const save = () => {
    if (!name.trim()) return toast("Enter a name");
    run(async () => { await api.addHoliday({ name: name.trim(), holiday_date: date }); close(); }, "Holiday added");
  };
  return (
    <>
      <h2>Add holiday</h2>
      <div className="field"><label>Name</label><input value={name} onChange={(e) => setName(e.target.value)} /></div>
      <div className="field"><label>Date</label><input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
      <div className="actions"><button className="btn ghost" onClick={close}>Cancel</button><button className="btn" onClick={save}>Save</button></div>
    </>
  );
}
