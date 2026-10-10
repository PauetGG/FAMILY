-- =====================================================================
-- ESQUEMA DE BASE DE DADES (Supabase / Postgres)
-- Dieta en calendari, llistes de la compra i repartiment de tiquets
-- Enganxa-ho tot al SQL Editor de Supabase i prem "Run".
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. TIPUS
-- ---------------------------------------------------------------------
create type unit_type as enum ('g', 'ml', 'unit');
create type meal_type as enum ('breakfast', 'lunch', 'snack', 'dinner');
create type group_role as enum ('owner', 'member');


-- ---------------------------------------------------------------------
-- 2. PERFILS (un per usuari de Supabase Auth)
-- ---------------------------------------------------------------------
create table profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '',
  avatar_url   text,
  created_at   timestamptz not null default now()
);

-- Crea el perfil automàticament quan algú es registra
create function handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into profiles (id, display_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1))
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();


-- ---------------------------------------------------------------------
-- 3. GRUPS (pis, família...) Una persona pot estar en diversos grups
-- ---------------------------------------------------------------------
create table groups (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  invite_code text not null unique default substr(md5(random()::text), 1, 8),
  created_by  uuid not null default auth.uid() references profiles(id) on delete cascade,
  created_at  timestamptz not null default now()
);

create table group_members (
  group_id  uuid not null references groups(id) on delete cascade,
  user_id   uuid not null references profiles(id) on delete cascade,
  role      group_role not null default 'member',
  joined_at timestamptz not null default now(),
  primary key (group_id, user_id)
);

create index on group_members (user_id);

-- Qui crea el grup en queda com a propietari
create function add_group_owner()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into group_members (group_id, user_id, role)
  values (new.id, new.created_by, 'owner');
  return new;
end;
$$;

create trigger on_group_created
  after insert on groups
  for each row execute function add_group_owner();


-- ---------------------------------------------------------------------
-- 4. ALIMENTS I PLATS
-- ---------------------------------------------------------------------
-- Catàleg d'ingredients compartit per tots els usuaris
create table ingredients (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  unit       unit_type not null default 'g',
  created_by uuid default auth.uid() references profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (name, unit)
);

create table dishes (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null default auth.uid() references profiles(id) on delete cascade,
  name        text not null,
  description text,
  created_at  timestamptz not null default now()
);

create index on dishes (owner_id);

-- Quantitat de cada ingredient PER UNA RACIÓ del plat
create table dish_ingredients (
  dish_id       uuid not null references dishes(id) on delete cascade,
  ingredient_id uuid not null references ingredients(id) on delete restrict,
  quantity      numeric(10,2) not null check (quantity > 0),
  primary key (dish_id, ingredient_id)
);


-- ---------------------------------------------------------------------
-- 5. CALENDARI DE LA DIETA (individual, es pot compartir)
-- ---------------------------------------------------------------------
create table diet_entries (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references profiles(id) on delete cascade,
  date       date not null,
  meal       meal_type not null,
  dish_id    uuid not null references dishes(id) on delete cascade,
  servings   numeric(5,2) not null default 1 check (servings > 0),
  notes      text,
  created_at timestamptz not null default now()
);

create index on diet_entries (user_id, date);

-- Compartir el calendari amb una altra persona (només veure o també editar)
create table diet_shares (
  owner_id       uuid not null default auth.uid() references profiles(id) on delete cascade,
  shared_with_id uuid not null references profiles(id) on delete cascade,
  can_edit       boolean not null default false,
  created_at     timestamptz not null default now(),
  primary key (owner_id, shared_with_id),
  check (owner_id <> shared_with_id)
);


-- ---------------------------------------------------------------------
-- 6. LLISTES DE LA COMPRA (individuals si group_id és null)
-- ---------------------------------------------------------------------
create table shopping_lists (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  owner_id   uuid not null default auth.uid() references profiles(id) on delete cascade,
  group_id   uuid references groups(id) on delete cascade,
  date_from  date,
  date_to    date,
  is_done    boolean not null default false,
  created_at timestamptz not null default now(),
  check (date_to is null or date_from is null or date_to >= date_from)
);

create index on shopping_lists (owner_id);
create index on shopping_lists (group_id);

create table shopping_list_items (
  id            uuid primary key default gen_random_uuid(),
  list_id       uuid not null references shopping_lists(id) on delete cascade,
  ingredient_id uuid references ingredients(id) on delete set null,
  custom_name   text,                       -- per a coses que no són ingredients (paper, detergent...)
  quantity      numeric(10,2),
  unit          unit_type,
  for_user_id   uuid references profiles(id) on delete set null,  -- null = comú
  checked       boolean not null default false,
  source        text not null default 'manual' check (source in ('diet', 'manual')),
  created_at    timestamptz not null default now(),
  check (ingredient_id is not null or custom_name is not null)
);

create index on shopping_list_items (list_id);


-- ---------------------------------------------------------------------
-- 7. TIQUETS I REPARTIMENT
-- ---------------------------------------------------------------------
create table receipts (
  id               uuid primary key default gen_random_uuid(),
  uploaded_by      uuid not null default auth.uid() references profiles(id) on delete cascade,
  group_id         uuid references groups(id) on delete cascade,
  shopping_list_id uuid references shopping_lists(id) on delete set null,
  store_name       text,
  purchased_at     date default current_date,
  total            numeric(10,2),
  image_path       text,                    -- ruta dins el bucket "receipts"
  is_confirmed     boolean not null default false,
  created_at       timestamptz not null default now()
);

create index on receipts (group_id);

create table receipt_lines (
  id          uuid primary key default gen_random_uuid(),
  receipt_id  uuid not null references receipts(id) on delete cascade,
  description text not null,
  quantity    numeric(10,3) default 1,
  amount      numeric(10,2) not null,       -- import total de la línia
  position    int not null default 0
);

create index on receipt_lines (receipt_id);

-- Qui paga cada línia. "share" és el pes: si dues persones tenen 1, paguen meitat i meitat
create table receipt_line_payers (
  line_id uuid not null references receipt_lines(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  share   numeric(6,2) not null default 1 check (share > 0),
  primary key (line_id, user_id)
);


-- ---------------------------------------------------------------------
-- 8. FUNCIONS D'AJUDA PER ALS PERMISOS
-- ---------------------------------------------------------------------
create function is_group_member(p_group_id uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from group_members
    where group_id = p_group_id and user_id = auth.uid()
  );
$$;

create function is_group_owner(p_group_id uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from group_members
    where group_id = p_group_id and user_id = auth.uid() and role = 'owner'
  );
$$;

create function shares_group_with(p_user_id uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1
    from group_members a
    join group_members b on a.group_id = b.group_id
    where a.user_id = auth.uid() and b.user_id = p_user_id
  );
$$;

create function can_view_diet(p_owner_id uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select p_owner_id = auth.uid()
      or exists (
        select 1 from diet_shares
        where owner_id = p_owner_id and shared_with_id = auth.uid()
      );
$$;

create function can_edit_diet(p_owner_id uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select p_owner_id = auth.uid()
      or exists (
        select 1 from diet_shares
        where owner_id = p_owner_id and shared_with_id = auth.uid() and can_edit
      );
$$;

create function can_view_dish(p_dish_id uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from dishes d
    where d.id = p_dish_id
      and (d.owner_id = auth.uid()
           or shares_group_with(d.owner_id)
           or can_view_diet(d.owner_id))
  );
$$;

create function can_access_list(p_list_id uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from shopping_lists l
    where l.id = p_list_id
      and (l.owner_id = auth.uid()
           or (l.group_id is not null and is_group_member(l.group_id)))
  );
$$;

create function can_access_receipt(p_receipt_id uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from receipts r
    where r.id = p_receipt_id
      and (r.uploaded_by = auth.uid()
           or (r.group_id is not null and is_group_member(r.group_id)))
  );
$$;


-- ---------------------------------------------------------------------
-- 9. SEGURETAT PER FILES (RLS)
-- ---------------------------------------------------------------------
alter table profiles            enable row level security;
alter table groups              enable row level security;
alter table group_members       enable row level security;
alter table ingredients         enable row level security;
alter table dishes              enable row level security;
alter table dish_ingredients    enable row level security;
alter table diet_entries        enable row level security;
alter table diet_shares         enable row level security;
alter table shopping_lists      enable row level security;
alter table shopping_list_items enable row level security;
alter table receipts            enable row level security;
alter table receipt_lines       enable row level security;
alter table receipt_line_payers enable row level security;

-- Perfils: veus el teu, el de la gent dels teus grups i el de qui t'ha compartit la dieta
create policy "profiles_select" on profiles for select to authenticated
  using (id = auth.uid() or shares_group_with(id) or can_view_diet(id));
create policy "profiles_update" on profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

-- Grups
create policy "groups_select" on groups for select to authenticated
  using (is_group_member(id));
create policy "groups_insert" on groups for insert to authenticated
  with check (created_by = auth.uid());
create policy "groups_update" on groups for update to authenticated
  using (is_group_owner(id));
create policy "groups_delete" on groups for delete to authenticated
  using (is_group_owner(id));

-- Membres: els veuen els membres; el propietari afegeix; un pot marxar sol
create policy "members_select" on group_members for select to authenticated
  using (is_group_member(group_id));
create policy "members_insert" on group_members for insert to authenticated
  with check (is_group_owner(group_id));
create policy "members_update" on group_members for update to authenticated
  using (is_group_owner(group_id));
create policy "members_delete" on group_members for delete to authenticated
  using (user_id = auth.uid() or is_group_owner(group_id));

-- Ingredients: catàleg comú
create policy "ingredients_select" on ingredients for select to authenticated
  using (true);
create policy "ingredients_insert" on ingredients for insert to authenticated
  with check (created_by = auth.uid());
create policy "ingredients_update" on ingredients for update to authenticated
  using (created_by = auth.uid());
create policy "ingredients_delete" on ingredients for delete to authenticated
  using (created_by = auth.uid());

-- Plats
create policy "dishes_select" on dishes for select to authenticated
  using (owner_id = auth.uid() or shares_group_with(owner_id) or can_view_diet(owner_id));
create policy "dishes_insert" on dishes for insert to authenticated
  with check (owner_id = auth.uid());
create policy "dishes_update" on dishes for update to authenticated
  using (owner_id = auth.uid());
create policy "dishes_delete" on dishes for delete to authenticated
  using (owner_id = auth.uid());

create policy "dish_ingredients_select" on dish_ingredients for select to authenticated
  using (can_view_dish(dish_id));
create policy "dish_ingredients_write" on dish_ingredients for all to authenticated
  using (exists (select 1 from dishes d where d.id = dish_id and d.owner_id = auth.uid()))
  with check (exists (select 1 from dishes d where d.id = dish_id and d.owner_id = auth.uid()));

-- Calendari
create policy "diet_select" on diet_entries for select to authenticated
  using (can_view_diet(user_id));
create policy "diet_insert" on diet_entries for insert to authenticated
  with check (can_edit_diet(user_id) and can_view_dish(dish_id));
create policy "diet_update" on diet_entries for update to authenticated
  using (can_edit_diet(user_id)) with check (can_edit_diet(user_id) and can_view_dish(dish_id));
create policy "diet_delete" on diet_entries for delete to authenticated
  using (can_edit_diet(user_id));

create policy "diet_shares_select" on diet_shares for select to authenticated
  using (owner_id = auth.uid() or shared_with_id = auth.uid());
create policy "diet_shares_insert" on diet_shares for insert to authenticated
  with check (owner_id = auth.uid());
create policy "diet_shares_update" on diet_shares for update to authenticated
  using (owner_id = auth.uid());
create policy "diet_shares_delete" on diet_shares for delete to authenticated
  using (owner_id = auth.uid() or shared_with_id = auth.uid());

-- Llistes de la compra
create policy "lists_select" on shopping_lists for select to authenticated
  using (owner_id = auth.uid() or (group_id is not null and is_group_member(group_id)));
create policy "lists_insert" on shopping_lists for insert to authenticated
  with check (owner_id = auth.uid() and (group_id is null or is_group_member(group_id)));
create policy "lists_update" on shopping_lists for update to authenticated
  using (owner_id = auth.uid() or (group_id is not null and is_group_member(group_id)));
create policy "lists_delete" on shopping_lists for delete to authenticated
  using (owner_id = auth.uid());

create policy "list_items_all" on shopping_list_items for all to authenticated
  using (can_access_list(list_id)) with check (can_access_list(list_id));

-- Tiquets
create policy "receipts_select" on receipts for select to authenticated
  using (uploaded_by = auth.uid() or (group_id is not null and is_group_member(group_id)));
create policy "receipts_insert" on receipts for insert to authenticated
  with check (uploaded_by = auth.uid() and (group_id is null or is_group_member(group_id)));
create policy "receipts_update" on receipts for update to authenticated
  using (uploaded_by = auth.uid() or (group_id is not null and is_group_member(group_id)));
create policy "receipts_delete" on receipts for delete to authenticated
  using (uploaded_by = auth.uid());

create policy "receipt_lines_all" on receipt_lines for all to authenticated
  using (can_access_receipt(receipt_id)) with check (can_access_receipt(receipt_id));

create policy "receipt_payers_all" on receipt_line_payers for all to authenticated
  using (exists (select 1 from receipt_lines l where l.id = line_id and can_access_receipt(l.receipt_id)))
  with check (exists (select 1 from receipt_lines l where l.id = line_id and can_access_receipt(l.receipt_id)));


-- ---------------------------------------------------------------------
-- 10. FUNCIONS QUE CRIDARÀ L'APP
-- ---------------------------------------------------------------------

-- Entrar a un grup amb el codi d'invitació
create function join_group(p_code text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_group_id uuid;
begin
  select id into v_group_id from groups where invite_code = lower(trim(p_code));
  if v_group_id is null then
    raise exception 'Codi d''invitació no vàlid';
  end if;

  insert into group_members (group_id, user_id)
  values (v_group_id, auth.uid())
  on conflict do nothing;

  return v_group_id;
end;
$$;

-- Omple una llista a partir del calendari de les dates indicades.
-- Llista individual: només el teu calendari. Llista de grup: el de tots els membres,
-- separant per a qui és cada quantitat. Torna a calcular sense tocar els articles
-- afegits a mà ni els que ja estan marcats.
create function generate_shopping_list_items(p_list_id uuid)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_list  shopping_lists;
  v_count int;
begin
  select * into v_list from shopping_lists where id = p_list_id;

  if not found or not can_access_list(p_list_id) then
    raise exception 'Llista no trobada o sense permís';
  end if;

  if v_list.date_from is null or v_list.date_to is null then
    raise exception 'La llista necessita data d''inici i de fi';
  end if;

  delete from shopping_list_items
  where list_id = p_list_id and source = 'diet' and not checked;

  insert into shopping_list_items (list_id, ingredient_id, quantity, unit, for_user_id, source)
  select p_list_id,
         di.ingredient_id,
         sum(di.quantity * de.servings),
         i.unit,
         de.user_id,
         'diet'
  from diet_entries de
  join dish_ingredients di on di.dish_id = de.dish_id
  join ingredients i       on i.id = di.ingredient_id
  where de.date between v_list.date_from and v_list.date_to
    and (
      (v_list.group_id is null and de.user_id = v_list.owner_id)
      or
      (v_list.group_id is not null and de.user_id in (
         select user_id from group_members where group_id = v_list.group_id))
    )
  group by di.ingredient_id, i.unit, de.user_id;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- Copiar una setmana del calendari a una altra (p_from i p_to són el dilluns de cada setmana)
create function copy_diet_week(p_from date, p_to date, p_user_id uuid default auth.uid())
returns int
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_count int;
begin
  insert into diet_entries (user_id, date, meal, dish_id, servings, notes)
  select user_id, date + (p_to - p_from), meal, dish_id, servings, notes
  from diet_entries
  where user_id = p_user_id
    and date between p_from and p_from + 6;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;


-- ---------------------------------------------------------------------
-- 11. RESUM DEL TIQUET: QUANT PAGA CADASCÚ
-- ---------------------------------------------------------------------
create view receipt_person_totals
with (security_invoker = true)
as
select l.receipt_id,
       p.user_id,
       round(sum(l.amount * p.share / t.total_share), 2) as amount
from receipt_lines l
join receipt_line_payers p on p.line_id = l.id
join (
  select line_id, sum(share) as total_share
  from receipt_line_payers
  group by line_id
) t on t.line_id = l.id
group by l.receipt_id, p.user_id;

-- Línies que encara no tenen ningú assignat
create view receipt_unassigned_lines
with (security_invoker = true)
as
select l.*
from receipt_lines l
where not exists (select 1 from receipt_line_payers p where p.line_id = l.id);


-- ---------------------------------------------------------------------
-- 12. FOTOS DELS TIQUETS (Storage)
-- Ruta de cada fitxer: {receipt_id}/{nom_fitxer}.jpg
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('receipts', 'receipts', false)
on conflict (id) do nothing;

create policy "receipts_files_select" on storage.objects for select to authenticated
  using (bucket_id = 'receipts' and can_access_receipt(((storage.foldername(name))[1])::uuid));

create policy "receipts_files_insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'receipts' and can_access_receipt(((storage.foldername(name))[1])::uuid));

create policy "receipts_files_delete" on storage.objects for delete to authenticated
  using (bucket_id = 'receipts' and can_access_receipt(((storage.foldername(name))[1])::uuid));
