alter table public.tasks
  add column if not exists description text not null default '';

drop policy if exists "tasks: description update assigned" on public.tasks;
create policy "tasks: description update assigned" on public.tasks
  for update to authenticated
  using (
    (select is_active_user())
    and (created_by = (select auth.uid()) or is_assignee(id))
  )
  with check (
    (select is_active_user())
    and (created_by = (select auth.uid()) or is_assignee(id))
  );

revoke update on table public.tasks from anon, authenticated;
grant update (description) on table public.tasks to authenticated;