import { useState } from "react";
import { api } from "../lib/api";

export default function ForcePassword({ onDone, onLogout, toast }) {
  const [pw, setPw] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const save = async (e) => {
    e.preventDefault();
    setError("");
    if (pw.length < 8) return setError("Use at least 8 characters.");
    setBusy(true);
    try { await api.setNewPassword(pw); await onDone(); }
    catch (x) { setError(x.message || "Could not update your password."); }
    finally { setBusy(false); }
  };
  return (
    <div className="login">
      <form className="login-card" onSubmit={save}>
        <img src="assets/logo.png" alt="logo" className="login-logo" />
        <h1>Set your new password</h1>
        <p className="sub">Your Director gave you a temporary password. Choose your own to continue.</p>
        <div className="field" style={{ marginTop: 14 }}><label>New password (8+ characters)</label><input type="password" value={pw} onChange={(e) => { setPw(e.target.value); setError(""); }} autoComplete="new-password" /></div>
        {error && <div className="err" role="alert">{error}</div>}
        <button className="btn" type="submit" disabled={busy} style={{ width: "100%" }}>Save and continue</button>
        <button type="button" className="btn ghost" onClick={onLogout} style={{ width: "100%", marginTop: 8 }}>Sign out</button>
      </form>
    </div>
  );
}
