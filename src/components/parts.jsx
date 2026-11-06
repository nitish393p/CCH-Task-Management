import { assigneesOf, colorFor, initials, isOverdue, nameOf } from "../lib/helpers";

export function Stat({ n, l, c = "", onClick, active = false }) {
  const content = <><div className="num" style={{ color: c }}>{n}</div><div className="meta">{l}</div></>;
  if (onClick) {
    return <button type="button" className={`card stat stat-button${active ? " active" : ""}`} onClick={onClick} aria-pressed={active}>{content}</button>;
  }
  return <div className="card stat">{content}</div>;
}
export function Chip({ cls = "", children }) {
  return <span className={`chip ${cls}`}>{children}</span>;
}
export function Avatar({ id, members, big }) {
  const name = nameOf(members, id);
  return (<span className={`avatar ${big ? "big" : ""}`} style={{ background: colorFor(members, id) }} title={name}>{initials(name)}</span>);
}
export function TaskList({ tasks, members }) {
  if (!tasks.length) return <div className="empty">No tasks yet</div>;
  return tasks.map((t) => (
    <div key={t.id} className="list-item">
      <div><b>{t.title}</b><div className="meta">{t.type}{t.repeat_daily ? " · repeats daily" : ""} · {assigneesOf(t).map((id) => nameOf(members, id)).join(", ")} · due {t.due}</div></div>
      <Chip cls={isOverdue(t) ? "p-high" : "s-prog"}>{isOverdue(t) ? "Overdue" : t.status}</Chip>
    </div>
  ));
}
