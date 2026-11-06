import { useState } from "react";
import { DEMO } from "../lib/config";

export default function Login({ onLogin, installApp }) {
  const [id, setId] = useState("");
  const [pw, setPw] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    setErr(""); setBusy(true);
    try { await onLogin(id.trim().toLowerCase(), pw); }
    catch (x) { setErr(x.message || "Sign-in failed"); }
    finally { setBusy(false); }
  };
  return (
    <div className="login">
      <form className="login-card" onSubmit={submit}>
        <img src="assets/logo.png" alt="Cyber Crime Helpline LLP logo" className="login-logo" />
        <h1>Cyber Crime Helpline LLP</h1>
        <p className="sub">Task & Attendance Manager</p>
        <div className="field"><label>Login ID or email</label><input value={id} onChange={(e) => setId(e.target.value)} autoComplete="username" placeholder="director@cch.in or director" required /></div>
        <div className="field"><label>Password</label><input type="password" value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="current-password" required /></div>
        <div className="err">{err}</div>
        <button className="btn" type="submit" disabled={busy} style={{ width: "100%" }}>{busy ? "Signing in…" : "Sign in"}</button>
        {installApp && <div className="login-install">{installApp}</div>}
        {DEMO && <p className="meta" style={{ marginTop: 14 }}>Demo login: <b>director</b> / <b>demo1234</b> (also priya.nair, rahul.verma)</p>}
      </form>
    </div>
  );
}
