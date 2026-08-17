import { describe, expect, it } from "vitest";
import { transformWhere } from "../src/utils";

describe("transformWhere", () => {
  it("returns an empty object when there is no where clause", () => {
    expect(transformWhere(undefined)).toEqual({});
    expect(transformWhere([])).toEqual({});
  });

  it("never emits an empty $or — only $and when AND conditions exist", () => {
    // Regression: the old implementation always returned { $and: [...], $or: [] },
    // and MikroORM >= 7.1.9 renders an empty $or as `1 = 0`, breaking every read.
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
