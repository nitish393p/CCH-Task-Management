import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { TODAY, fmtTime, nowTime, isOverdue, taskForDate } from "../lib/helpers";
import { Stat, TaskList } from "../components/parts";

export default function Dashboard({ ctx }) {
  const { me, data, isMgr, run, showTasks, taskFilter } = ctx;
  const [now, setNow] = useState(nowTime());
  useEffect(() => { const t = setInterval(() => setNow(nowTime()), 30000); return () => clearInterval(t); }, []);

  const tasks = data.tasks.map((task) => taskForDate(task, TODAY)).sort((a, b) => a.due.localeCompare(b.due));
  const repeatedToday = tasks.filter((task) => task.repeat_daily && task.due === TODAY);
  const recentTasks = [
    ...repeatedToday,
    ...tasks.filter((task) => !repeatedToday.includes(task)).slice(0, Math.max(0, 6 - repeatedToday.length)),
  ];
  const mine = data.attendance.find((a) => a.user_id === me.id && a.work_date === TODAY);
  const present = data.attendance.filter((a) => a.work_date === TODAY && a.check_in).length;
  const upcoming = data.holidays.filter((h) => h.holiday_date >= TODAY).slice(0, 3);
  const done = tasks.filter((t) => t.status === "Done").length;
  const over = tasks.filter(isOverdue).length;
  const todo = tasks.filter((t) => t.status === "To Do").length;

  let msg = "You have not clocked in yet";
  if (mine?.on_leave) msg = "You are on leave today";
  else if (mine?.check_in) msg = `In at ${fmtTime(mine.check_in)} ${mine.check_out ? "· Out at " + fmtTime(mine.check_out) : "· Working"}`;

  let action = null;
  if (!mine?.on_leave) {
    if (!mine?.check_in) action = <button className="btn ok" onClick={() => run(() => api.clockIn(), "Clocked in")}>Clock In</button>;
    else if (!mine.check_out) action = <button className="btn bad" onClick={() => run(() => api.clockOut(), "Clocked out")}>Clock Out</button>;
    else action = <button className="btn ghost" disabled>Done for today</button>;
  }

  return (
    <>
      <div className="card hero">
        <div className="row between">
          <div>
            <div className="meta">Your office time · {TODAY}</div>
            <div className="clock">{now}</div>
            <div className="meta">{msg}</div>
          </div>
          <div>{action}</div>
        </div>
      </div>
      <div className="grid4">
        <Stat n={tasks.length} l="Tasks" onClick={() => showTasks("All")} active={taskFilter.status === "All"} />
        <Stat n={done} l="Completed" c="var(--ok)" onClick={() => showTasks("Done")} active={taskFilter.status === "Done"} />
        <Stat n={over} l="Overdue" c="var(--bad)" onClick={() => showTasks("Overdue")} active={taskFilter.status === "Overdue"} />
        <Stat n={todo} l="To Do" onClick={() => showTasks("To Do")} active={taskFilter.status === "To Do"} />
        {isMgr ? <Stat n={`${present}/${data.profiles.length}`} l="Present today" /> : <Stat n={upcoming.length} l="Upcoming holidays" />}
      </div>
      <div className="two">
        <div className="card">
          <div className="row between"><b>Recent tasks</b><button className="btn sm ghost" onClick={() => showTasks("All")}>View all</button></div>
          <TaskList tasks={recentTasks} members={data.profiles} />
        </div>
        <div className="card">
          <b>Upcoming holidays</b>
          {upcoming.map((h) => (
            <div key={h.id} className="list-item"><div><b>{h.name}</b><div className="meta">{h.holiday_date}</div></div></div>
          ))}
          {!upcoming.length && <div className="empty">None</div>}
        </div>
      </div>
    </>
  );
}
