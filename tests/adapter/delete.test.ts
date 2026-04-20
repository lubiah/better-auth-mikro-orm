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

describe("adapter delete function", () => {
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

    await adapter.delete({
      model: "user",
      where: [{ field: "email", value: "test2@example.com", operator: "eq" }],
    });

    const remaining = await adapter.findMany<{ email: string }>({ model: "user" });
    expect(remaining).toHaveLength(2);
    expect(remaining.map((record) => record.email).sort()).toEqual([
      "test1@example.com",
      "test3@example.com",
    ]);
  });

  it("deletes records matching the ne operator", async () => {
    for (let i = 1; i <= 3; i++) {
      await adapter.create({
        model: "user",
        data: {
          name: `Test ${i}`,
          email: `test${i}@example.com`,
        },
      });
    }

    await adapter.delete({
      model: "user",
      where: [{ field: "email", value: "test1@example.com", operator: "ne" }],
    });

    const remaining = await adapter.findMany<{ email: string }>({ model: "user" });
    expect(remaining).toHaveLength(1);
    expect(remaining[0]).toMatchObject({ email: "test1@example.com" });
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

    await adapter.delete({
      model: "user",
      where: [{ field: "name", value: "Alice", operator: "starts_with" }],
    });

    const remaining = await adapter.findMany<{ name: string }>({ model: "user" });
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

    await adapter.delete({
      model: "user",
      where: [
        { field: "name", value: "Admin", operator: "starts_with", connector: "AND" },
        { field: "email", value: "admin@example.com", operator: "eq", connector: "AND" },
      ],
    });

    const remaining = await adapter.findMany<{ name: string; email: string }>({ model: "user" });
    expect(remaining).toHaveLength(2);
    expect(remaining.map((record) => record.email).sort()).toEqual([
      "admin.two@example.com",
      "user@example.com",
    ]);
  });

  it("does not delete anything when no records match the where query", async () => {
    for (let i = 1; i <= 2; i++) {
      await adapter.create({
        model: "user",
        data: {
          name: `User ${i}`,
          email: `user${i}@example.com`,
        },
      });
    }

    await adapter.delete({
      model: "user",
      where: [{ field: "email", value: "missing@example.com", operator: "eq" }],
    });

    const remainingCount = await adapter.count({ model: "user" });
    expect(remainingCount).toBe(2);
  });
});
