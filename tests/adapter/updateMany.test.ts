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
