-- Allow authenticated users to read their own role rows.
-- Previously only smp_admin had any access; regular users had no way to check
-- their own roles client-side without going through the service role.
CREATE POLICY "Users read own roles" ON public.user_roles
    AS PERMISSIVE FOR SELECT TO authenticated
    USING ( ( SELECT auth.uid() ) = user_id );
