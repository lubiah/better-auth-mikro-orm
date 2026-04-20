import { MikroORM } from "@mikro-orm/sqlite";
import { beforeEach, describe, expect, it } from "vitest";
import { adapter as mikroAdapter } from "../../src/adapter";
import { coreEntities } from "../fixtures/entities";

const orm = await MikroORM.init({
  dbName: ":memory:",
  entities: coreEntities,
});

const factory = mikroAdapter(orm);
const adapter = factory({});

beforeEach(async () => {
  await orm.schema.refresh();
});

describe("adapter deleteMany function", () => {
  it("deletes records matching the eq operator", async () => {
    for (let i = 1; i <= 3; i++) {
      await adapter.create({
        model: "user",
        data: {
          name: `Test ${i}`,
          email: `test${i}@example.com`,
        },
      });
    }

    const deletedCount = await adapter.deleteMany({
      model: "user",
      where: [{ field: "email", value: "test2@example.com", operator: "eq" }],
    });

    const remaining = await adapter.findMany<{ email: string }>({ model: "user" });

    expect(deletedCount).toBe(1);
    expect(remaining).toHaveLength(2);
    expect(remaining.map((record) => record.email).sort()).toEqual([
      "test1@example.com",
      "test3@example.com",
    ]);
  });

  it("deletes records matching the ne operator", async () => {
    for (let i = 1; i <= 4; i++) {
      await adapter.create({
        model: "user",
        data: {
          name: `User ${i}`,
          email: `user${i}@example.com`,
        },
      });
    }

    const deletedCount = await adapter.deleteMany({
      model: "user",
      where: [{ field: "name", value: "User 1", operator: "ne" }],
    });

    const remaining = await adapter.findMany<{ name: string }>({ model: "user" });

    expect(deletedCount).toBe(3);
    expect(remaining).toHaveLength(1);
    expect(remaining[0]).toMatchObject({ name: "User 1" });
  });

  it("deletes records matching the starts_with operator", async () => {
    await adapter.create({
      model: "user",
      data: { name: "Alice Johnson", email: "alice@example.com" },
    });
    await adapter.create({
      model: "user",
      data: { name: "Alice Brown", email: "alice.b@example.com" },
    });
    await adapter.create({
      model: "user",
      data: { name: "Bob Smith", email: "bob@example.com" },
    });

    const deletedCount = await adapter.deleteMany({
      model: "user",
      where: [{ field: "name", value: "Alice", operator: "starts_with" }],
    });

    const remaining = await adapter.findMany<{ name: string }>({ model: "user" });

    expect(deletedCount).toBe(2);
    expect(remaining).toHaveLength(1);
    expect(remaining[0]).toMatchObject({ name: "Bob Smith" });
  });

  it("deletes records matching multiple where conditions with AND logic", async () => {
    await adapter.create({
      model: "user",
      data: { name: "Admin One", email: "admin@example.com" },
    });
    await adapter.create({
      model: "user",
      data: { name: "Admin Two", email: "admin.two@example.com" },
    });
    await adapter.create({
      model: "user",
      data: { name: "User One", email: "user@example.com" },
    });

    const deletedCount = await adapter.deleteMany({
      model: "user",
      where: [
        { field: "name", value: "Admin", operator: "starts_with", connector: "AND" },
        { field: "email", value: "admin@example.com", operator: "eq", connector: "AND" },
      ],
    });

    const remaining = await adapter.findMany<{ email: string }>({ model: "user" });

    expect(deletedCount).toBe(1);
    expect(remaining).toHaveLength(2);
    expect(remaining.map((record) => record.email).sort()).toEqual([
      "admin.two@example.com",
      "user@example.com",
    ]);
  });

  it("returns 0 and leaves records untouched when no records match", async () => {
    for (let i = 1; i <= 2; i++) {
      await adapter.create({
        model: "user",
        data: {
          name: `User ${i}`,
          email: `user${i}@example.com`,
        },
      });
    }

    const deletedCount = await adapter.deleteMany({
      model: "user",
      where: [{ field: "email", value: "missing@example.com", operator: "eq" }],
    });

    expect(deletedCount).toBe(0);
    expect(await adapter.count({ model: "user" })).toBe(2);
  });

  it("returns a delete count that matches the number of removed rows", async () => {
    await adapter.create({
      model: "user",
      data: { name: "Admin Alpha", email: "admin.alpha@example.com" },
    });
    await adapter.create({
      model: "user",
      data: { name: "Admin Beta", email: "admin.beta@example.com" },
    });
    await adapter.create({
      model: "user",
      data: { name: "Member One", email: "member.one@example.com" },
    });

    const beforeCount = await adapter.count({ model: "user" });
    const deletedCount = await adapter.deleteMany({
      model: "user",
      where: [{ field: "email", value: "admin", operator: "starts_with" }],
    });
    const afterCount = await adapter.count({ model: "user" });

    expect(beforeCount - afterCount).toBe(deletedCount);
    expect(afterCount).toBe(1);
  });

  it("can delete sessions filtered by a related userId foreign key", async () => {
    const userA = await adapter.create({
      model: "user",
      data: { name: "User A", email: "usera@example.com" },
    });
    const userB = await adapter.create({
      model: "user",
      data: { name: "User B", email: "userb@example.com" },
    });

    for (let i = 1; i <= 3; i++) {
      await adapter.create({
        model: "session",
        data: {
          token: `token-a-${i}`,
          userId: userA.id,
          expiresAt: new Date(Date.now() + 86400_000),
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });
    }

    for (let i = 1; i <= 2; i++) {
      await adapter.create({
        model: "session",
        data: {
          token: `token-b-${i}`,
          userId: userB.id,
          expiresAt: new Date(Date.now() + 86400_000),
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });
    }

    const deletedCount = await adapter.deleteMany({
      model: "session",
      where: [{ field: "userId", value: userA.id, operator: "eq" }],
    });

    const remaining = await adapter.findMany<{ token: string }>({ model: "session" });

    expect(deletedCount).toBe(3);
    expect(remaining).toHaveLength(2);
    expect(remaining.every((s) => s.token.startsWith("token-b-"))).toBe(true);
  });
});
