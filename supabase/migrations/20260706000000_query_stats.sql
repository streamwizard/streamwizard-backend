-- Read-only window into pg_stat_statements for the monitoring dashboard's
-- "top queries" table. security definer because the view is gated behind
-- pg_read_all_stats; execution is restricted to service_role (the monitor's
-- admin client) so it never leaks query text to app users.

create extension if not exists pg_stat_statements with schema extensions;

create or replace function public.admin_query_stats(limit_count int default 50)
returns table (
  query text,
  calls bigint,
  total_exec_ms double precision,
  mean_exec_ms double precision,
  rows_returned bigint
)
language sql
security definer
set search_path = ''
as $$
  select
    left(s.query, 500) as query,
    s.calls,
    s.total_exec_time as total_exec_ms,
    s.mean_exec_time as mean_exec_ms,
    s.rows as rows_returned
  from extensions.pg_stat_statements s
  where s.query not in ('BEGIN', 'COMMIT')
  order by s.total_exec_time desc
  limit greatest(1, least(limit_count, 200));
$$;

revoke all on function public.admin_query_stats(int) from public;
revoke all on function public.admin_query_stats(int) from anon;
revoke all on function public.admin_query_stats(int) from authenticated;
grant execute on function public.admin_query_stats(int) to service_role;
