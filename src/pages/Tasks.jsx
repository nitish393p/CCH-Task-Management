import { useState } from "react";
import { api } from "../lib/api";
import { assigneesOf, dayKey, isOverdue, taskForDate, TODAY } from "../lib/helpers";
import { shareByGmail, shareByWhatsApp } from "../lib/sharing";
import { Avatar, Chip } from "../components/parts";

export default function Tasks({ ctx }) {
  const { me, data, isMgr, open, taskFilter, setTaskFilter } = ctx;
  const canCreateTask = isMgr || me.role === "Employee";
  const tasks = data.tasks.map((t) => taskForDate(t, TODAY));
  const list = tasks.filter((task) => {
    const matchesType = taskFilter.type === "All" || task.type === taskFilter.type;
    const matchesStatus = taskFilter.status === "All"
      || (taskFilter.status === "Overdue" ? isOverdue(task) : task.status === taskFilter.status);
    return matchesType && matchesStatus;
  });
  const statusTabs = [["All", "All"], ["To Do", "To Do"], ["Done", "Completed"], ["Overdue", "Overdue"]];
  const typeTabs = ["All", "Individual", "Group"];
  return (
    <>
      <div className="row between task-filters" style={{ marginBottom: 16 }}>
        <div className="task-filter-groups">
          <div className="seg" aria-label="Filter by task status">
            {statusTabs.map(([value, label]) => (
              <button key={value} className={taskFilter.status === value ? "on" : ""} aria-pressed={taskFilter.status === value} onClick={() => setTaskFilter((current) => ({ ...current, status: value }))}>{label}</button>
            ))}
          </div>
          <div className="seg" aria-label="Filter by task type">
            {typeTabs.map((type) => (
              <button key={type} className={taskFilter.type === type ? "on" : ""} aria-pressed={taskFilter.type === type} onClick={() => setTaskFilter((current) => ({ ...current, type }))}>{type === "Individual" ? "👤 Individual" : type === "Group" ? "👥 Group" : type}</button>
            ))}
          </div>
        </div>
        {canCreateTask && <button className="btn" onClick={() => open(<TaskForm ctx={ctx} />)}>{isMgr ? "+ New task" : "+ Add task"}</button>}
      </div>
      {list.length
        ? <div className="cards">{list.map((t) => <TaskCard key={t.id} t={t} ctx={ctx} canEdit={isMgr || assigneesOf(t).includes(me.id)} />)}</div>
        : <div className="card empty">No {taskFilter.status === "All" ? "" : `${taskFilter.status === "Done" ? "completed" : taskFilter.status.toLowerCase()} `}{taskFilter.type === "All" ? "" : `${taskFilter.type.toLowerCase()} `}tasks.</div>}
    </>
  );
}

function TaskCard({ t, ctx, canEdit }) {
  const { data, isMgr, run, open } = ctx;
  const pc = { High: "p-high", Medium: "p-med", Low: "p-low" }[t.priority];
  const sc = { "To Do": "s-todo", "In Progress": "s-prog", Done: "s-done" }[t.status];
  return (
    <div className="card">
      <div className="row between">
        <span className="row" style={{ gap: 6 }}>
          <Chip cls={t.type === "Group" ? "t-grp" : "t-ind"}>{t.type}</Chip>
          {t.repeat_daily && <Chip cls="t-ind">Daily</Chip>}
        </span>
        <Chip cls={pc}>{t.priority}</Chip>
      </div>
      <div className="title" style={{ marginTop: 10, ...(t.status === "Done" ? { textDecoration: "line-through", opacity: 0.6 } : {}) }}>{t.title}</div>
      <div className="row between">
        <div className="avatars">{assigneesOf(t).map((id) => <Avatar key={id} id={id} members={data.profiles} />)}</div>
        <span className={`meta ${isOverdue(t) ? "overdue" : ""}`}>Due {t.due}</span>
      </div>
      <div className="row between" style={{ marginTop: 12 }}>
        <Chip cls={sc}>{t.status}</Chip>
        <span className="row" style={{ gap: 6 }}>
          {canEdit && (
            <select value={t.status} onChange={(e) => run(() => api.setStatus(t.id, e.target.value))}>
              {["To Do", "In Progress", "Done"].map((s) => <option key={s}>{s}</option>)}
            </select>
          )}
          {canEdit && (
            <button className="btn sm ghost" onClick={() => open(<TaskReminder ctx={ctx} task={t} />)}>🔔 Remind</button>
          )}
          {isMgr && (
            <button className="btn sm ghost" onClick={() => { if (window.confirm("Delete this task?")) run(() => api.deleteTask(t.id), "Task deleted"); }}>Delete</button>
          )}
        </span>
      </div>
    </div>
  );
}

function TaskReminder({ ctx, task }) {
  const { data, close, toast } = ctx;
  const assignees = assigneesOf(task).map((id) => data.profiles.find((profile) => profile.id === id)).filter(Boolean);
  const message = `Hello {name},\n\nReminder from Cyber Crime Helpline LLP about your task:\n${task.title}\nDue date: ${task.due}\nPriority: ${task.priority}\nStatus: ${task.status}\n\nPlease update the task in the Task Manager.`;
  const sendEmail = (person) => {
    try { shareByGmail(person.email === "-" ? "" : person.email, `Task reminder: ${task.title}`, message.replace("{name}", person.full_name)); }
    catch (e) { toast(e.message); }
  };
  const sendWhatsApp = (person) => {
    try { shareByWhatsApp(person.phone, message.replace("{name}", person.full_name)); }
    catch (e) { toast(e.message); }
  };
  return (
    <>
      <h2>Remind task assignees</h2>
      <div className="banner">{task.title} · Due {task.due}</div>
      {!assignees.length && <p className="meta">No assigned team members were found for this task.</p>}
      {assignees.map((person) => (
        <div className="list-item" key={person.id}>
          <div><b>{person.full_name}</b><div className="meta">{person.email !== "-" ? person.email : person.phone || "No contact details saved"}</div></div>
          <span className="row" style={{ gap: 6, flexWrap: "nowrap" }}>
            <button className="btn sm ghost" disabled={!person.email || person.email === "-"} onClick={() => sendEmail(person)}>Gmail</button>
            <button className="btn sm ghost" disabled={!person.phone} onClick={() => sendWhatsApp(person)}>WhatsApp</button>
          </span>
        </div>
      ))}
      <p className="meta">This opens your email app or WhatsApp with a draft message. Review and send it there.</p>
      <div className="actions"><button className="btn ghost" onClick={close}>Close</button></div>
    </>
  );
}

function TaskForm({ ctx }) {
  const { me, data, isMgr, run, close, toast } = ctx;
  const [title, setTitle] = useState("");
  const [type, setType] = useState("Individual");
  const [one, setOne] = useState(isMgr ? data.profiles[0]?.id || "" : me.id);
  const [group, setGroup] = useState([]);
  const [priority, setPriority] = useState("Medium");
  const [due, setDue] = useState(dayKey(3));
  const [repeatDaily, setRepeatDaily] = useState(false);
  const toggle = (id) => setGroup((g) => (g.includes(id) ? g.filter((x) => x !== id) : [...g, id]));

  const save = () => {
    const taskType = isMgr ? type : "Individual";
    const ids = isMgr ? (taskType === "Individual" ? [one] : group) : [me.id];
    if (!title.trim()) return toast("Enter a title");
    if (!ids.length) return toast("Select at least one member");
    run(async () => {
      await api.createTask({ title: title.trim(), type: taskType, priority, due, repeat_daily: repeatDaily }, ids);
      close();
    }, "Task created");
  };

  return (
    <>
      <h2>New task</h2>
      <div className="field"><label>Title</label><input value={title} onChange={(e) => setTitle(e.target.value)} /></div>
      {isMgr ? (
        <>
          <div className="field"><label>Type</label>
            <select value={type} onChange={(e) => setType(e.target.value)}><option>Individual</option><option>Group</option></select>
          </div>
          {type === "Individual" ? (
            <div className="field"><label>Assign to</label>
              <select value={one} onChange={(e) => setOne(e.target.value)}>
                {data.profiles.map((m) => <option key={m.id} value={m.id}>{m.full_name}</option>)}
              </select>
            </div>
          ) : (
            <div className="field"><label>Group members</label>
              <div className="checks">
                {data.profiles.map((m) => (
                  <label key={m.id}><input type="checkbox" checked={group.includes(m.id)} onChange={() => toggle(m.id)} /> {m.full_name}</label>
                ))}
              </div>
            </div>
          )}
        </>
      ) : (
        <div className="banner">This personal task will be assigned only to you.</div>
      )}
      <div className="row" style={{ gap: 12 }}>
        <div className="field" style={{ flex: 1 }}><label>Priority</label>
          <select value={priority} onChange={(e) => setPriority(e.target.value)}><option>High</option><option>Medium</option><option>Low</option></select>
        </div>
        <div className="field" style={{ flex: 1 }}><label>Due date</label><input type="date" value={due} onChange={(e) => setDue(e.target.value)} /></div>
      </div>
      <div className="field">
        <div className="checks">
          <label><input type="checkbox" checked={repeatDaily} onChange={(e) => setRepeatDaily(e.target.checked)} /> Repeat every day</label>
        </div>
        {repeatDaily && <span className="meta">This task appears daily starting on its due date. Its status resets each day.</span>}
      </div>
      <div className="actions"><button className="btn ghost" onClick={close}>Cancel</button><button className="btn" onClick={save}>Create task</button></div>
    </>
  );
}
