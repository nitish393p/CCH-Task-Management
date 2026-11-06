import { useState } from "react";
import { api } from "../lib/api";
import { TODAY, fmtTime, dur } from "../lib/helpers";
import { Avatar } from "../components/parts";

function statusOf(r) {
  if (!r) return { label: "Not in", cls: "st-none" };
  if (r.on_leave) return { label: "On leave", cls: "st-leave" };
  if (r.check_in && !r.check_out) return { label: "Working", cls: "st-work" };
  if (r.check_out) return { label: "Left office", cls: "st-in" };
  return { label: "Not in", cls: "st-none" };
}

export default function Attendance({ ctx }) {
  const { me, data, isMgr, run, open } = ctx;
  const [date, setDate] = useState(TODAY);
  const people = isMgr ? data.profiles : data.profiles.filter((p) => p.id === me.id);
  const rows = data.attendance.filter((a) => a.work_date === date);
  return (
    <div className="card">
      <div className="row between" style={{ marginBottom: 12 }}>
        <b>{isMgr ? "Team attendance" : "My attendance"}</b>
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
      </div>
      <div className="table-wrap">
        <table>
          <thead><tr><th>Name</th><th>Status</th><th>In</th><th>Out</th><th>Hours</th>{isMgr && <th></th>}</tr></thead>
          <tbody>
            {people.map((p) => {
              const r = rows.find((x) => x.user_id === p.id);
              const st = statusOf(r);
              return (
                <tr key={p.id}>
                  <td><div className="row" style={{ flexWrap: "nowrap" }}><Avatar id={p.id} members={data.profiles} /><div><b>{p.full_name}</b><div className="meta">{p.dept}</div></div></div></td>
                  <td><span className={st.cls}>{st.label}</span></td>
                  <td>{fmtTime(r?.check_in)}</td>
                  <td>{fmtTime(r?.check_out)}</td>
                  <td>{dur(r?.check_in, r?.check_out)}</td>
                  {isMgr && (
                    <td>
                      <div className="attendance-actions">
                        <button className="btn sm ghost" onClick={() => open(<EditAttendanceTimes ctx={ctx} person={p} date={date} record={r} />)}>Edit times</button>
                        <button className="btn sm ghost" onClick={() => run(() => api.markLeave(p.id, date))}>{r?.on_leave ? "Remove leave" : "Mark leave"}</button>
                      </div>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const localDateTimeValue = (value) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
};

function EditAttendanceTimes({ ctx, person, date, record }) {
  const { close, reload, toast } = ctx;
  const [checkIn, setCheckIn] = useState(localDateTimeValue(record?.check_in));
  const [checkOut, setCheckOut] = useState(localDateTimeValue(record?.check_out));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const save = async () => {
    setError("");
    if (!record && !checkIn && !checkOut) return setError("Enter a check-in or check-out time.");
    if (checkOut && !checkIn) return setError("Enter a check-in time before setting a check-out time.");

    const checkInDate = checkIn ? new Date(checkIn) : null;
    const checkOutDate = checkOut ? new Date(checkOut) : null;
    if ((checkInDate && Number.isNaN(checkInDate.getTime())) || (checkOutDate && Number.isNaN(checkOutDate.getTime()))) {
      return setError("Enter valid check-in and check-out times.");
    }
    if (checkIn && checkIn.slice(0, 10) !== date) {
      return setError("Check-in must be on the selected work date.");
    }
    if (checkInDate && checkOutDate && checkOutDate < checkInDate) {
      return setError("Check-out must be at or after check-in.");
    }

    setBusy(true);
    try {
      await api.setAttendanceTimes(person.id, date, {
        check_in: checkInDate?.toISOString() || null,
        check_out: checkOutDate?.toISOString() || null,
      });
      await reload();
      toast("Attendance times updated");
      close();
    } catch (e) {
      setError(e.message || "Could not update attendance times.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <h2>Edit attendance times</h2>
      <div className="banner">{person.full_name} · Work date {date}</div>
      <div className="field">
        <label>Check-in time</label>
        <input type="datetime-local" value={checkIn} onChange={(e) => setCheckIn(e.target.value)} />
      </div>
      <div className="field">
        <label>Check-out time</label>
        <input type="datetime-local" value={checkOut} onChange={(e) => setCheckOut(e.target.value)} />
      </div>
      {error && <div className="err" role="alert">{error}</div>}
      <div className="actions">
        <button className="btn ghost" onClick={close} disabled={busy}>Cancel</button>
        <button className="btn" onClick={save} disabled={busy}>{busy ? "Saving…" : "Save times"}</button>
      </div>
    </>
  );
}
