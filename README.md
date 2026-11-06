# CCH Task Manager (React + Supabase)

A web app for Cyber Crime Helpline LLP: Login ID sign-in, Director-created accounts, password reset, reminders, individual and group tasks (including daily repeating tasks), office in/out attendance with leave, holidays, and a calendar.

The production site is installable on supported phones and desktops as **CCH Task Manager**. Use **Install app** on the sign-in page or in the app header. Chrome/Edge can install directly; on iPhone/iPad, open the site in Safari, tap Share, then **Add to Home Screen**. Installed shortcuts open the hosted app; working with live data still requires an internet connection.

## Quick start (demo mode, no database needed)
```bash
npm install
npm run dev
```
Open the link shown in the terminal. Demo login: `director` / `demo1234` (also `priya.nair` as Manager, `rahul.verma` as Employee). Demo data is kept in your browser only.

## Connect to Supabase (live mode)
1. Create a project at supabase.com.
2. SQL Editor: open a new query, paste the contents of `supabase/schema.sql`, and run it. The schema can be rerun safely; it recreates its RLS policies if they already exist.
3. Authentication > Users > Add user: email `cchadvisor@gmail.com`, choose a password, and enable Auto Confirm. Then run this in SQL Editor. It creates or updates the matching profile to the Director role:
```sql
insert into profiles (id, login_id, full_name, role, dept, email, must_reset)
select id, 'cchadvisor@gmail.com', 'Capt. Sunil Srivastava', 'Director', 'Management', 'cchadvisor@gmail.com', false
from auth.users where email = 'cchadvisor@gmail.com'
on conflict (id) do update
set login_id = excluded.login_id,
    full_name = excluded.full_name,
    role = 'Director',
    dept = excluded.dept,
    email = excluded.email,
    must_reset = false;
```
4. Install the [Supabase CLI](https://supabase.com/docs/guides/local-development/cli/getting-started), then deploy the user-management function from the project root. This function must be deployed before the Director can create, edit, or delete accounts; deploy it again whenever its code changes:
```bash
supabase login
supabase link --project-ref YOUR-PROJECT-REF
supabase functions deploy create-user
```
5. Copy `.env.example` to `.env` in the project root (Vite does not load `.env.example` directly). Set `VITE_SUPABASE_URL` and your publishable key from the project's Connect panel or API settings. The app accepts `VITE_SUPABASE_PUBLISHABLE_KEY` (recommended) and the older `VITE_SUPABASE_ANON_KEY` name. Never put a secret or `service_role` key in a frontend environment variable.
6. Restart `npm run dev`. The demo banner disappears when live mode is active.

If user creation reports that the function is not deployed, rerun the deploy command above and confirm it targets the same project as `VITE_SUPABASE_URL`. If it reports that only a Director can create users, rerun the Director profile SQL and sign out/in before trying again.

If editing a team member reports an invalid Login ID even though the Login ID is not being changed, deploy the latest `create-user` Edge Function. An older deployed version does not recognize the `update-profile` action.

When a user sets a temporary password, the new password must meet the project's Authentication password requirements. If Supabase accepts the password but the profile setup step fails, the app remembers that successful password update for the current browser tab and retries only the profile step when **Save and continue** is clicked again.

The Director can edit team member details and delete non-Director team accounts from the Team page. Deleting a member removes their profile and attendance, removes them from group tasks, and transfers any tasks assigned only to them to the Director. Newly created login IDs and task reminders can be opened as drafts in Gmail or WhatsApp. For security, temporary passwords are not placed in share links; share them separately through a secure channel.

The Director can change their own password from the Team page. The current password is verified before Supabase Auth updates it; choose a new password that meets the project's Authentication settings.

Managers and Directors can correct a team's check-in and check-out timestamps from the Attendance page using **Edit times**. Corrections can create a record for the selected date, and check-out must not precede check-in.

Managers can mark a task to repeat every day when creating it. It appears on the dashboard and calendar each day from its due date, and its status resets for each new day. If using Supabase, rerun the updated `supabase/schema.sql` to add the recurrence fields and status function.

Sign in using the exact email registered in Supabase Auth (`cchadvisor@gmail.com`) and its password. Existing username-style Login IDs, such as `director`, continue to work with the app's `@users.cchl.local` suffix.

## Deploy
Run `npm run build`; the `dist/` folder is the website. Host it on Netlify, Vercel, or GitHub Pages, and set `VITE_SUPABASE_URL` and either supported publishable-key variable in the host's environment settings before building.

## Project structure
- `src/App.jsx`: sign-in flow, layout, navigation, shared state
- `src/pages/`: Dashboard, Tasks, Attendance, Calendar, Holidays, Team
- `src/components/`: Login, forced password change, modal, shared UI parts
- `src/lib/live.js`: Supabase backend. `src/lib/demo.js`: browser-only demo backend. Both expose the same API.
- `supabase/schema.sql`: tables, security rules, and helper functions
- `supabase/functions/create-user/`: server function for creating users and resetting passwords

## Roles
- **Director:** everything, including creating users, resetting passwords, and sending reminders.
- **Manager:** creates individual and group tasks, manages holidays, marks leave, sees the whole team's attendance.
- **Employee:** creates personal tasks assigned only to themselves, clocks in and out, sees their own tasks, and updates their task status.

## Notes
- Passwords are stored and hashed by Supabase Auth, never in the app tables.
- Row Level Security enforces roles on the server. The UI checks are for convenience only.
- Email and WhatsApp reminders are sent from the Director's own device. Automatic email needs an email provider added to the Edge Function.
