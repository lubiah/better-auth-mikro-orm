# Fix: `transformWhere` breaks all reads on MikroORM ≥ 7.1.9 (empty `$or` → `1 = 0`)

**Repo to submit to:** `lubiah/better-auth-mikro-orm` (PR target: `master`)
**Reported by:** Mezzage (production incident — sign-in returned 401 / "invalid credentials" for every user, `getSession` found nothing)

---

## 1. The bug

`transformWhere` in `src/utils.ts` **always** returns this shape, even for a single
plain equality lookup:

```ts
{ $and: [{ email: { $eq: "a@b.c" } }], $or: [] }
```

The unconditional `$or: []` is the problem. Since **MikroORM 7.1.9**
(`packages/sql`, commit `0578108`, changelog: *"sql: compile an empty `$or` to an
always-false predicate (#8054)"*), an empty `$or` is rendered as SQL `1 = 0`:

```ts
// @mikro-orm/sql@7.1.9+ QueryBuilderHelper.appendGroupCondition
if (operator === '$or' && subCondition.length === 0) {
    return { sql: '1 = 0', params };
}
```

That is **correct semantics** (an empty disjunction is false, like `IN ()`) — the
adapter is what's wrong. Because `transformWhere` emits `$or: []` on *every*
query, every read through this adapter becomes:

```sql
where "email" = 'a@b.c' and 1 = 0   -- always false → no rows
```

**Impact:** `findUserByEmail`, `getSession`, `findOne`, `findMany`, `count`,
`update`, `delete` — every operation that passes a `where` clause returns no
rows. Sign-in, session lookup, and any authenticated request all fail.

**Why existing tests didn't catch it:** the repo's `bun.lock` pins
`@mikro-orm/sqlite@7.0.11` **exactly**. In 7.0.11 the same `appendGroupCondition`
had **no** empty-`$or` special case — an empty `$or` produced `()` which the
query builder silently dropped, so the adapter's `$or: []` was harmless and all
adapter tests passed. The `1 = 0` behavior was added in 7.1.9, so the bug only
surfaces when the adapter runs against MikroORM ≥ 7.1.9.

---

## 2. Root cause summary

| Component | Issue |
|---|---|
| `transformWhere` | Unconditionally emits `$and: []` + `$or: []`; only handles `connector === "AND"` (OR conditions silently dropped); only handles `eq/ne/gt/gte/lt/lte/starts_with` (operators like `in`, `not_in`, `contains`, `ends_with` silently dropped) |
| Repo devDependency | `@mikro-orm/sqlite: ^7.0.11` locked at 7.0.11 in `bun.lock` — masks the `1 = 0` behavior added in 7.1.9 |

---

## 3. The fix

Replace `transformWhere` in `src/utils.ts` with a version that:

- emits `$and` / `$or` keys **only when they have conditions** (never an empty `$or`)
- routes `connector: "OR"` conditions to `$or`
- handles **all** better-auth operators: `eq`, `ne`, `gt`, `gte`, `lt`, `lte`,
  `in`, `not_in`, `contains`, `starts_with`, `ends_with`

```ts
import type { Where } from "@better-auth/core/db/adapter";
import { MikroORM } from "@mikro-orm/core";
import { BetterAuthError } from "better-auth";

export const getEntityByModel = (orm: MikroORM, model: string) => {
    const entities = Array.from(orm.getMetadata().getAll().values());
    const entity = entities.find(e => e.tableName === model);
    if (!entity) {
        throw new BetterAuthError(`No entity found for model ${model}`);
    }
    return entity.class;
};

export const transformWhere = (where?: Where[]) => {
    if (!where || where.length === 0) return {};

    const condition = (field: string, operator: string, value: Where["value"]) => ({
        [field]: { [operator === "eq" ? "$eq" : `$${operator}`]: value },
    });

    const and: Record<string, unknown>[] = [];
    const or: Record<string, unknown>[] = [];

    for (const { connector, operator, field, value } of where) {
        const target = connector === "OR" ? or : and;
        switch (operator) {
            case "in":
                target.push({ [field]: { $in: value } });
                break;
            case "not_in":
                target.push({ [field]: { $nin: value } });
                break;
            case "contains":
                target.push({ [field]: { $like: `%${value}%` } });
                break;
            case "starts_with":
                target.push({ [field]: { $like: `${value}%` } });
                break;
            case "ends_with":
                target.push({ [field]: { $like: `%${value}` } });
                break;
            case "gt":
            case "gte":
            case "lt":
            case "lte":
            case "ne":
            case "eq":
            case undefined:
                target.push(condition(field, operator ?? "eq", value));
                break;
            default:
                // Unknown operator — pass raw equality through rather than dropping.
                target.push({ [field]: { $eq: value } });
        }
    }

    const result: Record<string, unknown> = {};
    if (and.length > 0) result.$and = and;
    if (or.length > 0) result.$or = or;
    return result;
};
```

---

## 4. Tests to add (so this is caught)

Two layers, both required for the PR:

### 4a. Unit test — `tests/transformWhere.test.ts` (new file)

Tests the transform shape directly. **The key assertion is #2: an
`$or` key must never be emitted when there are no OR conditions** — this is the
exact regression.

```ts
import { describe, expect, it } from "vitest";
import { transformWhere } from "../src/utils";

describe("transformWhere", () => {
    it("returns an empty object when there is no where clause", () => {
        expect(transformWhere(undefined)).toEqual({});
        expect(transformWhere([])).toEqual({});
    });

    it("never emits an empty $or — only $and when AND conditions exist", () => {
        // Regression: the old implementation always returned { $and: [...], $or: [] },
        // and MikroORM ≥ 7.1.9 renders an empty $or as `1 = 0`, breaking every read.
        const result = transformWhere([{ field: "email", value: "a@b.c" }]);
        expect(result).toEqual({ $and: [{ email: { $eq: "a@b.c" } }] });
        expect(result).not.toHaveProperty("$or");
    });

    it("routes OR connectors to $or", () => {
        expect(
            transformWhere([
                { field: "a", value: 1, connector: "OR" },
                { field: "b", value: 2, connector: "OR" },
            ]),
        ).toEqual({ $or: [{ a: { $eq: 1 } }, { b: { $eq: 2 } }] });
    });

    it("mixes AND and OR conditions", () => {
        expect(
            transformWhere([
                { field: "tenant", value: "t1" },
                { field: "status", value: "active" },
                { field: "deleted_at", value: null, operator: "eq", connector: "OR" },
            ]),
        ).toEqual({
            $and: [{ tenant: { $eq: "t1" } }, { status: { $eq: "active" } }],
            $or: [{ deleted_at: { $eq: null } }],
        });
    });

    it("maps comparison operators", () => {
        expect(transformWhere([{ field: "age", value: 5, operator: "gt" }])).toEqual({
            $and: [{ age: { $gt: 5 } }],
        });
        expect(transformWhere([{ field: "age", value: 5, operator: "ne" }])).toEqual({
            $and: [{ age: { $ne: 5 } }],
        });
    });

    it("maps in / not_in / contains / starts_with / ends_with", () => {
        expect(transformWhere([{ field: "id", value: ["a", "b"], operator: "in" }])).toEqual({
            $and: [{ id: { $in: ["a", "b"] } }],
        });
        expect(transformWhere([{ field: "id", value: ["a"], operator: "not_in" }])).toEqual({
            $and: [{ id: { $nin: ["a"] } }],
        });
        expect(transformWhere([{ field: "name", value: "ad", operator: "contains" }])).toEqual({
            $and: [{ name: { $like: "%ad%" } }],
        });
        expect(transformWhere([{ field: "name", value: "ad", operator: "starts_with" }])).toEqual({
            $and: [{ name: { $like: "ad%" } }],
        });
        expect(transformWhere([{ field: "name", value: "am", operator: "ends_with" }])).toEqual({
            $and: [{ name: { $like: "%am" } }],
        });
    });
});
```

### 4b. Integration tests through the adapter (existing pattern)

Add these cases to `tests/adapter.test.ts` (or the per-method files). They run
the real adapter + real in-memory SQLite, exactly like the existing suites.

```ts
it("findOne with an OR connector finds a matching record", async () => {
    await adapter.create({ model: "user", data: { name: "Ada", email: "ada@example.com" } });
    const result = await adapter.findOne({
        model: "user",
        where: [
            { field: "email", value: "ada@example.com", connector: "OR" },
            { field: "email", value: "missing@example.com", connector: "OR" },
        ],
    });
    expect(result).toMatchObject({ name: "Ada", email: "ada@example.com" });
});

it("count with an in operator counts matching records", async () => {
    for (const email of ["a@example.com", "b@example.com", "c@example.com"]) {
        await adapter.create({ model: "user", data: { name: email, email } });
    }
    const count = await adapter.count({
        model: "user",
        where: [{ field: "email", value: ["a@example.com", "c@example.com"], operator: "in" }],
    });
    expect(count).toBe(2);
});
```

**Why these catch the bug:** with the old `transformWhere` on MikroORM ≥ 7.1.9,
`findOne`/`count` with a `where` clause return nothing (empty `$or` → `1 = 0`),
so both assertions fail. With the fix they pass.

> **Note for the existing `findOne.test.ts` / `findMany.test.ts` suites:** those
> already assert `findOne`/`findMany` with plain equality where clauses — they
> would *also* fail on MikroORM ≥ 7.1.9 with the old code, which is the strongest
> signal. See the dependency bump below.

---

## 5. Critical: bump the dev dependency (this is why the bug shipped)

The existing tests pass today only because `bun.lock` pins
`@mikro-orm/sqlite@7.0.11`, where empty `$or` is silently dropped. For the
integration tests to actually guard this regression, the suite must run against
the version that surfaces it:

```diff
- "@mikro-orm/sqlite": "^7.0.11",
+ "@mikro-orm/sqlite": "^7.1.9",
```

Then regenerate the lockfile:

```bash
bun install
```

After this, the **pre-existing** `findOne`/`findMany`/`count`/`update`/`delete`
tests that pass a `where` clause will fail on the old `transformWhere` and pass
on the fixed one — the integration suite itself becomes the regression guard.

---

## 6. Verification checklist (run before submitting)

```bash
bun install          # after the devDependency bump
bun run typecheck
bun run test         # vitest — full suite, including new tests
```

**Confirm the tests fail without the fix:** `git stash` the `src/utils.ts`
change (keep the tests + dep bump), run `bun run test` — `findOne`,
`transformWhere` unit tests, and the new integration cases must fail. Then
restore the fix and confirm green.

---

## 7. Suggested PR description

> **fix: transformWhere emitted `$or: []` on every query, breaking all reads on MikroORM ≥ 7.1.9**
>
> `transformWhere` unconditionally returned `{ $and: [...], $or: [] }`. MikroORM
> 7.1.9 (changelog #8054) compiles an empty `$or` to an always-false `1 = 0`
> predicate, so every read through the adapter (`findUserByEmail`, `getSession`,
> `findOne`, `count`, …) matched zero rows — sign-in and session lookup failed
> with 401.
>
> This went unnoticed because the lockfile pinned `@mikro-orm/sqlite@7.0.11`,
> where empty `$or` was silently dropped. The fix:
> - only emit `$and` / `$or` keys when conditions exist (never an empty `$or`)
> - route OR connectors to `$or` (previously dropped)
> - support all operators: `eq`, `ne`, `gt`, `gte`, `lt`, `lte`, `in`, `not_in`,
>   `contains`, `starts_with`, `ends_with`
>
> Tests: unit coverage for `transformWhere` (no empty `$or`, OR routing,
> operator mapping) + integration cases through the adapter; dev dependency
> bumped to `@mikro-orm/sqlite@^7.1.9` so the suite runs against the version
> that surfaces the regression.
