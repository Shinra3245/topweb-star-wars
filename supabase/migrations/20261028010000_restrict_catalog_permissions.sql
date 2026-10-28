-- El catálogo solo puede leerse con una sesión válida; la carga utiliza service_role.
revoke all on public.planets, public.characters from anon, authenticated;
grant select on public.planets, public.characters to authenticated;
