begin;

create table public.person_information_repair_backups (
  user_id uuid not null references public.profiles(uid) on delete cascade,
  person_id uuid not null,
  recorded_at timestamptz not null default now(),
  details jsonb not null,
  mention_count integer,
  primary key(user_id,person_id)
);
alter table public.person_information_repair_backups enable row level security;
revoke all on table public.person_information_repair_backups from public,anon,authenticated,service_role;
grant select,insert on table public.person_information_repair_backups to service_role;

create function public.person_detail_value_key(p_value text) returns text
language sql immutable strict set search_path = '' as $$
  select lower(regexp_replace(regexp_replace(btrim(normalize(p_value,NFC)), '\s+', ' ', 'g'), '[.!;,]+$', ''));
$$;

create function public.normalize_person_details(p_details jsonb) returns jsonb
language sql immutable set search_path = '' as $$
  with categories as (
    select case translate(lower(btrim(key)), 'áéíóúñ', 'aeioun')
      when 'role' then 'rol' when 'relationship' then 'relacion'
      when 'details' then 'detalles' when 'cumpleanos' then 'cumpleaños'
      when 'birthday' then 'cumpleaños' when 'address' then 'direccion'
      else translate(lower(btrim(key)), 'áéíóúñ', 'aeioun') end as category,
      key as original_key, value
    from jsonb_each(case when jsonb_typeof(p_details)='object' then p_details else '{}'::jsonb end)
  ), expanded as (
    select category, original_key, item, ordinal from categories,
      lateral jsonb_array_elements(case
        when jsonb_typeof(value->'entries')='array' then value->'entries'
        when jsonb_typeof(value)='array' then value
        else jsonb_build_array(value) end) with ordinality as e(item, ordinal)
    where category not in ('','__proto__','constructor','prototype') and category not like '%\_textarea' and category not like '%\_input'
  ), cleaned as (
    select category, original_key, ordinal,
      regexp_replace(btrim(normalize(case when jsonb_typeof(item)='string' then item#>>'{}' else item->>'value' end,NFC)), '\s+', ' ', 'g') as value,
      case when jsonb_typeof(item->'date')='string' then item->>'date' else '' end as date
    from expanded where jsonb_typeof(item)='string' or jsonb_typeof(item->'value')='string'
  ), valid as (
    select *,public.person_detail_value_key(value) as identity from cleaned
    where public.person_detail_value_key(value)<>'' and not (
      category in ('rol','relacion','cumpleaños','direccion') and public.person_detail_value_key(value) in
      ('desconocido','desconocida','unknown','n/a','no especificado','no especificada','no mencionado','no mencionada','sin información','sin informacion'))
  ), exact_unique as (
    select *,row_number() over(partition by category,date,identity order by original_key,ordinal) as duplicate from valid
  ), timeline as (
    select *,lag(identity) over(partition by category order by date,original_key,ordinal) as previous
    from exact_unique where duplicate=1
  ), grouped as (
    select category,jsonb_build_object('entries',jsonb_agg(jsonb_build_object('value',value,'date',date) order by date,original_key,ordinal)) as value
    from timeline where category not in ('rol','relacion','cumpleaños','direccion') or identity is distinct from previous
    group by category
  ) select coalesce(jsonb_object_agg(category,value),'{}'::jsonb) from grouped;
$$;

-- Trigger has no direct API execute grant; all reads use the row's owner.
create function public.enforce_person_information() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if current_setting('role',true) in ('anon','authenticated') and auth.uid() is distinct from new.user_id then raise insufficient_privilege; end if;
  new.name := regexp_replace(btrim(normalize(new.name,NFC)), '\s+', ' ', 'g');
  if new.name='' then raise exception 'A person name is required' using errcode='23514'; end if;
  new.details := public.normalize_person_details(new.details);
  select count(*) into new.mention_count from public.diary_entries d
    where d.user_id=new.user_id and exists (
      select 1 from unnest(d.mentioned_people) n
      where lower(regexp_replace(btrim(n),'\s+',' ','g'))=lower(new.name));
  -- Server timestamp is the optimistic concurrency version, including sub-ms writes.
  new.updated_at := clock_timestamp();
  return new;
end;
$$;
create trigger people_information_integrity before insert or update on public.people
for each row execute function public.enforce_person_information();

create function public.refresh_diary_person_mentions() returns trigger
language plpgsql security definer set search_path = '' as $$
declare owner_id uuid; affected text[];
begin
  if tg_op='INSERT' then owner_id:=new.user_id; affected:=new.mentioned_people;
  elsif tg_op='DELETE' then owner_id:=old.user_id; affected:=old.mentioned_people;
  else
    if new.mentioned_people is not distinct from old.mentioned_people then return new; end if;
    owner_id:=new.user_id; affected:=coalesce(old.mentioned_people,'{}') || coalesce(new.mentioned_people,'{}');
  end if;
  if current_setting('role',true) in ('anon','authenticated') and auth.uid() is distinct from owner_id then raise insufficient_privilege; end if;
  update public.people p set mention_count=p.mention_count where p.user_id=owner_id and exists (
    select 1 from unnest(affected) n where lower(regexp_replace(btrim(n),'\s+',' ','g'))=lower(p.name));
  return coalesce(new,old);
end;
$$;
create trigger diary_person_mentions after insert or update of mentioned_people or delete on public.diary_entries
for each row execute function public.refresh_diary_person_mentions();

-- Rename references in the same transaction; an edited display name must not
-- detach its historical diary mentions or change another owner's references.
create function public.rename_diary_person_mentions() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if current_setting('role',true) in ('anon','authenticated') and auth.uid() is distinct from new.user_id then raise insufficient_privilege; end if;
  update public.diary_entries d set mentioned_people=array(
    select case when lower(regexp_replace(btrim(n),'\s+',' ','g'))=lower(old.name) then new.name else n end
    from unnest(d.mentioned_people) n
  ) where d.user_id=new.user_id and exists (
    select 1 from unnest(d.mentioned_people) n where lower(regexp_replace(btrim(n),'\s+',' ','g'))=lower(old.name));
  return new;
end;
$$;
create trigger people_rename_mentions after update of name on public.people
for each row when (old.name is distinct from new.name) execute function public.rename_diary_person_mentions();

revoke all on function public.person_detail_value_key(text), public.normalize_person_details(jsonb),
  public.enforce_person_information(), public.refresh_diary_person_mentions(), public.rename_diary_person_mentions() from public,anon,authenticated,service_role;
grant execute on function public.person_detail_value_key(text), public.normalize_person_details(jsonb) to service_role;

-- No historical data is discarded by installation. Existing rows are repaired
-- separately, after an owner-scoped preview and a recoverable backup.
create unique index people_owner_normalized_name_key on public.people(user_id,lower(regexp_replace(btrim(name),'\s+',' ','g')));
commit;
