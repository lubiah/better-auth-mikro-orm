import type { Where } from "@better-auth/core/db/adapter";
import { MikroORM } from "@mikro-orm/core";
import { BetterAuthError } from "better-auth";

export const getEntityByModel = (orm: MikroORM, model: string) => {
  const entities = Array.from(orm.getMetadata().getAll().values());
  const entity = entities.find(e => e.tableName === model);
  if (!entity) {
    throw new BetterAuthError(`No entity found for model ${model}`);
  }
  return entity.class;
};

export const transformWhere = (where?: Where[]) => {
  if (!where || where.length === 0) return {};

  const condition = (field: string, operator: string, value: Where["value"]) => ({
    [field]: { [operator === "eq" ? "$eq" : `$${operator}`]: value },
  });

  const and: Record<string, unknown>[] = [];
  const or: Record<string, unknown>[] = [];

  for (const { connector, operator, field, value } of where) {
    const target = connector === "OR" ? or : and;
    switch (operator) {
      case "in":
        target.push({ [field]: { $in: value } });
        break;
      case "not_in":
        target.push({ [field]: { $nin: value } });
        break;
      case "contains":
        target.push({ [field]: { $like: `%${value}%` } });
        break;
      case "starts_with":
        target.push({ [field]: { $like: `${value}%` } });
        break;
      case "ends_with":
        target.push({ [field]: { $like: `%${value}` } });
        break;
      case "gt":
      case "gte":
      case "lt":
      case "lte":
      case "ne":
      case "eq":
      case undefined:
        target.push(condition(field, operator ?? "eq", value));
        break;
      default:
        // Unknown operator — pass raw equality through rather than dropping.
        target.push({ [field]: { $eq: value } });
    }
  }

  const result: Record<string, unknown> = {};
  if (and.length > 0) result.$and = and;
  if (or.length > 0) result.$or = or;
  return result;
};
