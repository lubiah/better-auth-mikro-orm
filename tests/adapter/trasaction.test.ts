import { MikroORM } from "@mikro-orm/sqlite";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { adapter as mikroAdapter } from "../../src/adapter";
import { coreEntities, UserEntity } from "../fixtures/entities";

const orm = await MikroORM.init({
  dbName: ":memory:",
  entities: coreEntities,
});

beforeEach(async () => {
  await orm.schema.refresh();
});

afterAll(async () => {
  await orm.close(true);
});

describe("adapter transaction (real orm)", () => {
  const makeUser = (id: string) => {
    const now = new Date();
    return {
      name: `User ${id}`,
      email: `${id}@example.com`,
      emailVerified: false,
      createdAt: now,
      updatedAt: now,
    };
  };

  it("commits when callback succeeds", async () => {
    const factory = mikroAdapter(orm);
    const adapter = factory({} as any);
    const id = `tx-commit-${crypto.randomUUID()}`;

    await adapter.transaction(async tx => {
      await tx.create({
        model: "user",
        data: makeUser(id),
      } as any);
    });

    const row = await orm.em.fork().findOne(UserEntity, { email: `${id}@example.com` });
    expect(row).toBeTruthy();
  });

  it("rolls back when callback throws", async () => {
    const id = `tx-rollback-${crypto.randomUUID()}`;
    const factory = mikroAdapter(orm);
    const adapter = factory({} as any);

    await expect(
      adapter.transaction(async tx => {
        await tx.create({
          model: "user",
          data: makeUser(id),
        } as any);

        throw new Error("force rollback");
      }),
    ).rejects.toThrow("force rollback");

    const row = await orm.em.fork().findOne(UserEntity, { email: `${id}@example.com` });
    expect(row).toBeNull();
  });

  it("returns the callback result", async () => {
    const id = `tx-result-${crypto.randomUUID()}`;
    const factory = mikroAdapter(orm);
    const adapter = factory({} as any);

    const result = await adapter.transaction(async tx => {
      await tx.create({
        model: "user",
        data: makeUser(id),
      } as any);

      return { ok: true, email: `${id}@example.com` };
    });

    expect(result).toEqual({ ok: true, email: `${id}@example.com` });
  });

  it("commits multiple creates in a single transaction", async () => {
    const id1 = `tx-multi-1-${crypto.randomUUID()}`;
    const id2 = `tx-multi-2-${crypto.randomUUID()}`;
    const factory = mikroAdapter(orm);
    const adapter = factory({} as any);

    await adapter.transaction(async tx => {
      await tx.create({ model: "user", data: makeUser(id1) } as any);
      await tx.create({ model: "user", data: makeUser(id2) } as any);
    });

    const em = orm.em.fork();
    const row1 = await em.findOne(UserEntity, { email: `${id1}@example.com` });
    const row2 = await em.findOne(UserEntity, { email: `${id2}@example.com` });

    expect(row1).toBeTruthy();
    expect(row2).toBeTruthy();
  });

  it("rolls back all writes when error happens after multiple creates", async () => {
    const id1 = `tx-rb-multi-1-${crypto.randomUUID()}`;
    const id2 = `tx-rb-multi-2-${crypto.randomUUID()}`;
    const factory = mikroAdapter(orm);
    const adapter = factory({} as any);

    await expect(
      adapter.transaction(async tx => {
        await tx.create({ model: "user", data: makeUser(id1) } as any);
        await tx.create({ model: "user", data: makeUser(id2) } as any);
        throw new Error("rollback all");
      }),
    ).rejects.toThrow("rollback all");

    const em = orm.em.fork();
    const row1 = await em.findOne(UserEntity, { email: `${id1}@example.com` });
    const row2 = await em.findOne(UserEntity, { email: `${id2}@example.com` });

    expect(row1).toBeNull();
    expect(row2).toBeNull();
  });
});
