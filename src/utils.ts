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

export const transformWhere = (where: Where[]) => {
  const createCondition = (operator: string, field: string, value: Where["value"]) => {
    const condition: Record<string, Where["value"]> = {};
    condition[operator] = value;
    const fieldCondition: Record<string, unknown> = {};
    fieldCondition[field] = condition;
    return fieldCondition;
  };

  if (!where) return {};
  const obj: { $and: Record<string, unknown>[]; $or: Record<string, unknown>[] } = {
    $and: [],
    $or: [],
  };
  where.forEach(({ connector, operator, field, value }) => {
    if (connector === "AND") {
      switch (operator) {
        case "eq":
        case "ne":
        case "gt":
        case "gte":
        case "lt":
        case undefined:
        case "lte": {
          operator = operator === undefined ? "eq" : operator;
    const condition = createCondition(`$${operator}`, field, value);
          obj.$and.push(condition);
          break;
        }
        case "starts_with":
            const condition = createCondition("$like",field, `${value}%`);
            obj.$and.push(condition);
            break;
      }
    }
  });

  return obj;
};
