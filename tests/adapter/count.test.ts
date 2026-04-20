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
