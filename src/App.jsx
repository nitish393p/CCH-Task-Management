import { useCallback, useEffect, useState } from "react";
import { api } from "./lib/api";
import { CONFIG_ERROR, DEMO } from "./lib/config";
import Login from "./components/Login";
import ForcePassword from "./components/ForcePassword";
import Modal from "./components/Modal";
import Dashboard from "./pages/Dashboard";
import Tasks from "./pages/Tasks";
import Attendance from "./pages/Attendance";
import Calendar from "./pages/Calendar";
import Holidays from "./pages/Holidays";
import Team from "./pages/Team";

const SECTIONS = [
  ["dashboard", "📊", "Dashboard", "Your overview for today"],
  ["tasks", "✅", "Tasks", "Individual and group work"],
  ["attendance", "🕘", "Attendance", "Daily office in and out time"],
  ["calendar", "📅", "Calendar", "Holidays and task deadlines"],
  ["holidays", "🎉", "Holidays", "Company holiday list"],
  ["team", "👥", "Team", "Staff directory and accounts"],
];
const PAGES = { dashboard: Dashboard, tasks: Tasks, attendance: Attendance, calendar: Calendar, holidays: Holidays, team: Team };
const EMPTY = { profiles: [], tasks: [], holidays: [], attendance: [] };

function InstallAppButton() {
  const [installPrompt, setInstallPrompt] = useState(null);
  const [help, setHelp] = useState(false);

  useEffect(() => {
    const handleInstallPrompt = (event) => {
      event.preventDefault();
      setInstallPrompt(event);
    };
    const handleInstalled = () => {
      setInstallPrompt(null);
      setHelp(false);
    };
    window.addEventListener("beforeinstallprompt", handleInstallPrompt);
    window.addEventListener("appinstalled", handleInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", handleInstallPrompt);
      window.removeEventListener("appinstalled", handleInstalled);
    };
  }, []);

  const install = async () => {
    if (!installPrompt) {
      setHelp(true);
      return;
    }
    await installPrompt.prompt();
    await installPrompt.userChoice;
    setInstallPrompt(null);
  };

  const isAppleMobile = /iPad|iPhone|iPod/.test(navigator.userAgent);
  return (
    <>
      <button className="btn sm ghost install-app" onClick={install}>＋ Install app</button>
      {help && (
        <div className="install-help" role="dialog" aria-label="Install CCH Task Manager">
          <div className="install-help-head">
            <b>Add CCH Task Manager to your device</b>
            <button className="x" onClick={() => setHelp(false)} aria-label="Close">✕</button>
          </div>
          <p>{isAppleMobile
            ? "In Safari, tap Share, then choose Add to Home Screen."
            : "Open your browser menu and choose Install app or Add to Home screen. In Chrome or Edge on desktop, you can also use the install icon in the address bar."}</p>
          <p className="meta">The shortcut opens the app directly. An internet connection is needed to sign in and sync task data.</p>
        </div>
      )}
    </>
  );
}

export default function App() {
  const [me, setMe] = useState(null);
  const [data, setData] = useState(EMPTY);
  const [booting, setBooting] = useState(true);
  const [view, setView] = useState("dashboard");
  const [taskFilter, setTaskFilter] = useState({ status: "All", type: "Individual" });
  const [modal, setModal] = useState(null);
  const [msg, setMsg] = useState("");

  const toast = useCallback((text) => {
    setMsg(text);
    setTimeout(() => setMsg(""), 2800);
  }, []);
  const reload = useCallback(async () => {
    try { setData(await api.loadAll()); }
    catch (e) { toast(e.message); }
  }, [toast]);
  const enter = useCallback(async () => {
    const p = await api.currentProfile();
    setMe(p);
    if (!p.must_reset) await reload();
  }, [reload]);
  const run = useCallback(async (fn, ok) => {
    try { await fn(); if (ok) toast(ok); await reload(); }
    catch (e) { toast(e.message || "Something went wrong"); }
  }, [reload, toast]);
  const logout = async () => {
    await api.signOut();
    setMe(null); setData(EMPTY); setView("dashboard"); setTaskFilter({ status: "All", type: "Individual" }); setModal(null);
  };

  useEffect(() => {
    if (CONFIG_ERROR) return;
    (async () => {
      try { if (await api.hasSession()) await enter(); }
      catch (e) { toast(e.message); }
      setBooting(false);
    })();
  }, [enter, toast]);

  if (CONFIG_ERROR) {
    return (
      <div className="login">
        <div className="login-card" role="alert">
          <h1>Supabase setup required</h1>
          <p className="sub">{CONFIG_ERROR}</p>
          <p className="meta">Copy <code>.env.example</code> to <code>.env</code>, add your project URL and publishable key, then restart the dev server.</p>
        </div>
      </div>
    );
  }

  if (booting) return <div className="login"><div className="meta">Loading…</div></div>;
  if (!me) {
    return <Login onLogin={async (id, pw) => { await api.signIn(id, pw); await enter(); }} installApp={<InstallAppButton />} />;
  }
  if (me.must_reset) {
    return <ForcePassword onDone={enter} onLogout={logout} toast={toast} />;
  }

  const ctx = {
    me, data, reload, run, toast, taskFilter, setTaskFilter,
    isMgr: ["Director", "Manager"].includes(me.role),
    isDir: me.role === "Director",
    open: (el) => setModal(el),
    close: () => setModal(null),
    go: setView,
    showTasks: (status) => {
      setTaskFilter({ status, type: "All" });
      setView("tasks");
    },
  };
  const Page = PAGES[view];
  const sec = SECTIONS.find((s) => s[0] === view);

  return (
    <div className="app">
      <aside>
        <div className="brand"><img src="assets/logo.png" alt="logo" /><div><b>Cyber Crime Helpline</b><small>LLP · Pune</small></div></div>
        <nav className="nav">
          {SECTIONS.map(([k, i, l]) => (
            <button key={k} className={k === view ? "active" : ""} onClick={() => setView(k)}>{i} {l}</button>
          ))}
        </nav>
        <button className="btn ghost side-out" onClick={logout}>Sign out</button>
      </aside>
      <main>
        <header className="top">
          <div><h1>{sec[2]}</h1><div className="sub">{sec[3]}</div></div>
          <div className="top-actions"><InstallAppButton /><div className="who"><span>{me.full_name}</span><span className="chip t-ind">{me.role}</span></div><button className="btn sm ghost mobile-out" onClick={logout}>Sign out</button></div>
        </header>
        {DEMO && <div className="banner">Demo mode: data is kept only in this browser. Copy .env.example to .env, add your Supabase credentials, and restart the server to go live.</div>}
        <Page ctx={ctx} />
      </main>
      {modal && <Modal onClose={ctx.close}>{modal}</Modal>}
      {msg && <div className="toast">{msg}</div>}
    </div>
  );
}
