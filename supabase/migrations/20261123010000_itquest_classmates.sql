-- 入社式の 会場の 席に、同じ 学校・期生の メンバーを 座らせる（tomy さん 2026-11-23
-- 「席はすでに登録されているメンバーが表示されるようにできますか？」「ユーザーテーブルは旧のシステムと共有でお願いします」
-- 「設定のところでauPP、CA DTの一期生から5期生まで選べるようにして、自分と同じ人を表示したいです」）。
--
-- ユーザーの表は academy と 同じ public.profiles（名前・呼び名・学校 university・期生 cohort・せいべつ）。
-- このアプリだけの もの（3D の アバター）は itquest_avatars に置く。

-- ── アバター（本人だけが 読み書き。ほかの人の分は 下の 関数だけが 返す） ──
create table if not exists public.itquest_avatars (
  profile_id uuid primary key references auth.users (id) on delete cascade,
  avatar jsonb not null check (jsonb_typeof(avatar) = 'object' and pg_column_size(avatar) < 4000),
  updated_at timestamptz not null default now()
);

comment on table public.itquest_avatars is
  'NEXMAX IT QUEST の 3D の アバター（着がえの 設定）。1人 1行。本人だけが 読み書きし、同じ 組の 人には itquest_classmates() が 返す。';

alter table public.itquest_avatars enable row level security;

drop policy if exists itquest_avatars_select_own on public.itquest_avatars;
create policy itquest_avatars_select_own on public.itquest_avatars
  for select to authenticated using (profile_id = (select auth.uid()));

drop policy if exists itquest_avatars_insert_own on public.itquest_avatars;
create policy itquest_avatars_insert_own on public.itquest_avatars
  for insert to authenticated with check (profile_id = (select auth.uid()));

drop policy if exists itquest_avatars_update_own on public.itquest_avatars;
create policy itquest_avatars_update_own on public.itquest_avatars
  for update to authenticated
  using (profile_id = (select auth.uid()))
  with check (profile_id = (select auth.uid()));

-- ── 同じ 組（学校 × 期生）の メンバー ──
-- 返すのは 呼び名・せいべつ・アバターだけ（メールや 名前の フルは 返さない）。
-- 自分の 学校と 期生が 決まっていない とき・講師・スタッフの ときは 何も 返さない。
create or replace function public.itquest_classmates()
returns table (id uuid, display_name text, gender text, avatar jsonb)
language sql
stable
security definer
set search_path = ''
as $$
  select
    p.id,
    coalesce(nullif(p.display_name, ''), nullif(p.nickname, ''), nullif(p.given_name, ''), p.family_name) as display_name,
    p.gender,
    a.avatar
  from public.profiles me
  join public.profiles p
    on p.university = me.university
   and p.cohort = me.cohort
   and p.id <> me.id
  left join public.itquest_avatars a on a.profile_id = p.id
  where me.id = (select auth.uid())
    and me.university in ('AUPP', 'CADT')
    and me.cohort between 1 and 5
  order by p.created_at
  limit 40;
$$;

revoke all on function public.itquest_classmates() from public;
revoke all on function public.itquest_classmates() from anon;
grant execute on function public.itquest_classmates() to authenticated;
