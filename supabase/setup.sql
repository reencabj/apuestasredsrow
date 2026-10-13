-- Ejecutar una vez desde el SQL Editor del proyecto.
begin;
create table public.club_members (
  user_id uuid primary key references auth.users(id) on delete cascade
);
alter table public.club_members enable row level security;
revoke all on public.club_members from anon, authenticated;
grant select on public.club_members to authenticated;
create policy "Leer propia autorización" on public.club_members
  for select to authenticated using (user_id = (select auth.uid()));

create table public.club_state (
  id integer primary key check (id = 1),
  fights jsonb not null default '[]' check (jsonb_typeof(fights) = 'array'),
  contacts jsonb not null default '[]' check (jsonb_typeof(contacts) = 'array'),
  revision integer not null default 0
);
insert into public.club_state(id) values (1);
alter table public.club_state enable row level security;
revoke all on public.club_state from anon, authenticated;
grant select on public.club_state to authenticated;
create policy "Miembros leen tablero" on public.club_state for select to authenticated
  using (exists(select 1 from public.club_members where user_id = (select auth.uid())));

-- El cambio de versión es atómico: una escritura desactualizada no pisa otra.
create function public.save_club_state(expected_revision integer, next_fights jsonb, next_contacts jsonb)
returns table(revision integer)
language plpgsql security definer set search_path = '' as $$
begin
  if not exists(select 1 from public.club_members where user_id = auth.uid()) then
    raise exception 'Cuenta sin autorización' using errcode = '42501';
  end if;
  if jsonb_typeof(next_fights) is distinct from 'array'
     or jsonb_typeof(next_contacts) is distinct from 'array' then
    raise exception 'Datos inválidos';
  end if;
  return query update public.club_state as s
    set fights = next_fights, contacts = next_contacts, revision = s.revision + 1
    where s.id = 1 and s.revision = expected_revision returning s.revision;
end;
$$;
revoke all on function public.save_club_state(integer,jsonb,jsonb) from public, anon;
grant execute on function public.save_club_state(integer,jsonb,jsonb) to authenticated;
commit;

-- Crear usuarios en Authentication > Users y autorizar sus UUID así:
-- insert into public.club_members(user_id) values ('UUID-DEL-USUARIO');
