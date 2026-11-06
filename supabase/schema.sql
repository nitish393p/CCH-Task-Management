-- =====================================================
-- CCH Task Manager - database schema and security rules
-- Run this whole file in Supabase: SQL Editor > New query > Run.
-- Safe to rerun: tables/functions are retained and policies are recreated.
-- =====================================================

create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  login_id text unique not null,
  full_name text not null,
  role text not null check (role in ('Director','Manager','Employee')),
  dept text not null default '-',
  phone text not null default '',
  email text not null default '-',
  must_reset boolean not null default true,
  last_reminder date,
  created_at timestamptz not null default now()
);

create table if not exists tasks (
  id bigint generated always as identity primary key,
  title text not null,
  type text not null check (type in ('Individual','Group')),
  priority text not null check (priority in ('High','Medium','Low')),
  status text not null default 'To Do' check (status in ('To Do','In Progress','Done')),
  due date not null,
  repeat_daily boolean not null default false,
  status_date date,
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table tasks add column if not exists repeat_daily boolean not null default false;
alter table tasks add column if not exists status_date date;

create table if not exists task_assignees (
  task_id bigint references tasks(id) on delete cascade,
  user_id uuid references profiles(id) on delete cascade,
  primary key (task_id, user_id)
);

create table if not exists attendance (
  id bigint generated always as identity primary key,
  user_id uuid not null references profiles(id) on delete cascade,
  work_date date not null,
  check_in timestamptz,
  check_out timestamptz,
  on_leave boolean not null default false,
  unique (user_id, work_date)
);

create table if not exists holidays (
  id bigint generated always as identity primary key,
  holiday_date date unique not null,
  name text not null
);

-- ---------- helper functions ----------
create or replace function is_manager() returns boolean
language sql security definer stable set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and role in ('Director','Manager'));
$$;

create or replace function is_director() returns boolean
language sql security definer stable set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and role = 'Director');
$$;

create or replace function is_active_user() returns boolean
language sql security definer stable set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid());
$$;

create or replace function is_assignee(tid bigint) returns boolean
language sql security definer stable set search_path = public as $$
  select exists (select 1 from task_assignees where task_id = tid and user_id = auth.uid());
$$;

-- Lets a user clear their own "must change password" flag after choosing a new password.
create or replace function finish_password_change() returns void
language sql security definer set search_path = public as $$
  update profiles set must_reset = false where id = auth.uid();
$$;

-- Lets a manager, or the assignee of a task, change only the status of that task.
drop function if exists set_task_status(bigint, text);
create or replace function set_task_status(tid bigint, s text, task_day date) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not (is_manager() or is_assignee(tid)) then
    raise exception 'Not allowed';
  end if;
  if s not in ('To Do','In Progress','Done') then
    raise exception 'Invalid status';
  end if;
  update tasks
  set status = s,
      status_date = case when repeat_daily then task_day else status_date end
  where id = tid;
end;
$$;

grant execute on function finish_password_change() to authenticated;
grant execute on function set_task_status(bigint, text, date) to authenticated;

-- ---------- row level security ----------
alter table profiles enable row level security;
alter table tasks enable row level security;
alter table task_assignees enable row level security;
alter table attendance enable row level security;
alter table holidays enable row level security;

drop policy if exists "profiles: read all" on profiles;
drop policy if exists "profiles: director updates" on profiles;
drop policy if exists "tasks: read own or manager" on tasks;
drop policy if exists "tasks: manager insert" on tasks;
drop policy if exists "employee_insert_own_task" on tasks;
drop policy if exists "tasks: manager update" on tasks;
drop policy if exists "tasks: manager delete" on tasks;
drop policy if exists "assignees: read all" on task_assignees;
drop policy if exists "assignees: manager insert" on task_assignees;
drop policy if exists "employee_self_insert_task_assignee" on task_assignees;
drop policy if exists "assignees: manager delete" on task_assignees;
drop policy if exists "attendance: read own or manager" on attendance;
drop policy if exists "attendance: insert own or manager" on attendance;
drop policy if exists "attendance: update own or manager" on attendance;
drop policy if exists "holidays: read all" on holidays;
drop policy if exists "holidays: manager write" on holidays;
drop policy if exists "holidays: manager update" on holidays;
drop policy if exists "holidays: manager delete" on holidays;

create policy "profiles: read all" on profiles for select to authenticated using (is_active_user());
create policy "profiles: director updates" on profiles for update to authenticated using (is_director()) with check (is_director());

revoke update on table public.profiles from anon, authenticated;
grant update (last_reminder) on table public.profiles to authenticated;

create policy "tasks: read own or manager" on tasks for select to authenticated
  using (is_manager() or created_by = auth.uid() or is_assignee(id));
create policy "tasks: manager insert" on tasks for insert to authenticated with check (is_manager());
create policy "employee_insert_own_task" on tasks for insert to authenticated
  with check (
    created_by = (select auth.uid())
    and type = 'Individual'
    and status = 'To Do'
    and not (select is_manager())
    and (select is_active_user())
  );
create policy "tasks: manager update" on tasks for update to authenticated using (is_manager()) with check (is_manager());
create policy "tasks: manager delete" on tasks for delete to authenticated using (is_manager());

create policy "assignees: read all" on task_assignees for select to authenticated using (true);
create policy "assignees: manager insert" on task_assignees for insert to authenticated with check (is_manager());
create policy "employee_self_insert_task_assignee" on task_assignees for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from tasks
      where tasks.id = task_assignees.task_id
        and tasks.created_by = (select auth.uid())
        and tasks.type = 'Individual'
    )
  );
create policy "assignees: manager delete" on task_assignees for delete to authenticated using (is_manager());

create policy "attendance: read own or manager" on attendance for select to authenticated
  using (user_id = auth.uid() or is_manager());
create policy "attendance: insert own or manager" on attendance for insert to authenticated
  with check (user_id = auth.uid() or is_manager());
create policy "attendance: update own or manager" on attendance for update to authenticated
  using (user_id = auth.uid() or is_manager()) with check (user_id = auth.uid() or is_manager());

create policy "holidays: read all" on holidays for select to authenticated using (true);
create policy "holidays: manager write" on holidays for insert to authenticated with check (is_manager());
create policy "holidays: manager update" on holidays for update to authenticated using (is_manager()) with check (is_manager());
create policy "holidays: manager delete" on holidays for delete to authenticated using (is_manager());

-- =====================================================
-- FIRST DIRECTOR (run AFTER creating the user in Authentication > Users)
-- Run this to create or update cchadvisor@gmail.com's profile as Director.
-- =====================================================
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

notify pgrst, 'reload schema';
