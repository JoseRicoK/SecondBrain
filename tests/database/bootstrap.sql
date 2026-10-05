begin;
create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;
create schema auth;
create table auth.users (id uuid primary key,email text,raw_user_meta_data jsonb not null default '{}',created_at timestamptz default now(),last_sign_in_at timestamptz,email_confirmed_at timestamptz);
create function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
$$;
grant usage on schema public, auth to anon, authenticated, service_role;
grant execute on function auth.uid() to anon, authenticated, service_role;

create schema test;
create table test.results (name text not null);
create function test.ok(condition boolean, name text) returns void language plpgsql as $$
begin
  if condition is distinct from true then raise exception 'FAILED: %', name; end if;
  insert into test.results values (name);
end;
$$;
create function test.raises(statement text, expected text, name text) returns void language plpgsql as $$
declare actual text;
begin
  begin execute statement;
  exception when others then get stacked diagnostics actual = returned_sqlstate;
  end;
  perform test.ok(actual = expected, name || ' SQLSTATE=' || coalesce(actual, 'no error'));
end;
$$;
grant usage on schema test to anon, authenticated, service_role;
grant execute on all functions in schema test to anon, authenticated, service_role;
grant insert, select on test.results to anon, authenticated, service_role;
