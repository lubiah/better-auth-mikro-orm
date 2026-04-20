import { MikroORM } from "@mikro-orm/sqlite";
import { beforeEach, describe, expect, it } from "vitest";
import { adapter as mikroAdapter } from "../src/adapter";
import { coreEntities } from "./fixtures/entities";

const orm = await MikroORM.init({
  dbName: ":memory:",
  entities: coreEntities,
});

const factory = mikroAdapter(orm);
const adapter = factory({});

beforeEach(async () => {
  await orm.schema.refresh();
});

describe("adapter create function", () => {
  it("can create model data", async () => {
    const factory = mikroAdapter(orm);
    const adapter = factory({});
    const results = await adapter.create({
      model: "user",
      data: {
        name: "Test",
        email: "test@example.com",
      },
    });

    expect(results).toMatchObject({ name: "Test", email: "test@example.com" });
  });
});

describe("adapter findOne function", () => {
  it("can find model data", async () => {
    for (let i = 1; i <= 3; i++) {
      await adapter.create({
        model: "user",
        data: {
          name: `Test ${i}`,
          email: `test${i}@example.com`,
        },
      });
    }

    const result = await adapter.findOne({
      model: "user",
      where: [{ field: "email", value: "test1@example.com" }],
    });

    expect(result).toMatchObject({ name: "Test 1", email: "test1@example.com" });
  });

  it("can find model with multiple where conditions", async () => {
    for (let i = 1; i <= 3; i++) {
      await adapter.create({
        model: "user",
        data: {
          name: `Test ${i}`,
          email: `test${i}@example.com`,
        },
      });
    }

    const result = await adapter.findOne({
      model: "user",
      where: [
        { field: "name", value: "Test 1" },
        { field: "email", value: "test1@example.com" },
      ],
    });

    expect(result).toMatchObject({ name: "Test 1", email: "test1@example.com" });
  });

  it("returns null if no record found", async () => {
    const result = await adapter.findOne({
      model: "user",
      where: [{ field: "email", value: "nonexistent@example.com" }],
    });

    expect(result).toBe(null);
  });
});

describe("adapter update function", () => {
  it("can update a field on a model", async () => {
    for (let i = 1; i <= 3; i++) {
      await adapter.create({
        model: "user",
        data: {
          name: `Test ${i}`,
          email: `test${i}@example.com`,
        },
      });
    }

    await adapter.update({
      model: "user",
      where: [{ field: "email", value: "test1@example.com" }],
      update: { name: "Updated Name" },
    });

    const result = await adapter.findOne({
      model: "user",
      where: [{ field: "email", value: "test1@example.com" }],
    });

    expect(result).toMatchObject({ name: "Updated Name", email: "test1@example.com" });
  });

  it("only updates the matched record", async () => {
    for (let i = 1; i <= 3; i++) {
      await adapter.create({
        model: "user",
        data: {
          name: `Test ${i}`,
          email: `test${i}@example.com`,
        },
      });
    }

    await adapter.update({
      model: "user",
      where: [{ field: "email", value: "test2@example.com" }],
      update: { name: "Only Two" },
    });

    const unchanged = await adapter.findOne({
      model: "user",
      where: [{ field: "email", value: "test1@example.com" }],
    });

    expect(unchanged).toMatchObject({ name: "Test 1" });
  });

  it("can update multiple fields at once", async () => {
    await adapter.create({
      model: "user",
      data: { name: "Original", email: "original@example.com" },
    });

    await adapter.update({
      model: "user",
      where: [{ field: "email", value: "original@example.com" }],
      update: { name: "New Name", email: "new@example.com" },
    });

    const result = await adapter.findOne({
      model: "user",
      where: [{ field: "email", value: "new@example.com" }],
    });

    expect(result).toMatchObject({ name: "New Name", email: "new@example.com" });
  });
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

describe("adapter count function", () => {
  it("returns 0 when no records exist", async () => {
    const count = await adapter.count({ model: "user" });
    expect(count).toBe(0);
  });

  it("counts all records when no where condition is provided", async () => {
    for (let i = 1; i <= 5; i++) {
      await adapter.create({
        model: "user",
        data: { name: `User ${i}`, email: `user${i}@example.com` },
      });
    }

    const count = await adapter.count({ model: "user" });
    expect(count).toBe(5);
  });

  it("counts records with equality operator (eq)", async () => {
    for (let i = 1; i <= 3; i++) {
      await adapter.create({
        model: "user",
        data: {
          name: `Test ${i}`,
          email: `test${i}@example.com`,
        },
      });
    }

    const count = await adapter.count({
      model: "user",
      where: [{ field: "email", value: "test1@example.com", operator: "eq" }],
    });

    expect(count).toBe(1);
  });

  it("counts records with not equal operator (ne)", async () => {
    for (let i = 1; i <= 3; i++) {
      await adapter.create({
        model: "user",
        data: {
          name: `Test ${i}`,
          email: `test${i}@example.com`,
        },
      });
    }

    const count = await adapter.count({
      model: "user",
      where: [{ field: "email", value: "test1@example.com", operator: "ne" }],
    });

    expect(count).toBe(2);
  });

  it("counts records with starts_with operator", async () => {
    await adapter.create({
      model: "user",
      data: { name: "Alice Johnson", email: "alice@example.com" },
    });
    await adapter.create({
      model: "user",
      data: { name: "Bob Smith", email: "bob@example.com" },
    });
    await adapter.create({
      model: "user",
      data: { name: "Alice Brown", email: "aliceB@example.com" },
    });

    const count = await adapter.count({
      model: "user",
      where: [{ field: "name", value: "Alice", operator: "starts_with" }],
    });

    expect(count).toBe(2);
  });

  it("counts records with multiple where conditions (AND logic)", async () => {
    for (let i = 1; i <= 3; i++) {
      await adapter.create({
        model: "user",
        data: {
          name: `Test ${i}`,
          email: `test${i}@example.com`,
        },
      });
    }

    const count = await adapter.count({
      model: "user",
      where: [
        { field: "name", value: "Test 2", operator: "eq" },
        { field: "email", value: "test2@example.com", operator: "eq" },
      ],
    });

    expect(count).toBe(1);
  });

  it("returns 0 when where condition matches no records", async () => {
    for (let i = 1; i <= 3; i++) {
      await adapter.create({
        model: "user",
        data: { name: `User ${i}`, email: `user${i}@example.com` },
      });
    }

    const count = await adapter.count({
      model: "user",
      where: [{ field: "email", value: "nobody@example.com" }],
    });

    expect(count).toBe(0);
  });

  it("counts records with starts_with operator on email field", async () => {
    await adapter.create({
      model: "user",
      data: { name: "User One", email: "admin@example.com" },
    });
    await adapter.create({
      model: "user",
      data: { name: "User Two", email: "admin.support@example.com" },
    });
    await adapter.create({
      model: "user",
      data: { name: "User Three", email: "user@example.com" },
    });

    const count = await adapter.count({
      model: "user",
      where: [{ field: "email", value: "admin", operator: "starts_with" }],
    });

    expect(count).toBe(2);
  });

  it("counts records combining eq and ne operators", async () => {
    for (let i = 1; i <= 4; i++) {
      await adapter.create({
        model: "user",
        data: {
          name: `User ${i}`,
          email: `user${i}@example.com`,
        },
      });
    }

    const countEq = await adapter.count({
      model: "user",
      where: [{ field: "name", value: "User 1", operator: "eq" }],
    });

    const countNe = await adapter.count({
      model: "user",
      where: [{ field: "name", value: "User 1", operator: "ne" }],
    });

    expect(countEq).toBe(1);
    expect(countNe).toBe(3);
    expect(countEq + countNe).toBe(4);
  });
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
});

describe("adapter updateMany function", () => {
  it("updates records matching the eq operator", async () => {
    for (let i = 1; i <= 3; i++) {
      await adapter.create({
        model: "user",
        data: {
          name: `Test ${i}`,
          email: `test${i}@example.com`,
        },
      });
    }

    const updatedCount = await adapter.updateMany({
      model: "user",
      where: [{ field: "email", value: "test2@example.com", operator: "eq", connector: "AND" }],
      update: { name: "Updated Two" },
    });

    const updated = await adapter.findOne({
      model: "user",
      where: [{ field: "email", value: "test2@example.com" }],
    });
    const untouched = await adapter.findOne({
      model: "user",
      where: [{ field: "email", value: "test1@example.com" }],
    });

    expect(updatedCount).toBe(1);
    expect(updated).toMatchObject({ name: "Updated Two", email: "test2@example.com" });
    expect(untouched).toMatchObject({ name: "Test 1" });
  });

  it("updates records matching the ne operator", async () => {
    for (let i = 1; i <= 4; i++) {
      await adapter.create({
        model: "user",
        data: {
          name: `User ${i}`,
          email: `user${i}@example.com`,
        },
      });
    }

    const updatedCount = await adapter.updateMany({
      model: "user",
      where: [{ field: "name", value: "User 1", operator: "ne", connector: "AND" }],
      update: { image: "bulk-updated.png" },
    });

    const updated = await adapter.findMany<{ name: string; image: string | null }>({
      model: "user",
      where: [{ field: "image", value: "bulk-updated.png" }],
    });
    const untouched = await adapter.findOne({
      model: "user",
      where: [{ field: "name", value: "User 1" }],
    });

    expect(updatedCount).toBe(3);
    expect(updated).toHaveLength(3);
    expect(untouched).toMatchObject({ name: "User 1", image: null });
  });

  it("updates records matching the starts_with operator", async () => {
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

    const updatedCount = await adapter.updateMany({
      model: "user",
      where: [{ field: "name", value: "Admin", operator: "starts_with", connector: "AND" }],
      update: { image: "admin.png" },
    });

    const admins = await adapter.findMany<{ name: string; image: string | null }>({
      model: "user",
      where: [{ field: "image", value: "admin.png" }],
    });
    const member = await adapter.findOne({
      model: "user",
      where: [{ field: "email", value: "member.one@example.com" }],
    });

    expect(updatedCount).toBe(2);
    expect(admins).toHaveLength(2);
    expect(member).toMatchObject({ image: null });
  });

  it("updates records matching multiple where conditions with AND logic", async () => {
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

    const updatedCount = await adapter.updateMany({
      model: "user",
      where: [
        { field: "name", value: "Admin", operator: "starts_with", connector: "AND" },
        { field: "email", value: "admin@example.com", operator: "eq", connector: "AND" },
      ],
      update: { image: "single-admin.png" },
    });

    const updated = await adapter.findMany<{ email: string; image: string | null }>({
      model: "user",
      where: [{ field: "image", value: "single-admin.png" }],
    });
    const otherAdmin = await adapter.findOne({
      model: "user",
      where: [{ field: "email", value: "admin.two@example.com" }],
    });

    expect(updatedCount).toBe(1);
    expect(updated).toHaveLength(1);
    expect(updated[0]).toMatchObject({ email: "admin@example.com" });
    expect(otherAdmin).toMatchObject({ image: null });
  });

  it("can update multiple fields at once", async () => {
    await adapter.create({
      model: "user",
      data: { name: "Admin Alpha", email: "admin.alpha@example.com" },
    });
    await adapter.create({
      model: "user",
      data: { name: "Admin Beta", email: "admin.beta@example.com" },
    });

    const updatedCount = await adapter.updateMany({
      model: "user",
      where: [{ field: "email", value: "admin", operator: "starts_with", connector: "AND" }],
      update: { name: "Renamed Admin", image: "multi-field.png" },
    });

    const results = await adapter.findMany<{ name: string; image: string | null }>({ model: "user" });

    expect(updatedCount).toBe(2);
    expect(results.every((record) => record.name === "Renamed Admin")).toBe(true);
    expect(results.every((record) => record.image === "multi-field.png")).toBe(true);
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

    const updatedCount = await adapter.updateMany({
      model: "user",
      where: [{ field: "email", value: "missing@example.com", operator: "eq", connector: "AND" }],
      update: { image: "should-not-apply.png" },
    });

    const results = await adapter.findMany<{ image: string | null }>({ model: "user" });

    expect(updatedCount).toBe(0);
    expect(results.every((record) => record.image === null)).toBe(true);
  });

  it("returns an update count that matches the number of changed rows", async () => {
    await adapter.create({
      model: "user",
      data: { name: "Team Alpha", email: "team.alpha@example.com" },
    });
    await adapter.create({
      model: "user",
      data: { name: "Team Beta", email: "team.beta@example.com" },
    });
    await adapter.create({
      model: "user",
      data: { name: "Guest One", email: "guest.one@example.com" },
    });

    const beforeCount = await adapter.count({
      model: "user",
      where: [{ field: "image", value: "team.png" }],
    });

    const updatedCount = await adapter.updateMany({
      model: "user",
      where: [{ field: "name", value: "Team", operator: "starts_with", connector: "AND" }],
      update: { image: "team.png" },
    });

    const afterCount = await adapter.count({
      model: "user",
      where: [{ field: "image", value: "team.png" }],
    });

    expect(afterCount - beforeCount).toBe(updatedCount);
    expect(updatedCount).toBe(2);
  });
});
