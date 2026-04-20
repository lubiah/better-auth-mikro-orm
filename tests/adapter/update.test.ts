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
