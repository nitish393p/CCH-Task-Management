import { useState } from "react";
import { api } from "../lib/api";
import { assigneesOf, genPwd, loginFrom, reminderText } from "../lib/helpers";
import { copyToClipboard, shareByGmail, shareByWhatsApp } from "../lib/sharing";
import { Avatar, Chip } from "../components/parts";

export default function Team({ ctx }) {
  const { me, data, isDir, open } = ctx;
  return (
    <>
      {isDir && (
        <div className="row" style={{ justifyContent: "flex-end", marginBottom: 14 }}>
          <button className="btn ghost" onClick={() => open(<DirectorLoginForm ctx={ctx} />)}>Change Director login ID</button>
          <button className="btn ghost" onClick={() => open(<DirectorPasswordForm ctx={ctx} />)}>Change Director password</button>
          <button className="btn" onClick={() => open(<UserForm ctx={ctx} />)}>+ Create user</button>
        </div>
      )}
      <div className="cards">
        {data.profiles.map((p) => {
          const openCount = data.tasks.filter((t) => assigneesOf(t).includes(p.id) && t.status !== "Done").length;
          return (
            <div className="card" key={p.id}>
              <div className="row" style={{ flexWrap: "nowrap", gap: 14 }}>
                <Avatar id={p.id} members={data.profiles} big />
                <div><div className="title" style={{ margin: 0 }}>{p.full_name}</div><div className="meta">{p.role} · {p.dept}</div></div>
              </div>
              <div className="meta" style={{ marginTop: 12 }}>Login ID: <b style={{ color: "var(--ink)" }}>{p.login_id}</b></div>
              <div className="meta">{p.email}</div>
              <div className="row" style={{ marginTop: 10, gap: 6 }}>
                {p.must_reset ? <Chip cls="p-med">Must change password</Chip> : <Chip cls="p-low">Active</Chip>}
                {p.last_reminder && <Chip cls="s-prog">Reminded {p.last_reminder}</Chip>}
              </div>
              <div className="row between" style={{ marginTop: 12 }}>
                <span className="meta">Open tasks: <b>{openCount}</b></span>
                {isDir && p.id !== me.id && p.role !== "Director" && (
                  <span className="row" style={{ gap: 6 }}>
                    <button className="btn sm ghost" onClick={() => open(<EditUserForm ctx={ctx} user={p} />)}>Edit</button>
                    <button className="btn sm ghost" onClick={() => open(<ResetForm ctx={ctx} user={p} />)}>Reset password</button>
                    <button className="btn sm ghost" onClick={() => open(<RemindModal ctx={ctx} user={p} />)}>🔔 Remind</button>
                    <button className="btn sm bad" onClick={() => {
                      if (window.confirm(`Permanently delete ${p.full_name}? Their profile and attendance will be deleted. Tasks assigned only to them will be reassigned to you; other task assignments will be preserved.`)) {
                        ctx.run(() => api.deleteUser(p.id), "Team member deleted");
                      }
                    }}>Delete</button>
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}

function DirectorPasswordForm({ ctx }) {
  const { close, toast } = ctx;
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const save = async () => {
    setError("");
    if (!currentPassword) return setError("Enter your current password.");
    if (newPassword.length < 8) return setError("Use at least 8 characters for the new password.");
    if (newPassword !== confirmPassword) return setError("The new passwords do not match.");
    if (newPassword === currentPassword) return setError("Choose a new password different from your current password.");
    setBusy(true);
    try {
      await api.changeOwnPassword(currentPassword, newPassword);
      close();
      toast("Director password changed successfully.");
    } catch (e) {
      setError(e.message || "Could not change the Director password.");
    } finally {
      setBusy(false);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    }
  };

  return (
    <>
      <h2>Change Director password</h2>
      <div className="field">
        <label>Current password</label>
        <input type="password" autoComplete="current-password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} />
      </div>
      <div className="field">
        <label>New password (8+ characters)</label>
        <input type="password" autoComplete="new-password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
      </div>
      <div className="field">
        <label>Confirm new password</label>
        <input type="password" autoComplete="new-password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
      </div>
      {error && <div className="err" role="alert">{error}</div>}
      <div className="actions">
        <button className="btn ghost" onClick={close} disabled={busy}>Cancel</button>
        <button className="btn" onClick={save} disabled={busy}>{busy ? "Saving…" : "Change password"}</button>
      </div>
    </>
  );
}

function DirectorLoginForm({ ctx }) {
  const { me, close, reload, toast } = ctx;
  const [email, setEmail] = useState(me.login_id);
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const save = async () => {
    const nextEmail = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(nextEmail)) return setError("Enter a valid email address.");
    if (!confirmed) return setError("Confirm that you can access the new email address.");
    if (nextEmail === me.login_id) return setError("This is already your Login ID.");
    setBusy(true);
    setError("");
    try {
      await api.updateDirectorLogin(nextEmail);
      await reload();
      close();
      toast(`Login ID changed to ${nextEmail}. Use it the next time you sign in.`);
    } catch (e) {
      setError(e.message || "Could not change the Director Login ID.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <h2>Change Director Login ID</h2>
      <div className="banner">This changes both your Supabase sign-in email and app Login ID. Your password stays the same.</div>
      <div className="field">
        <label>New Login ID / email</label>
        <input type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
      </div>
      <div className="checks">
        <label><input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} /> I can access this email address and want to use it to sign in.</label>
      </div>
      {error && <div className="err" role="alert">{error}</div>}
      <div className="actions">
        <button className="btn ghost" onClick={close} disabled={busy}>Cancel</button>
        <button className="btn" onClick={save} disabled={busy}>{busy ? "Saving…" : "Change Login ID"}</button>
      </div>
    </>
  );
}

function UserForm({ ctx }) {
  const { close, reload, toast } = ctx;
  const [name, setName] = useState("");
  const [login, setLogin] = useState("");
  const [touched, setTouched] = useState(false);
  const [role, setRole] = useState("Employee");
  const [pwd, setPwd] = useState(genPwd);
  const [dept, setDept] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [created, setCreated] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const onName = (v) => { setName(v); if (!touched) setLogin(loginFrom(v)); };
  const save = async () => {
    setError("");
    if (!name.trim()) return setError("Enter the full name.");
    if (!login.trim()) return setError("Enter a Login ID or email.");
    if (pwd.length < 8) return setError("Temporary password must be at least 8 characters.");
    setBusy(true);
    try {
      const loginId = login.trim().toLowerCase();
      const body = {
        login_id: loginId,
        password: pwd,
        full_name: name.trim(),
        role,
        dept: dept.trim(),
        phone: phone.trim(),
        email: email.trim() || (loginId.includes("@") ? loginId : ""),
      };
      await api.createUser(body);
      setCreated({
        login: body.login_id,
        pwd,
        name: body.full_name,
        email: body.email,
        phone: body.phone,
      });
      await reload();
    } catch (e) { setError(e.message || "Could not create user."); }
    finally { setBusy(false); }
  };

  if (created) {
    return (
      <>
        <h2>User created</h2>
        <div className="banner">Share the Login ID below. For security, the password is not included in Gmail or WhatsApp links; share it separately through a secure channel.</div>
        <div className="card">
          <div className="meta">Login ID</div><div className="title">{created.login}</div>
          <div className="meta">Temporary password</div><div className="title" style={{ margin: 0 }}>{created.pwd}</div>
        </div>
        <p className="meta">Share these temporary credentials securely. The recipient should change the password after signing in.</p>
        <div className="row" style={{ gap: 8 }}>
          <button className="btn sm ghost" disabled={!created.email || created.email === "-"} onClick={() => {
            try {
              shareByGmail(created.email, "Your CCH Task Manager account", `Hello ${created.name},\n\nYour account is ready.\nLogin ID: ${created.login}\nThe Director will share your temporary password separately.\n\nPlease sign in and change your password.`);
            } catch (e) { toast(e.message); }
          }}>✉️ Gmail</button>
          <button className="btn sm ghost" disabled={!created.phone} onClick={() => {
            try {
              shareByWhatsApp(created.phone, `Hello ${created.name}, your CCH Task Manager account is ready.\nLogin ID: ${created.login}\nThe Director will share your temporary password separately.\n\nPlease sign in and change your password.`);
            } catch (e) { toast(e.message); }
          }}>💬 WhatsApp</button>
          <button className="btn sm ghost" onClick={async () => {
            try { await copyToClipboard(created.pwd); toast("Temporary password copied. Share it separately and securely."); }
            catch (e) { toast(e.message); }
          }}>Copy password</button>
        </div>
        <div className="actions"><button className="btn" onClick={close}>Done</button></div>
      </>
    );
  }
  return (
    <>
      <h2>Create user</h2>
      <div className="field"><label>Full name</label><input value={name} onChange={(e) => onName(e.target.value)} /></div>
      <div className="row" style={{ gap: 12 }}>
        <div className="field" style={{ flex: 1 }}><label>Login ID or email</label><input value={login} onChange={(e) => { setLogin(e.target.value); setTouched(true); }} placeholder="name or name@company.com" /></div>
        <div className="field" style={{ flex: 1 }}><label>Role</label>
          <select value={role} onChange={(e) => setRole(e.target.value)}><option>Employee</option><option>Manager</option><option>Director</option></select>
        </div>
      </div>
      <div className="field"><label>Temporary password</label>
        <div className="row" style={{ flexWrap: "nowrap", gap: 8 }}>
          <input value={pwd} onChange={(e) => setPwd(e.target.value)} />
          <button className="btn sm ghost" type="button" onClick={() => setPwd(genPwd())}>Generate</button>
        </div>
      </div>
      <div className="row" style={{ gap: 12 }}>
        <div className="field" style={{ flex: 1 }}><label>Department</label><input value={dept} onChange={(e) => setDept(e.target.value)} /></div>
        <div className="field" style={{ flex: 1 }}><label>Mobile (WhatsApp)</label><input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+91..." /></div>
      </div>
      <div className="field"><label>Email</label><input value={email} onChange={(e) => setEmail(e.target.value)} /></div>
      {error && <div className="err" role="alert">{error}</div>}
      <div className="actions">
        <button className="btn ghost" onClick={close}>Cancel</button>
        <button className="btn" disabled={busy} onClick={save}>{busy ? "Creating…" : "Create user"}</button>
      </div>
    </>
  );
}

function EditUserForm({ ctx, user }) {
  const { run, close } = ctx;
  const [name, setName] = useState(user.full_name);
  const [role, setRole] = useState(user.role);
  const [dept, setDept] = useState(user.dept === "-" ? "" : user.dept);
  const [phone, setPhone] = useState(user.phone || "");
  const [email, setEmail] = useState(user.email === "-" ? "" : user.email);
  const save = () => {
    if (!name.trim()) return ctx.toast("Enter the full name");
    run(async () => {
      await api.updateUser(user.id, {
        full_name: name.trim(),
        role,
        dept: dept.trim(),
        phone: phone.trim(),
        email: email.trim(),
      });
      close();
    }, "Team member updated");
  };
  return (
    <>
      <h2>Edit {user.full_name}</h2>
      <div className="field"><label>Full name</label><input value={name} onChange={(e) => setName(e.target.value)} /></div>
      <div className="field"><label>Login ID (cannot be changed here)</label><input value={user.login_id} disabled /></div>
      <div className="field"><label>Role</label>
        <select value={role} onChange={(e) => setRole(e.target.value)}><option>Employee</option><option>Manager</option></select>
      </div>
      <div className="row" style={{ gap: 12 }}>
        <div className="field" style={{ flex: 1 }}><label>Department</label><input value={dept} onChange={(e) => setDept(e.target.value)} /></div>
        <div className="field" style={{ flex: 1 }}><label>Mobile (WhatsApp)</label><input value={phone} onChange={(e) => setPhone(e.target.value)} /></div>
      </div>
      <div className="field"><label>Contact email</label><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
      <div className="actions">
        <button className="btn ghost" onClick={close}>Cancel</button>
        <button className="btn" onClick={save}>Save changes</button>
      </div>
    </>
  );
}

function ResetForm({ ctx, user }) {
  const { run, close, toast } = ctx;
  const [pwd, setPwd] = useState(genPwd);
  const save = () => {
    if (pwd.length < 8) return toast("Use at least 8 characters");
    run(async () => { await api.resetPassword(user.id, pwd); close(); }, "Password reset. The user must change it at next sign-in.");
  };
  return (
    <>
      <h2>Reset password for {user.full_name}</h2>
      <div className="field"><label>New temporary password</label>
        <div className="row" style={{ flexWrap: "nowrap", gap: 8 }}>
          <input value={pwd} onChange={(e) => setPwd(e.target.value)} />
          <button className="btn sm ghost" type="button" onClick={() => setPwd(genPwd())}>Generate</button>
        </div>
      </div>
      <div className="actions"><button className="btn ghost" onClick={close}>Cancel</button><button className="btn" onClick={save}>Reset</button></div>
    </>
  );
}

function RemindModal({ ctx, user }) {
  const { run, close, toast } = ctx;
  const [text, setText] = useState(reminderText(user));
  const mail = () => {
    try { shareByGmail(user.email === "-" ? "" : user.email, "Reminder: change your CCH login password", text); }
    catch (e) { toast(e.message); }
  };
  const wa = () => {
    try { shareByWhatsApp(user.phone, text); }
    catch (e) { toast(e.message); }
  };
  const copy = async () => {
    try { await navigator.clipboard.writeText(text); toast("Message copied"); }
    catch { toast("Copy is not available here"); }
  };
  return (
    <>
      <h2>Remind {user.full_name}</h2>
      <div className="field"><label>Message</label><textarea rows={6} value={text} onChange={(e) => setText(e.target.value)} /></div>
      <div className="row" style={{ gap: 8 }}>
        <button className="btn sm ghost" onClick={mail}>✉️ Gmail</button>
        <button className="btn sm ghost" disabled={!user.phone} onClick={wa}>💬 WhatsApp</button>
        <button className="btn sm ghost" onClick={copy}>📋 Copy</button>
      </div>
      <div className="actions">
        <button className="btn ghost" onClick={close}>Close</button>
        <button className="btn" onClick={() => run(async () => { await api.markReminded(user.id); close(); }, "Reminder recorded")}>Mark as sent</button>
      </div>
    </>
  );
}
