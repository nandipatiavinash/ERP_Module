create extension if not exists pgcrypto;

-- ==========================================
-- 1. UTILITY FUNCTIONS & DEFINITIONS
-- ==========================================

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.current_role_name()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select r.name
  from public.users u
  join public.roles r on r.id = u.role_id
  where u.id = auth.uid()
    and u.status = 'active'
    and u.deleted_at is null
    and r.is_active = true
    and r.deleted_at is null
  limit 1
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$ select public.current_role_name() = 'admin' $$;

create or replace function public.is_operator()
returns boolean
language sql
stable
security definer
set search_path = public
as $$ select public.current_role_name() = 'operator' $$;

create or replace function public.next_year_number(prefix text, table_name text, column_name text)
returns text
language plpgsql
as $$
declare
  yr text := to_char(current_date, 'YYYY');
  next_number int;
  sql text;
begin
  sql := format(
    'select coalesce(max((regexp_match(%I, %L))[1]::int), 0) + 1 from public.%I where %I like %L',
    column_name,
    '^' || prefix || '-' || yr || '-([0-9]+)$',
    table_name,
    column_name,
    prefix || '-' || yr || '-%'
  );
  execute sql into next_number;
  return prefix || '-' || yr || '-' || lpad(next_number::text, 6, '0');
end;
$$;

-- ==========================================
-- 2. TABLE CREATIONS
-- ==========================================

create table public.roles (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (name in ('admin', 'operator')),
  description text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  role_id uuid not null references public.roles(id) on delete cascade,
  full_name text not null,
  email text not null unique,
  phone text,
  status text not null default 'active' check (status in ('active', 'inactive')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table public.permissions (
  id uuid primary key default gen_random_uuid(),
  module text not null,
  action text not null,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (module, action)
);

create table public.role_permissions (
  role_id uuid not null references public.roles(id) on delete cascade,
  permission_id uuid not null references public.permissions(id) on delete cascade,
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (role_id, permission_id)
);

create table public.looms (
  id uuid primary key default gen_random_uuid(),
  loom_number text not null,
  status text not null default 'active' check (status in ('active', 'inactive')),
  description text,
  created_by uuid references public.users(id),
  updated_by uuid references public.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table public.fabric_types (
  id uuid primary key default gen_random_uuid(),
  fabric_name text not null,
  width numeric(10,2) not null check (width > 0),
  gsm numeric(10,2) not null check (gsm > 0),
  selling_price numeric(12,2) not null default 0 check (selling_price >= 0),
  status text not null default 'active' check (status in ('active', 'inactive')),
  description text,
  created_by uuid references public.users(id),
  updated_by uuid references public.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table public.raw_materials (
  id uuid primary key default gen_random_uuid(),
  material_name text not null,
  unit text not null,
  opening_stock numeric(12,3) not null default 0 check (opening_stock >= 0),
  current_stock numeric(12,3) not null default 0 check (current_stock >= 0),
  status text not null default 'active' check (status in ('active', 'inactive')),
  department text not null default 'Fabric',
  critical_level numeric default 0,
  description text,
  created_by uuid references public.users(id),
  updated_by uuid references public.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table public.raw_material_purchases (
  id uuid primary key default gen_random_uuid(),
  purchase_date date not null default current_date,
  raw_material_id uuid not null references public.raw_materials(id) on delete cascade,
  supplier_name text,
  bill_number text,
  quantity numeric(12,3) not null check (quantity > 0),
  rate numeric(12,2) not null default 0 check (rate >= 0),
  total_amount numeric(14,2) generated always as (quantity * rate) stored,
  remarks text,
  created_by uuid references public.users(id),
  updated_by uuid references public.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table public.raw_material_consumptions (
  id uuid primary key default gen_random_uuid(),
  consumption_date date not null default current_date,
  raw_material_id uuid not null references public.raw_materials(id) on delete cascade,
  department text not null,
  quantity numeric(12,3) not null check (quantity > 0),
  remarks text,
  created_by uuid references public.users(id),
  updated_by uuid references public.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table public.settings (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  value jsonb not null default '{}'::jsonb,
  description text,
  created_by uuid references public.users(id),
  updated_by uuid references public.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table public.employees (
  id uuid primary key default gen_random_uuid(),
  employee_code text not null,
  name text not null,
  department text not null,
  designation text not null,
  salary numeric(12,2) not null default 0 check (salary >= 0),
  status text not null default 'active' check (status in ('active', 'inactive')),
  user_id uuid references public.users(id) on delete set null,
  joining_date date,
  shift_start time,
  shift_end time,
  created_by uuid references public.users(id),
  updated_by uuid references public.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table public.attendance (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees(id) on delete cascade,
  attendance_date date not null default current_date,
  check_in time,
  check_out time,
  check_in_at timestamptz,
  check_out_at timestamptz,
  working_hours numeric(8,2) default 0,
  overtime_hours numeric(8,2) default 0,
  status text not null check (status in ('present', 'absent', 'half_day', 'leave')),
  created_by uuid references public.users(id),
  updated_by uuid references public.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table public.customers (
  id uuid primary key default gen_random_uuid(),
  customer_name text not null,
  phone text,
  gst_number text,
  address text,
  status text not null default 'active' check (status in ('active', 'inactive')),
  alias text,
  is_internal text not null default 'client a/c',
  opening_debit numeric(12,2) not null default 0,
  opening_credit numeric(12,2) not null default 0,
  created_by uuid references public.users(id),
  updated_by uuid references public.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table public.loom_production_entries (
  id uuid primary key default gen_random_uuid(),
  entry_date date not null default current_date,
  serial_number text not null,
  fabric_type_id uuid not null references public.fabric_types(id) on delete cascade,
  loom_id uuid not null references public.looms(id) on delete cascade,
  gross_weight numeric(12,3) not null check (gross_weight > 0),
  core_weight numeric(12,3) not null default 0 check (core_weight >= 0),
  net_weight numeric(12,3) generated always as (gross_weight - core_weight) stored,
  initial_meters numeric(12,2) not null default 0 check (initial_meters >= 0),
  end_meters numeric(12,2) not null check (end_meters >= 0),
  net_meters numeric(12,2) generated always as (end_meters - initial_meters) stored,
  average_meter_weight numeric(12,3) generated always as (
    case when (end_meters - initial_meters) > 0
      then ((gross_weight - core_weight) / (end_meters - initial_meters)) * 1000
      else null
    end
  ) stored,
  initial_meter_overridden boolean not null default false,
  remarks text,
  created_by uuid references public.users(id),
  updated_by uuid references public.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  check (gross_weight >= core_weight),
  check (end_meters >= initial_meters)
);

create table public.fabric_rolls (
  id uuid primary key default gen_random_uuid(),
  roll_number text not null,
  production_entry_id uuid not null unique references public.loom_production_entries(id) on delete cascade,
  fabric_type_id uuid not null references public.fabric_types(id) on delete cascade,
  loom_id uuid not null references public.looms(id) on delete cascade,
  weight numeric(12,3) not null check (weight >= 0),
  meters numeric(12,2) not null check (meters >= 0),
  production_date date not null,
  status text not null default 'available' check (status in ('available', 'reserved', 'sold', 'voided')),
  current_stage text not null default 'loom' check (current_stage in ('loom', 'roto_printing', 'lamination', 'finishing', 'offset_printing')),
  created_by uuid references public.users(id),
  updated_by uuid references public.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table public.stage_production_entries (
  id uuid primary key default gen_random_uuid(),
  entry_date date not null default current_date,
  roll_id uuid not null references public.fabric_rolls(id) on delete cascade,
  stage text not null check (stage in ('roto_printing', 'lamination', 'offset_printing', 'finishing')),
  product_id text,
  details jsonb not null default '{}'::jsonb,
  remarks text,
  created_by uuid references public.users(id),
  updated_by uuid references public.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table public.sales_orders (
  id uuid primary key default gen_random_uuid(),
  order_number text not null,
  order_date date not null default current_date,
  customer_id uuid not null references public.customers(id) on delete cascade,
  fabric_type_id uuid references public.fabric_types(id) on delete cascade,
  quantity_meters numeric(12,2) check (quantity_meters > 0),
  rate numeric(12,2) check (rate >= 0),
  total_amount numeric(14,2),
  selected_roll_ids uuid[] not null default '{}',
  status text not null default 'draft' check (status in ('draft', 'confirmed', 'cancelled')),
  bill_number text,
  bill_value numeric(14,2),
  gst_rate numeric(5,2) default 18,
  created_by uuid references public.users(id),
  updated_by uuid references public.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table public.sales_order_items (
  id uuid primary key default gen_random_uuid(),
  sales_order_id uuid not null references public.sales_orders(id) on delete cascade,
  department text not null,
  product_id text not null,
  quantity numeric not null,
  selected_roll_ids uuid[] default '{}'::uuid[],
  price numeric(12,2) default 0
);

create table public.roto_products (
  id uuid primary key default gen_random_uuid(),
  brand text not null,
  width numeric not null,
  height numeric not null,
  num_cylinders integer not null,
  image_url text,
  status text not null default 'active',
  customer_id uuid references public.customers(id) on delete set null
);

create table public.offset_products (
  id uuid primary key default gen_random_uuid(),
  brand text not null,
  width numeric not null,
  height numeric not null,
  image_url text,
  status text not null default 'active',
  customer_id uuid references public.customers(id) on delete set null
);

create table public.roto_colors (
  id uuid primary key default gen_random_uuid(),
  color_name text not null,
  description text,
  status text not null default 'active'
);

create table public.accounts_journal (
  id uuid primary key default gen_random_uuid(),
  entry_date date not null default current_date,
  account_name text not null,
  entry_type text not null check (entry_type in ('debit', 'credit')),
  amount numeric(14,2) not null check (amount >= 0),
  description text,
  journal_no text,
  account_id uuid references public.customers(id) on delete cascade,
  created_by uuid references public.users(id),
  updated_by uuid references public.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table public.material_sales (
  id uuid primary key default gen_random_uuid(),
  sale_date date not null default current_date,
  bill_number text not null,
  customer_id uuid not null references public.customers(id) on delete cascade,
  type text not null check (type in ('raw_material', 'waste')),
  department text,
  raw_material_id uuid references public.raw_materials(id) on delete cascade,
  quantity numeric(12,3) not null check (quantity > 0),
  price numeric(12,2) not null check (price >= 0),
  inc_gst boolean not null default false,
  amount numeric(12,2) not null check (amount >= 0),
  journal_no text,
  created_by uuid references public.users(id) on delete set null,
  updated_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

-- ==========================================
-- 3. SEED DATA INSERTS
-- ==========================================

insert into public.roles (name, description)
values
  ('admin', 'Full ERP access'),
  ('operator', 'Production entry and report access')
on conflict (name) do nothing;

insert into public.customers (customer_name, alias, is_internal, status)
values
  ('Purchase A/c', 'PURCHASE', 'profit and loss a/c', 'active'),
  ('Sales A/c', 'SALES', 'profit and loss a/c', 'active')
on conflict do nothing;

-- ==========================================
-- 4. BUSINESS LOGIC & RPC FUNCTIONS
-- ==========================================

create or replace function public.has_permission(p_permission text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.users u
    join public.role_permissions rp on rp.role_id = u.role_id
    join public.permissions p on p.id = rp.permission_id
    where u.id = auth.uid()
      and u.status = 'active'
      and u.deleted_at is null
      and (p.module || '.' || p.action) = p_permission
      and p.deleted_at is null
  );
$$;

create or replace function public.can_manage_attendance_for(target_employee_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_admin()
    or public.has_permission('employees.view')
    or exists (
      select 1
      from public.employees e
      where e.id = target_employee_id
        and e.user_id = auth.uid()
        and e.status = 'active'
        and e.deleted_at is null
    )
$$;

create or replace function public.get_last_end_meters_by_loom()
returns table (
  loom_id uuid,
  end_meters numeric
)
language sql
stable
security definer
set search_path = public
as $$
  select distinct on (lpe.loom_id)
    lpe.loom_id,
    lpe.end_meters
  from public.loom_production_entries lpe
  where lpe.deleted_at is null
  order by lpe.loom_id, lpe.created_at desc;
$$;

create or replace function public.get_roll_allocations_for_fabric(p_fabric_type_id uuid)
returns table (
  roll_id uuid,
  dispatch_date date,
  client_name text
)
language sql
stable
security definer
set search_path = public
as $$
  select distinct on (allocation.roll_id)
    allocation.roll_id,
    allocation.dispatch_date,
    allocation.client_name
  from (
    select
      fr.id as roll_id,
      so.order_date as dispatch_date,
      coalesce(c.customer_name, 'Unknown') as client_name
    from public.fabric_rolls fr
    join public.sales_orders so on so.selected_roll_ids @> array[fr.id]::uuid[]
    left join public.customers c on c.id = so.customer_id
    where fr.fabric_type_id = p_fabric_type_id
      and fr.deleted_at is null
      and so.deleted_at is null
      and so.status = 'confirmed'

    union all

    select
      fr.id as roll_id,
      so.order_date as dispatch_date,
      coalesce(c.customer_name, 'Unknown') as client_name
    from public.fabric_rolls fr
    join public.sales_order_items soi on soi.selected_roll_ids @> array[fr.id]::uuid[]
    join public.sales_orders so on so.id = soi.sales_order_id
    left join public.customers c on c.id = so.customer_id
    where fr.fabric_type_id = p_fabric_type_id
      and fr.deleted_at is null
      and so.deleted_at is null
      and so.status = 'confirmed'
  ) allocation
  order by allocation.roll_id, allocation.dispatch_date desc;
$$;

create or replace function public.get_dashboard_summary(p_entry_date date)
returns table (
  production_entries bigint,
  total_weight numeric,
  total_meters numeric,
  available_rolls bigint,
  material_stock numeric,
  present_employees bigint
)
language sql
stable
security definer
set search_path = public
as $$
  select
    (select count(*) from public.loom_production_entries where entry_date = p_entry_date and deleted_at is null) as production_entries,
    (select coalesce(sum(net_weight), 0) from public.loom_production_entries where entry_date = p_entry_date and deleted_at is null) as total_weight,
    (select coalesce(sum(net_meters), 0) from public.loom_production_entries where entry_date = p_entry_date and deleted_at is null) as total_meters,
    (select count(*) from public.fabric_rolls where status = 'available' and deleted_at is null) as available_rolls,
    (select coalesce(sum(current_stock), 0) from public.raw_materials where deleted_at is null) as material_stock,
    (select count(*) from public.attendance where attendance_date = p_entry_date and status = 'present' and deleted_at is null) as present_employees;
$$;

create or replace function public.get_daily_fabric_output(p_entry_date date)
returns table (
  name text,
  meters numeric,
  weight numeric
)
language sql
stable
security definer
set search_path = public
as $$
  select
    coalesce(ft.fabric_name, 'Fabric') as name,
    coalesce(sum(lpe.net_meters), 0) as meters,
    coalesce(sum(lpe.net_weight), 0) as weight
  from public.loom_production_entries lpe
  left join public.fabric_types ft on ft.id = lpe.fabric_type_id
  where lpe.entry_date = p_entry_date
    and lpe.deleted_at is null
  group by ft.fabric_name
  order by ft.fabric_name;
$$;

create or replace function public.get_fabric_stock_summary()
returns table (
  fabric_type_id uuid,
  fabric_name text,
  rolls bigint,
  weight numeric,
  meters numeric
)
language sql
stable
security definer
set search_path = public
as $$
  select
    fr.fabric_type_id,
    ft.fabric_name,
    count(*) as rolls,
    coalesce(sum(fr.weight), 0) as weight,
    coalesce(sum(fr.meters), 0) as meters
  from public.fabric_rolls fr
  left join public.fabric_types ft on ft.id = fr.fabric_type_id
  where fr.status = 'available'
    and fr.deleted_at is null
  group by fr.fabric_type_id, ft.fabric_name
  order by ft.fabric_name;
$$;

-- ==========================================
-- 5. TRIGGER FUNCTIONS
-- ==========================================

create or replace function public.prepare_production_entry()
returns trigger
language plpgsql
as $$
declare
  last_end numeric(12,2);
  loom_lock uuid;
  serial_num integer;
begin
  -- Acquire an exclusive row-level lock on the parent loom record for concurrency control.
  select id into loom_lock
  from public.looms
  where id = new.loom_id
  for update;

  -- Generate fabric-specific serial number if not provided
  if new.serial_number is null or new.serial_number = '' then
    select coalesce(max(case when serial_number ~ '^[0-9]+$' then cast(serial_number as integer) else 0 end), 0) + 1 into serial_num
    from public.loom_production_entries
    where fabric_type_id = new.fabric_type_id
      and deleted_at is null;

    new.serial_number := serial_num::text;
  end if;

  if new.entry_date is null then
    new.entry_date := current_date;
  end if;

  select lpe.end_meters into last_end
  from public.loom_production_entries lpe
  where lpe.loom_id = new.loom_id
    and lpe.deleted_at is null
  order by lpe.created_at desc
  limit 1;

  if tg_op = 'INSERT' and not public.is_admin() then
    new.initial_meters := coalesce(last_end, 0);
    new.initial_meter_overridden := false;
  elsif tg_op = 'INSERT' and public.is_admin() then
    if new.initial_meters is null then
      new.initial_meters := coalesce(last_end, 0);
    else
      new.initial_meter_overridden := new.initial_meters is distinct from coalesce(last_end, 0);
    end if;
  elsif tg_op = 'UPDATE' and not public.is_admin() then
    new.initial_meters := old.initial_meters;
    new.initial_meter_overridden := old.initial_meter_overridden;
  end if;

  return new;
end;
$$;

create or replace function public.create_or_sync_fabric_roll()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.fabric_rolls (
      roll_number,
      production_entry_id,
      fabric_type_id,
      loom_id,
      weight,
      meters,
      production_date,
      status,
      current_stage,
      created_by,
      updated_by
    )
    values (
      new.serial_number,
      new.id,
      new.fabric_type_id,
      new.loom_id,
      new.net_weight,
      new.net_meters,
      new.entry_date,
      case when new.deleted_at is null then 'available' else 'voided' end,
      'loom',
      new.created_by,
      new.updated_by
    );
  elsif tg_op = 'UPDATE' then
    update public.fabric_rolls
    set roll_number = new.serial_number,
        fabric_type_id = new.fabric_type_id,
        loom_id = new.loom_id,
        weight = new.net_weight,
        meters = new.net_meters,
        production_date = new.entry_date,
        status = case when new.deleted_at is not null then 'voided' else status end,
        updated_by = new.updated_by,
        updated_at = now(),
        deleted_at = case when new.deleted_at is not null then now() else deleted_at end
    where production_entry_id = new.id;
  end if;

  return new;
end;
$$;

create or replace function public.apply_raw_material_purchase()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'INSERT' then
    update public.raw_materials
    set current_stock = current_stock + new.quantity,
        updated_at = now(),
        updated_by = new.updated_by
    where id = new.raw_material_id;
  elsif tg_op = 'UPDATE' then
    if old.deleted_at is null and new.deleted_at is not null then
      update public.raw_materials
      set current_stock = current_stock - old.quantity,
          updated_at = now(),
          updated_by = new.updated_by
      where id = old.raw_material_id;
    elsif old.deleted_at is not null and new.deleted_at is null then
      update public.raw_materials
      set current_stock = current_stock + new.quantity,
          updated_at = now(),
          updated_by = new.updated_by
      where id = new.raw_material_id;
    elsif new.deleted_at is null then
      update public.raw_materials
      set current_stock = current_stock - old.quantity + new.quantity,
          updated_at = now(),
          updated_by = new.updated_by
      where id = new.raw_material_id;
    end if;
  end if;
  return new;
end;
$$;

create or replace function public.apply_raw_material_consumption()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'INSERT' then
    update public.raw_materials
    set current_stock = current_stock - new.quantity,
        updated_at = now(),
        updated_by = new.updated_by
    where id = new.raw_material_id;
  elsif tg_op = 'UPDATE' then
    if old.deleted_at is null and new.deleted_at is not null then
      update public.raw_materials
      set current_stock = current_stock + old.quantity,
          updated_at = now(),
          updated_by = new.updated_by
      where id = old.raw_material_id;
    elsif old.deleted_at is not null and new.deleted_at is null then
      update public.raw_materials
      set current_stock = current_stock - new.quantity,
          updated_at = now(),
          updated_by = new.updated_by
      where id = new.raw_material_id;
    elsif new.deleted_at is null then
      update public.raw_materials
      set current_stock = current_stock + old.quantity - new.quantity,
          updated_at = now(),
          updated_by = new.updated_by
      where id = new.raw_material_id;
    end if;
  end if;
  return new;
end;
$$;

create or replace function public.apply_stage_production()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'INSERT' then
    update public.fabric_rolls
    set current_stage = new.stage,
        updated_at = now(),
        updated_by = new.updated_by
    where id = new.roll_id;
  elsif tg_op = 'UPDATE' then
    if old.deleted_at is null and new.deleted_at is not null then
      update public.fabric_rolls
      set current_stage = case
            when new.stage = 'finishing' then 'offset_printing'
            when new.stage = 'offset_printing' then 'lamination'
            when new.stage = 'lamination' then 'roto_printing'
            when new.stage = 'roto_printing' then 'loom'
            else 'loom'
          end,
          updated_at = now(),
          updated_by = new.updated_by
      where id = new.roll_id;
    else
      update public.fabric_rolls
      set current_stage = new.stage,
          updated_at = now(),
          updated_by = new.updated_by
      where id = new.roll_id;
    end if;
  end if;
  return new;
end;
$$;

create or replace function public.prepare_sales_order()
returns trigger
language plpgsql
as $$
begin
  if new.order_number is null or new.order_number = '' then
    new.order_number = public.next_year_number('ORD', 'sales_orders', 'order_number');
  end if;
  if new.order_date is null then
    new.order_date = current_date;
  end if;
  return new;
end;
$$;

create or replace function public.sync_rolls_for_sales_order()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'UPDATE' and old.status = 'confirmed' and new.status <> 'confirmed' then
    update public.fabric_rolls
    set status = 'available', updated_at = now(), updated_by = new.updated_by
    where id = any(old.selected_roll_ids)
      and status = 'sold';
  end if;

  if new.status = 'confirmed' then
    update public.fabric_rolls
    set status = 'sold', updated_at = now(), updated_by = new.updated_by
    where id = any(new.selected_roll_ids)
      and deleted_at is null;
  elsif new.status = 'cancelled' then
    update public.fabric_rolls
    set status = 'available', updated_at = now(), updated_by = new.updated_by
    where id = any(new.selected_roll_ids)
      and status <> 'voided'
      and deleted_at is null;
  end if;

  return new;
end;
$$;

create or replace function public.calculate_attendance()
returns trigger
language plpgsql
as $$
declare
  employee_shift_end time;
  local_check_in timestamp;
  local_check_out timestamp;
  hours_worked numeric(8,2);
  shift_end_at timestamptz;
begin
  if new.check_in_at is not null then
    local_check_in = new.check_in_at at time zone 'Asia/Kolkata';
    new.check_in = local_check_in::time(0);
    new.attendance_date = local_check_in::date;
  end if;

  if new.check_out_at is not null and new.check_in_at is not null and new.check_out_at <= new.check_in_at then
    raise exception 'Check out time must be after check in time.';
  end if;

  if new.check_out_at is not null then
    local_check_out = new.check_out_at at time zone 'Asia/Kolkata';
    new.check_out = local_check_out::time(0);
  else
    new.check_out = null;
  end if;

  if new.check_in_at is not null and new.check_out_at is not null then
    hours_worked = round((extract(epoch from (new.check_out_at - new.check_in_at)) / 3600)::numeric, 2);

    select shift_end into employee_shift_end
    from public.employees
    where id = new.employee_id;

    shift_end_at = ((new.attendance_date + coalesce(employee_shift_end, '18:00'::time)) at time zone 'Asia/Kolkata');

    new.working_hours = hours_worked;
    new.overtime_hours = greatest(round((extract(epoch from (new.check_out_at - shift_end_at)) / 3600)::numeric, 2), 0);
    new.status = case
      when hours_worked < 4 then 'half_day'
      else 'present'
    end;
  elsif new.check_in_at is not null then
    new.working_hours = 0;
    new.overtime_hours = 0;
    new.status = 'present';
  else
    new.working_hours = 0;
    new.overtime_hours = 0;
    new.status = 'absent';
  end if;

  return new;
end;
$$;

create or replace function public.apply_material_sales_stock()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'INSERT' then
    if new.deleted_at is null and new.type = 'raw_material' and new.raw_material_id is not null then
      update public.raw_materials
      set current_stock = current_stock - new.quantity,
          updated_at = now(),
          updated_by = new.updated_by
      where id = new.raw_material_id;
    end if;
  elsif tg_op = 'UPDATE' then
    -- If soft-deleted
    if old.deleted_at is null and new.deleted_at is not null then
      if old.type = 'raw_material' and old.raw_material_id is not null then
        update public.raw_materials
        set current_stock = current_stock + old.quantity,
            updated_at = now(),
            updated_by = new.updated_by
        where id = old.raw_material_id;
      end if;
    -- If restored
    elsif old.deleted_at is not null and new.deleted_at is null then
      if new.type = 'raw_material' and new.raw_material_id is not null then
        update public.raw_materials
        set current_stock = current_stock - new.quantity,
            updated_at = now(),
            updated_by = new.updated_by
        where id = new.raw_material_id;
      end if;
    -- Normal update
    elsif new.deleted_at is null then
      if old.raw_material_id = new.raw_material_id then
        if new.type = 'raw_material' and new.raw_material_id is not null then
          update public.raw_materials
          set current_stock = current_stock + old.quantity - new.quantity,
              updated_at = now(),
              updated_by = new.updated_by
          where id = new.raw_material_id;
        end if;
      else
        if old.type = 'raw_material' and old.raw_material_id is not null then
          update public.raw_materials
          set current_stock = current_stock + old.quantity,
              updated_at = now(),
              updated_by = old.updated_by
          where id = old.raw_material_id;
        end if;
        if new.type = 'raw_material' and new.raw_material_id is not null then
          update public.raw_materials
          set current_stock = current_stock - new.quantity,
              updated_at = now(),
              updated_by = new.updated_by
          where id = new.raw_material_id;
        end if;
      end if;
    end if;
  elsif tg_op = 'DELETE' then
    if old.deleted_at is null and old.type = 'raw_material' and old.raw_material_id is not null then
      update public.raw_materials
      set current_stock = current_stock + old.quantity,
          updated_at = now(),
          updated_by = old.updated_by
      where id = old.raw_material_id;
    end if;
  end if;
  return new;
end;
$$;

-- ==========================================
-- 6. TRIGGERS ATTACHMENT
-- ==========================================

create trigger touch_roles before update on public.roles for each row execute function public.touch_updated_at();
create trigger touch_users before update on public.users for each row execute function public.touch_updated_at();
create trigger touch_looms before update on public.looms for each row execute function public.touch_updated_at();
create trigger touch_fabric_types before update on public.fabric_types for each row execute function public.touch_updated_at();
create trigger touch_raw_materials before update on public.raw_materials for each row execute function public.touch_updated_at();
create trigger touch_raw_material_purchases before update on public.raw_material_purchases for each row execute function public.touch_updated_at();
create trigger touch_raw_material_consumptions before update on public.raw_material_consumptions for each row execute function public.touch_updated_at();
create trigger touch_settings before update on public.settings for each row execute function public.touch_updated_at();
create trigger touch_employees before update on public.employees for each row execute function public.touch_updated_at();
create trigger touch_attendance before update on public.attendance for each row execute function public.touch_updated_at();
create trigger touch_customers before update on public.customers for each row execute function public.touch_updated_at();
create trigger touch_production before update on public.loom_production_entries for each row execute function public.touch_updated_at();
create trigger touch_rolls before update on public.fabric_rolls for each row execute function public.touch_updated_at();
create trigger touch_stage_production before update on public.stage_production_entries for each row execute function public.touch_updated_at();
create trigger touch_sales before update on public.sales_orders for each row execute function public.touch_updated_at();
create trigger touch_journal before update on public.accounts_journal for each row execute function public.touch_updated_at();
create trigger touch_material_sales before update on public.material_sales for each row execute function public.touch_updated_at();

create trigger prepare_production before insert or update on public.loom_production_entries for each row execute function public.prepare_production_entry();
create trigger production_creates_roll after insert or update on public.loom_production_entries for each row execute function public.create_or_sync_fabric_roll();
create trigger prepare_sales before insert on public.sales_orders for each row execute function public.prepare_sales_order();
create trigger sales_sync_rolls after insert or update on public.sales_orders for each row execute function public.sync_rolls_for_sales_order();
create trigger raw_purchase_updates_stock after insert or update on public.raw_material_purchases for each row execute function public.apply_raw_material_purchase();
create trigger raw_consumption_updates_stock after insert or update on public.raw_material_consumptions for each row execute function public.apply_raw_material_consumption();
create trigger stage_production_updates_roll after insert or update on public.stage_production_entries for each row execute function public.apply_stage_production();
create trigger attendance_calculations before insert or update on public.attendance for each row execute function public.calculate_attendance();
create trigger material_sales_updates_stock after insert or update or delete on public.material_sales for each row execute function public.apply_material_sales_stock();

-- ==========================================
-- 7. SECURITY & ROW LEVEL SECURITY (RLS) POLICIES
-- ==========================================

alter table public.roles enable row level security;
alter table public.users enable row level security;
alter table public.permissions enable row level security;
alter table public.role_permissions enable row level security;
alter table public.looms enable row level security;
alter table public.fabric_types enable row level security;
alter table public.raw_materials enable row level security;
alter table public.raw_material_purchases enable row level security;
alter table public.raw_material_consumptions enable row level security;
alter table public.settings enable row level security;
alter table public.employees enable row level security;
alter table public.attendance enable row level security;
alter table public.customers enable row level security;
alter table public.loom_production_entries enable row level security;
alter table public.fabric_rolls enable row level security;
alter table public.stage_production_entries enable row level security;
alter table public.sales_orders enable row level security;
alter table public.sales_order_items enable row level security;
alter table public.roto_products enable row level security;
alter table public.offset_products enable row level security;
alter table public.roto_colors enable row level security;
alter table public.accounts_journal enable row level security;
alter table public.material_sales enable row level security;

create policy "roles readable by permitted users" on public.roles for select using (deleted_at is null and (public.has_permission('roles.view') or exists (select 1 from public.users u where u.id = auth.uid() and u.role_id = roles.id)));
create policy "roles permission write" on public.roles for all using (public.is_admin() or public.has_permission('roles.edit') or public.has_permission('roles.delete')) with check (public.is_admin() or public.has_permission('roles.create') or public.has_permission('roles.edit'));

create policy "users read own or permitted" on public.users for select using (id = auth.uid() or public.is_admin() or public.has_permission('users.view'));
create policy "users admin insert" on public.users for insert with check (public.is_admin());
create policy "users admin update" on public.users for update using (public.is_admin()) with check (public.is_admin());

create policy "permissions role managers write" on public.permissions for all using (public.is_admin() or public.has_permission('roles.edit')) with check (public.is_admin() or public.has_permission('roles.edit'));

create policy "role permissions role managers write" on public.role_permissions for all using (public.is_admin() or public.has_permission('roles.edit')) with check (public.is_admin() or public.has_permission('roles.edit'));
create policy "role permissions readable by permitted users" on public.role_permissions for select using (public.has_permission('roles.view') or exists (select 1 from public.users u where u.id = auth.uid() and u.role_id = role_permissions.role_id));

create policy "looms read permitted users" on public.looms for select using (deleted_at is null and (public.has_permission('looms.view') or public.has_permission('production.view') or public.has_permission('reports.view') or public.has_permission('dashboard.view')));
create policy "looms permission write" on public.looms for all using (public.is_admin() or public.has_permission('looms.edit') or public.has_permission('looms.delete')) with check (public.is_admin() or public.has_permission('looms.create') or public.has_permission('looms.edit'));

create policy "fabric types read permitted users" on public.fabric_types for select using (deleted_at is null and (public.has_permission('fabric_types.view') or public.has_permission('production.view') or public.has_permission('sales.view') or public.has_permission('reports.view') or public.has_permission('dashboard.view')));
create policy "fabric types permission write" on public.fabric_types for all using (public.is_admin() or public.has_permission('fabric_types.edit') or public.has_permission('fabric_types.delete')) with check (public.is_admin() or public.has_permission('fabric_types.create') or public.has_permission('fabric_types.edit'));

create policy "raw materials read permitted users" on public.raw_materials for select using (deleted_at is null and (public.has_permission('raw_materials.view') or public.has_permission('reports.view') or public.has_permission('dashboard.view')));
create policy "raw materials permission write" on public.raw_materials for all using (public.is_admin() or public.has_permission('raw_materials.edit') or public.has_permission('raw_materials.delete')) with check (public.is_admin() or public.has_permission('raw_materials.create') or public.has_permission('raw_materials.edit'));

create policy "raw purchases read permitted users" on public.raw_material_purchases for select using (deleted_at is null and (public.has_permission('raw_materials.view') or public.has_permission('reports.view')));
create policy "raw purchases permission write" on public.raw_material_purchases for all using (public.is_admin() or public.has_permission('raw_materials.edit')) with check (public.is_admin() or public.has_permission('raw_materials.edit'));

create policy "Allow read access to permitted users on raw_material_consumptions" on public.raw_material_consumptions for select to authenticated using (public.has_permission('production.view') or public.has_permission('raw_materials.view') or public.has_permission('reports.view') or public.is_admin());
create policy "Allow write access to permitted users on raw_material_consumptions" on public.raw_material_consumptions for all to authenticated using (public.has_permission('production.edit') or public.has_permission('raw_materials.edit') or public.is_admin()) with check (public.has_permission('production.edit') or public.has_permission('raw_materials.edit') or public.is_admin());

create policy "settings read active users" on public.settings for select using (auth.uid() is not null and deleted_at is null);
create policy "settings admin write" on public.settings for all using (public.is_admin()) with check (public.is_admin());

create policy "employees read permission scoped" on public.employees for select using (deleted_at is null and (public.has_permission('employees.view') or (public.has_permission('attendance.view') and public.can_manage_attendance_for(id)) or user_id = auth.uid()));
create policy "employees permission write" on public.employees for all using (public.is_admin() or public.has_permission('employees.edit') or public.has_permission('employees.delete')) with check (public.is_admin() or public.has_permission('employees.create') or public.has_permission('employees.edit'));

create policy "attendance read permission scoped" on public.attendance for select using (public.has_permission('attendance.view') and public.can_manage_attendance_for(employee_id));
create policy "attendance insert permission scoped" on public.attendance for insert with check (public.has_permission('attendance.create') and public.can_manage_attendance_for(employee_id));
create policy "attendance update permission scoped" on public.attendance for update using (public.has_permission('attendance.edit') and public.can_manage_attendance_for(employee_id)) with check (public.has_permission('attendance.edit') and public.can_manage_attendance_for(employee_id));

create policy "customers read permitted users" on public.customers for select using (deleted_at is null and (public.has_permission('customers.view') or public.has_permission('sales.view') or public.has_permission('reports.view')));
create policy "customers permission write" on public.customers for all using (public.is_admin() or public.has_permission('customers.edit') or public.has_permission('customers.delete')) with check (public.is_admin() or public.has_permission('customers.create') or public.has_permission('customers.edit'));

create policy "production read permitted users" on public.loom_production_entries for select using (deleted_at is null and (public.has_permission('production.view') or public.has_permission('reports.view') or public.has_permission('dashboard.view')));
create policy "production insert admin operator" on public.loom_production_entries for insert with check ((public.is_admin() or public.is_operator()) and created_by = auth.uid());
create policy "production update admin anytime operator own 12h" on public.loom_production_entries for update using (public.is_admin() or (public.is_operator() and created_by = auth.uid() and created_at >= now() - interval '12 hours')) with check (public.is_admin() or (public.is_operator() and created_by = auth.uid() and created_at >= now() - interval '12 hours'));

create policy "rolls read permitted users" on public.fabric_rolls for select using (deleted_at is null and (public.has_permission('rolls.view') or public.has_permission('sales.view') or public.has_permission('reports.view') or public.has_permission('dashboard.view')));
create policy "rolls permission write" on public.fabric_rolls for all using (public.is_admin() or public.has_permission('production.edit')) with check (public.is_admin() or public.has_permission('production.create') or public.has_permission('production.edit'));

create policy "Allow read access to permitted users on stage_production_entries" on public.stage_production_entries for select to authenticated using (public.has_permission('production.view') or public.has_permission('rolls.view') or public.has_permission('reports.view') or public.is_admin());
create policy "Allow write access to permitted users on stage_production_entries" on public.stage_production_entries for all to authenticated using (public.has_permission('production.edit') or public.is_admin()) with check (public.has_permission('production.edit') or public.is_admin());

create policy "sales read permitted users" on public.sales_orders for select using (deleted_at is null and (public.has_permission('sales.view') or public.has_permission('reports.view')));
create policy "sales permission write" on public.sales_orders for all using (public.is_admin() or public.has_permission('sales.edit')) with check (public.is_admin() or public.has_permission('sales.create') or public.has_permission('sales.edit'));

create policy "Allow read access to authenticated users on sales_order_items" on public.sales_order_items for select to authenticated using (public.has_permission('sales.view') or public.has_permission('sales.edit') or public.has_permission('sales.create') or public.is_admin());
create policy "Allow write access to authenticated users on sales_order_items" on public.sales_order_items for all to authenticated using (public.has_permission('sales.edit') or public.has_permission('sales.create') or public.is_admin()) with check (public.has_permission('sales.edit') or public.has_permission('sales.create') or public.is_admin());

create policy "Allow read access to authenticated users on roto_products" on public.roto_products for select to authenticated using (true);
create policy "Allow write access to admins on roto_products" on public.roto_products for all to authenticated using (auth.uid() in (select u.id from public.users u join public.roles r on u.role_id = r.id where r.name = 'admin'));

create policy "Allow read access to authenticated users on offset_products" on public.offset_products for select to authenticated using (true);
create policy "Allow write access to admins on offset_products" on public.offset_products for all to authenticated using (auth.uid() in (select u.id from public.users u join public.roles r on u.role_id = r.id where r.name = 'admin'));

create policy "Allow read access to authenticated users on roto_colors" on public.roto_colors for select to authenticated using (true);
create policy "Allow write access to admins on roto_colors" on public.roto_colors for all to authenticated using (auth.uid() in (select u.id from public.users u join public.roles r on u.role_id = r.id where r.name = 'admin'));

create policy "Allow read access to permitted users on accounts_journal" on public.accounts_journal for select to authenticated using (public.has_permission('sales.view') or public.has_permission('reports.view') or public.is_admin());
create policy "Allow write access to permitted users on accounts_journal" on public.accounts_journal for all to authenticated using (public.has_permission('sales.edit') or public.is_admin()) with check (public.has_permission('sales.edit') or public.is_admin());

create policy "Allow read access to permitted users on material_sales" on public.material_sales for select to authenticated using (public.is_admin() or public.has_permission('sales.view'));
create policy "Allow write access to permitted users on material_sales" on public.material_sales for all to authenticated using (public.is_admin() or public.has_permission('sales.create') or public.has_permission('sales.edit')) with check (public.is_admin() or public.has_permission('sales.create') or public.has_permission('sales.edit'));

-- ==========================================
-- 8. INDEXES DEFINITIONS
-- ==========================================

create index if not exists idx_looms_active on public.looms (status) where deleted_at is null;
create index if not exists idx_fabric_types_active on public.fabric_types (status) where deleted_at is null;
create index if not exists idx_raw_materials_status_name on public.raw_materials (status, material_name) where deleted_at is null;
create index if not exists idx_raw_material_purchases_date on public.raw_material_purchases (purchase_date desc) where deleted_at is null;
create index if not exists idx_production_recent on public.loom_production_entries (created_at desc) where deleted_at is null;
create index if not exists idx_rolls_fabric_status on public.fabric_rolls (fabric_type_id, status) where deleted_at is null;
create index if not exists idx_sales_date on public.sales_orders (order_date desc) where deleted_at is null;
create index if not exists idx_attendance_date on public.attendance (attendance_date desc) where deleted_at is null;
create unique index if not exists idx_employees_user_id on public.employees (user_id) where user_id is not null and deleted_at is null;
create index if not exists idx_employees_status_name on public.employees (status, name) where deleted_at is null;
create index if not exists idx_attendance_date_employee on public.attendance (attendance_date desc, employee_id) where deleted_at is null;
create index if not exists idx_production_entry_date on public.loom_production_entries (entry_date desc) where deleted_at is null;
create index if not exists idx_sales_order_date_status on public.sales_orders (order_date desc, status) where deleted_at is null;
create index if not exists idx_roto_products_brand on public.roto_products (brand);
create index if not exists idx_offset_products_brand on public.offset_products (brand);
create index if not exists idx_raw_materials_name on public.raw_materials (material_name) where deleted_at is null;
create index if not exists idx_employees_name on public.employees (name) where deleted_at is null;
create index if not exists idx_sales_orders_billing_status_date on public.sales_orders (status, bill_number, order_date desc) where deleted_at is null;
create index if not exists idx_accounts_journal_account_id on public.accounts_journal (account_id) where deleted_at is null;
create index if not exists idx_raw_material_purchases_material on public.raw_material_purchases(raw_material_id) where deleted_at is null;
create index if not exists idx_loom_production_entries_fabric on public.loom_production_entries(fabric_type_id) where deleted_at is null;
create index if not exists idx_sales_order_items_order on public.sales_order_items(sales_order_id);
create index if not exists idx_role_permissions_role on public.role_permissions (role_id);
create index if not exists idx_users_auth_lookup on public.users (id, role_id, status) where deleted_at is null;
create index if not exists idx_sales_order_items_roll_ids on public.sales_order_items using gin (selected_roll_ids);
create index if not exists idx_sales_orders_roll_ids on public.sales_orders using gin (selected_roll_ids) where deleted_at is null and status = 'confirmed';
create index if not exists idx_production_loom_created on public.loom_production_entries (loom_id, created_at desc) where deleted_at is null;
create index if not exists idx_raw_materials_department on public.raw_materials (department, material_name) where deleted_at is null;
create index if not exists idx_sales_orders_customer on public.sales_orders(customer_id) where deleted_at is null;

-- Soft delete constraints unique indexes
create unique index if not exists idx_looms_loom_number_unique on public.looms (loom_number) where deleted_at is null;
create unique index if not exists idx_raw_materials_material_name_unique on public.raw_materials (material_name) where deleted_at is null;
create unique index if not exists idx_employees_employee_code_unique on public.employees (employee_code) where deleted_at is null;
create unique index if not exists idx_attendance_employee_date_unique on public.attendance (employee_id, attendance_date) where deleted_at is null;

-- Fabric-specific unique indexes for plain integer serials
create unique index if not exists uq_lpe_fabric_type_serial on public.loom_production_entries (fabric_type_id, serial_number) where deleted_at is null;
create unique index if not exists uq_rolls_fabric_type_serial on public.fabric_rolls (fabric_type_id, roll_number) where deleted_at is null;
