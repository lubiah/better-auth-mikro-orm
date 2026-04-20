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
