import { beforeEach, describe, expect, it } from "vitest";
import { useAuth } from "../src/lib/auth";
import { DEFAULT_AVATAR, useGame } from "../src/lib/store";
import { ensureTeam, memberLook, teamKey, useTeam, type TeamMember } from "../src/lib/team/store";
import {
  canWriteRemote,
  createTeamSync,
  preferFurther,
  type TeamDbClient,
} from "../src/lib/team/sync";

const db = (id: string, name = id): TeamMember => ({ id, name, db: true });
const local = (name: string): TeamMember => ({ id: `local:${name}`, name, db: false });

function memStorage() {
  const m = new Map<string, string>();
  return {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, v),
    map: m,
  };
}

/** supabase-js の from(...) の 鎖を まねる にせもの。呼ばれた 操作を calls に ためる。 */
function fakeClient(
  opts: {
    rows?: { id: string; member_ids: string[]; state: unknown }[];
    insertError?: { code: string };
  } = {},
) {
  const calls: { op: string; payload?: unknown }[] = [];
  const rows = opts.rows ?? [];
  const chain = (result: unknown) => {
    const c: Record<string, unknown> = {};
    for (const k of ["eq", "contains", "select"]) c[k] = () => c;
    c.single = () => Promise.resolve(result);
    c.then = (res: (v: unknown) => unknown, rej: (e: unknown) => unknown) =>
      Promise.resolve(result).then(res, rej);
    return c;
  };
  const client = {
    from: () => ({
      select: () => {
        calls.push({ op: "select" });
        return chain({ data: rows, error: null });
      },
      insert: (payload: unknown) => {
        calls.push({ op: "insert", payload });
        return chain(
          opts.insertError
            ? { data: null, error: opts.insertError }
            : { data: { id: "new-row" }, error: null },
        );
      },
      update: (payload: unknown) => {
        calls.push({ op: "update", payload });
        return chain({ error: null });
      },
    }),
  };
  return { calls, client: () => Promise.resolve(client as unknown as TeamDbClient) };
}

beforeEach(() => {
  useAuth.setState({ session: null });
  useTeam.setState({ members: [] });
  useGame.setState({
    profile: { name: "ソク ピセット", nickname: "ソク", hasPhoto: false },
    avatar: { ...DEFAULT_AVATAR, hairStyle: "spiky" },
  });
});

describe("チームの 鍵", () => {
  it("えらぶ 順が ちがっても 同じ 組なら 同じ 鍵。ステージが ちがえば ちがう 鍵", () => {
    const a = teamKey("stage2", [db("b"), db("a"), db("c")]);
    expect(a).toBe("stage2:a,b,c");
    expect(teamKey("stage2", [db("c"), db("b"), db("a")])).toBe(a);
    expect(teamKey("stage3", [db("a"), db("b"), db("c")])).not.toBe(a);
  });
});

describe("ensureTeam", () => {
  it("まだ えらんでいなければ 自分だけ（ログインしていない → local:me）", () => {
    expect(ensureTeam()).toEqual([
      { id: "local:me", name: "ソク", db: false, gender: "male", avatar: null },
    ]);
  });
  it("1人目は いつも いまの 自分。ほかの 人は えらんだ 順のまま", () => {
    useTeam.setState({
      members: [{ id: "local:me", name: "古い", db: false }, local("ダラ"), local("リナ")],
    });
    useGame.setState({ profile: { name: "ソク ピセット", nickname: "ピセット", hasPhoto: false } });
    const team = ensureTeam();
    expect(team.map((m) => m.name)).toEqual(["ピセット", "ダラ", "リナ"]);
  });
});

describe("memberLook", () => {
  it("自分は いまの アバターを スーツに", () => {
    const look = memberLook(ensureTeam()[0]!);
    expect(look.outfit).toBe("suit");
    expect(look.hairStyle).toBe("spiky");
  });
  it("同じ 人なら いつも 同じ 見た目（DB の 人は id、ニックネームの 人は 名前から）", () => {
    expect(memberLook(db("u1"))).toEqual(memberLook(db("u1")));
    expect(memberLook(local("ダラ"))).toEqual(memberLook({ ...local("ダラ"), id: "local:x" }));
    expect(memberLook(local("ダラ")).outfit).toBe("suit");
  });
  it("DB の 人で アバターを 保存している ときは それを 使う", () => {
    const look = memberLook({ ...db("u2"), avatar: { hairStyle: "twin", outfit: "kigurumi" } });
    expect(look.hairStyle).toBe("twin");
    expect(look.outfit).toBe("suit");
  });
});

describe("チームの 保存", () => {
  it("端末に 置いて 読みもどせる（DB の 設定が 無くても）", async () => {
    const storage = memStorage();
    const members = [local("me"), local("ダラ")];
    const sync = createTeamSync<{ log: number[] }>("stage2", members, {
      storage,
      client: undefined,
      userId: () => null,
    });
    const key = teamKey("stage2", members);
    expect(await sync.load(key)).toBeNull();
    sync.save(key, { log: [1, 2] }, true);
    expect(await sync.load(key)).toEqual({ log: [1, 2] });
  });

  it("DB に 書くのは 節目・全員が DB の 人・ログインしていて 自分が 組に いる ときだけ", () => {
    const team = [db("u1"), db("u2")];
    expect(canWriteRemote(team, "u1", true)).toBe(true);
    expect(canWriteRemote(team, "u1", false)).toBe(false);
    expect(canWriteRemote(team, null, true)).toBe(false);
    expect(canWriteRemote(team, "u9", true)).toBe(false);
    expect(canWriteRemote([db("u1"), local("ダラ")], "u1", true)).toBe(false);
  });

  it("節目でない save は 端末だけ。節目は DB に 作る（つぎは 同じ 行を 上書き）", async () => {
    const storage = memStorage();
    const fake = fakeClient();
    const members = [db("u1"), db("u2")];
    const sync = createTeamSync<{ log: number[] }>("stage2", members, {
      storage,
      client: fake.client,
      userId: () => "u1",
    });
    const key = teamKey("stage2", members);
    sync.save(key, { log: [1] }, false);
    await sync.flush();
    expect(fake.calls).toEqual([]);
    sync.save(key, { log: [1, 2] }, true);
    await sync.flush();
    expect(fake.calls.map((c) => c.op)).toEqual(["select", "insert"]);
    expect(fake.calls[1]!.payload).toMatchObject({
      stage_id: "stage2",
      member_ids: ["u1", "u2"],
      updated_by: "u1",
    });
    sync.save(key, { log: [1, 2, 3] }, true);
    await sync.flush();
    expect(fake.calls.map((c) => c.op)).toEqual(["select", "insert", "update"]);
  });

  it("ニックネームの 人が いる 組は 節目でも DB に 書かない", async () => {
    const fake = fakeClient();
    const members = [db("u1"), local("ダラ")];
    const sync = createTeamSync("stage2", members, {
      storage: memStorage(),
      client: fake.client,
      userId: () => "u1",
    });
    sync.save(teamKey("stage2", members), { log: [] }, true);
    await sync.flush();
    expect(fake.calls).toEqual([]);
  });

  it("表が まだ無い（42P01）ときは エラーを 飲みこみ、もう 聞きに 行かない", async () => {
    const fake = fakeClient({ insertError: { code: "42P01" } });
    const members = [db("u1")];
    const sync = createTeamSync("stage2", members, {
      storage: memStorage(),
      client: fake.client,
      userId: () => "u1",
    });
    const key = teamKey("stage2", members);
    sync.save(key, { log: [1] }, true);
    await sync.flush();
    sync.save(key, { log: [1, 2] }, true);
    await sync.flush();
    expect(fake.calls.map((c) => c.op)).toEqual(["select", "insert"]);
  });

  it("load は 端末と DB の うち log の 長い ほう", async () => {
    const storage = memStorage();
    const members = [db("u2"), db("u1")];
    const key = teamKey("stage2", members);
    const fake = fakeClient({
      rows: [{ id: "r1", member_ids: ["u1", "u2"], state: { log: [1, 2, 3] } }],
    });
    const sync = createTeamSync<{ log: number[] }>("stage2", members, {
      storage,
      client: fake.client,
      userId: () => "u1",
    });
    sync.save(key, { log: [1] }, false);
    expect(await sync.load(key)).toEqual({ log: [1, 2, 3] });
    expect(preferFurther({ log: [1, 2] }, { log: [1] })).toEqual({ log: [1, 2] });
    expect(preferFurther({ a: 1 }, { b: 2 })).toEqual({ a: 1 });
  });
});
