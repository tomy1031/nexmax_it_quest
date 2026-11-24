-- ステージ2の チームの 保存（docs/design/03_ステージ2.md §2「チームのデータの持ち方」）。
-- 1台の パソコンを 1〜4人で 囲んで 遊ぶ。ステージ ＋ メンバーの 組で 1行を 共有する。
-- academy の quest_saves と 同じ 考え方（あちらの マイグレーション 20260831190000_quest_saves.sql）。
--
-- ## まだ DB には 入れない
-- tomy さんの OK と、Supabase が 動くことが 要る。入れる 前は、アプリは 端末（localStorage）だけで 遊ぶ
-- （表が 無い ときの エラー 42P01 / PGRST205 は アプリが 飲みこむ。src/lib/team/sync.ts）。
--
-- ## 1人1行では ない
-- メンバー全員が 同じ 1行を 読み書きする。所有者を 1人に 決められないので、member_ids の 配列で 持ち、
-- 「その 配列に 自分が いるか」で 決める。
--
-- ## 同じ 組なら 同じ 行
-- public.quest_member_key()（academy が 作った、並べ替えて つないだ 鍵を 返す 関数。同じ DB に もう ある）を
-- 式インデックスに 使う。えらぶ 順が ちがっても、同じ 組なら 同じ 行に 戻る。
--
-- ## 負荷
-- 書くのは 節目だけ（ミーティングが 終わった とき など）。こまかい 進みは 端末に 置く。
-- ニックネームだけの 人が 入っている 組は、DB に 書かない（id が 無いので）。

begin;

create table if not exists public.itquest_team_saves (
  id uuid primary key default gen_random_uuid(),
  stage_id text not null,
  -- 順番（えらんだ 順。1人目は 自分）。1〜4人。
  member_ids uuid[] not null,
  -- ステージの 状態（画面が そのまま 入れる）。
  state jsonb not null default '{}'::jsonb,
  -- 最後に 書いた 人。
  updated_by uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.itquest_team_saves
  drop constraint if exists itquest_team_saves_members_size;
alter table public.itquest_team_saves
  add constraint itquest_team_saves_members_size
  check (array_length(member_ids, 1) between 1 and 4);

-- 同じ ステージ・同じ 組は 1行だけ。
create unique index if not exists itquest_team_saves_stage_member_key
  on public.itquest_team_saves (stage_id, public.quest_member_key(member_ids));

-- 自分が 入っている 行を 引く ための 索引。
create index if not exists itquest_team_saves_member_ids_gin
  on public.itquest_team_saves using gin (member_ids);

alter table public.itquest_team_saves enable row level security;

-- きまり:
--   1. メンバーは 読める／管理者は ぜんぶ 読める（先生が「だれが 何を 聞いたか」を 見る）
--   2. メンバーは 作れる（自分が 入っている 組だけ）
--   3. メンバーは 上書きできる（進むたびに 変わる）
--   消す きまりは 置かない（消せない）。
drop policy if exists itquest_team_saves_select_member on public.itquest_team_saves;
create policy itquest_team_saves_select_member on public.itquest_team_saves
  for select to authenticated using ((select auth.uid()) = any (member_ids));

drop policy if exists itquest_team_saves_select_admin on public.itquest_team_saves;
create policy itquest_team_saves_select_admin on public.itquest_team_saves
  for select to authenticated using (public.is_admin());

drop policy if exists itquest_team_saves_insert_member on public.itquest_team_saves;
create policy itquest_team_saves_insert_member on public.itquest_team_saves
  for insert to authenticated
  with check ((select auth.uid()) = any (member_ids) and updated_by = (select auth.uid()));

drop policy if exists itquest_team_saves_update_member on public.itquest_team_saves;
create policy itquest_team_saves_update_member on public.itquest_team_saves
  for update to authenticated
  using ((select auth.uid()) = any (member_ids))
  with check ((select auth.uid()) = any (member_ids) and updated_by = (select auth.uid()));

comment on table public.itquest_team_saves is
  'NEXMAX IT QUEST の チームの 保存。ステージ ＋ メンバーの 組（1〜4人）で 1行を 共有する。書くのは 節目だけ。';

commit;
