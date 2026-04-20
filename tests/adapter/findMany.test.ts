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

describe("adapter findMany function", () => {
  it("returns all records when no filter is applied", async () => {
    for (let i = 1; i <= 3; i++) {
      await adapter.create({
        model: "user",
        data: { name: `User ${i}`, email: `user${i}@example.com` },
      });
    }

    const results = await adapter.findMany({ model: "user" });

    expect(results).toHaveLength(3);
  });

  it("filters records by a where condition", async () => {
    for (let i = 1; i <= 3; i++) {
      await adapter.create({
        model: "user",
        data: { name: `User ${i}`, email: `user${i}@example.com` },
      });
    }

    const results = await adapter.findMany({
      model: "user",
      where: [{ field: "email", value: "user2@example.com" }],
    });

    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({ name: "User 2", email: "user2@example.com" });
  });

  it("respects the limit option", async () => {
    for (let i = 1; i <= 5; i++) {
      await adapter.create({
        model: "user",
        data: { name: `User ${i}`, email: `user${i}@example.com` },
      });
    }

    const results = await adapter.findMany({ model: "user", limit: 2 });

    expect(results).toHaveLength(2);
  });

  it("respects the offset option", async () => {
    for (let i = 1; i <= 5; i++) {
      await adapter.create({
        model: "user",
        data: { name: `User ${i}`, email: `user${i}@example.com` },
      });
    }

    const all = await adapter.findMany<{}>({ model: "user" });
    const offset2 = await adapter.findMany({ model: "user", offset: 2 });

    expect(offset2).toHaveLength(all.length - 2);
    expect(offset2[0]).toMatchObject(all[2]);
  });

  it("sorts records ascending by name", async () => {
    const names = ["Charlie", "Alice", "Bob"];
    for (let i = 0; i < names.length; i++) {
      await adapter.create({
        model: "user",
        data: { name: names[i], email: `${names[i].toLowerCase()}@example.com` },
      });
    }

    const results = await adapter.findMany<{ name: string }>({
      model: "user",
      sortBy: { field: "name", direction: "asc" },
    });

    expect(results.map((r) => r.name)).toEqual(["Alice", "Bob", "Charlie"]);
  });

  it("sorts records descending by name", async () => {
    const names = ["Charlie", "Alice", "Bob"];
    for (let i = 0; i < names.length; i++) {
      await adapter.create({
        model: "user",
        data: { name: names[i], email: `${names[i].toLowerCase()}@example.com` },
      });
    }

    const results = await adapter.findMany<{ name: string }>({
      model: "user",
      sortBy: { field: "name", direction: "desc" },
    });

    expect(results.map((r) => r.name)).toEqual(["Charlie", "Bob", "Alice"]);
  });

  it("combines limit and sortBy", async () => {
    const names = ["Charlie", "Alice", "Bob", "Dave"];
    for (let i = 0; i < names.length; i++) {
      await adapter.create({
        model: "user",
        data: { name: names[i], email: `${names[i].toLowerCase()}@example.com` },
      });
    }

    const results = await adapter.findMany<{ name: string }>({
      model: "user",
      sortBy: { field: "name", direction: "asc" },
      limit: 2,
    });

    expect(results).toHaveLength(2);
    expect(results.map((r) => r.name)).toEqual(["Alice", "Bob"]);
  });

  it("returns an empty array when no records match", async () => {
    const results = await adapter.findMany({
      model: "user",
      where: [{ field: "email", value: "nobody@example.com" }],
    });

    expect(results).toEqual([]);
  });
});
