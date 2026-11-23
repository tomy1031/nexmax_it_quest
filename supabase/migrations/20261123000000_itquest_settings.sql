-- NEXMAX IT QUEST の設定（アプリ全体で1行だけ）。academy と同じ Supabase のプロジェクトに置く。
-- 名前の頭を itquest_ にして、academy の表（app_settings・quest_saves など）と まざらないようにする。
--
-- 読む: だれでも（ログインしていない人も。先生の名前は ゲームの中で みんなに 出る）
-- 書く: 管理者だけ（academy と同じ印 = public.profiles.is_admin。public.is_admin() で見る）

create table if not exists public.itquest_settings (
  id boolean primary key default true check (id),
  -- 「今後の ことに ついては ○○先生から」の ○○（tomy さん 2026-11-23。いまは 冨永先生）
  teacher_name text not null default '冨永',
  -- 先生の名前の読み（ふりがなに使う。ひらがな）
  teacher_reading text not null default 'とみなが',
  updated_by uuid references auth.users (id) on delete set null,
  updated_at timestamptz not null default now()
);

comment on table public.itquest_settings is
  'NEXMAX IT QUEST（3D の アプリ）の 全体の 設定。1行だけ。読むのは だれでも、書くのは 管理者（profiles.is_admin）だけ。';

alter table public.itquest_settings enable row level security;

drop policy if exists itquest_settings_select_all on public.itquest_settings;
create policy itquest_settings_select_all on public.itquest_settings
  for select to anon, authenticated using (true);

drop policy if exists itquest_settings_insert_admin on public.itquest_settings;
create policy itquest_settings_insert_admin on public.itquest_settings
  for insert to authenticated with check ((select public.is_admin()));

drop policy if exists itquest_settings_update_admin on public.itquest_settings;
create policy itquest_settings_update_admin on public.itquest_settings
  for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));

-- 書いた人と時刻は DB が押す（端末の申告を使わない）
create or replace function public.itquest_settings_stamp()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_by := auth.uid();
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists itquest_settings_stamp on public.itquest_settings;
create trigger itquest_settings_stamp
  before insert or update on public.itquest_settings
  for each row execute function public.itquest_settings_stamp();

insert into public.itquest_settings (id) values (true) on conflict (id) do nothing;
