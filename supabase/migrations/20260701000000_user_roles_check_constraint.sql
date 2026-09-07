-- Fix bad data: a row was inserted with a trailing newline in role
-- ("admin\n"), which silently failed every `.eq("role", "admin")` lookup
-- since RLS let the row through but the equality check never matched.
UPDATE public.user_roles
SET role = trim(both from regexp_replace(role, '\s', '', 'g'))
WHERE role ~ '\s';

-- Restrict role to the known set so malformed/mistyped values are rejected
-- at insert time instead of silently breaking role checks later.
-- 'default_user' is included because it's the column's own DEFAULT.
ALTER TABLE public.user_roles
  ADD CONSTRAINT user_roles_role_check CHECK (role IN ('admin', 'smp_admin', 'default_user'));
