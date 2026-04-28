import type { BetterAuthOptions } from "@better-auth/core";
import { createAdapterFactory, type DBAdapter, type DBAdapterDebugLogOption } from "@better-auth/core/db/adapter";
import type { AdapterFactoryCustomizeAdapterCreator, AdapterFactoryOptions } from "@better-auth/core/db/adapter";
import type { EntityDTO, MikroORM } from "@mikro-orm/core";
import { serialize, wrap } from "@mikro-orm/core";
import { getEntityByModel, transformWhere } from "./utils";

export interface MikroOrmAdapterConfig {
  /**
   * Helps you debug issues with the adapter.
   */
  debugLogs?: DBAdapterDebugLogOption;
  /**
   * If the table names in the schema are plural.
   */
  usePlural?: boolean;
  supportsJSON?: boolean;
  supportsDates?: boolean;
  supportsBooleans?: boolean;
  supportsNumericIds?: boolean;
  supportsJoin?: boolean;
}

type FindOneReturn<T> = T | null;
type FindManyReturn<T> = T[];

export const adapter = (orm: MikroORM, config: MikroOrmAdapterConfig = {}) => {
  let options: BetterAuthOptions | null = null;
  const createAdapter = (em: MikroORM["em"]): AdapterFactoryCustomizeAdapterCreator => () => {
    return {
      create: async ({ data, model, select }) => {
        const entity = getEntityByModel(orm, model);
        const instance = em.create(entity, data as EntityDTO<typeof entity>);
        await em.flush();
        return serialize(instance, { forceObject: false }) as typeof data;
      },
      update: async ({ where, update, model }) => {
        const entity = getEntityByModel(orm, model);
        const transformedWhereQuery = transformWhere(where);
        const instance = await em.findOne(entity, transformedWhereQuery);
        wrap(instance).assign(update as EntityDTO<typeof entity>);
        await em.flush();
        return wrap(instance).serialize() as typeof update;
      },
      updateMany: async ({ model, where, update }) => {
        const entity = getEntityByModel(orm, model);
        const transformedWhereQuery = transformWhere(where);
        const instances = await em.nativeUpdate(entity, transformedWhereQuery, update as EntityDTO<typeof entity>);
        return instances;
      },

      findOne: async <T>({ model, where, select, join }: Parameters<DBAdapter["findOne"]>[0]) => {
        const entity = getEntityByModel(orm, model);
        const transformedWhereQuery = transformWhere(where);

        const result =
          (await em.findOne(entity, transformedWhereQuery, { fields: select }));
          if (!result) return null;
        return serialize(result, { forceObject: false });
      },
      findMany: async <T>(
        { model, where, limit, select, sortBy, offset, join }: Parameters<DBAdapter["findMany"]>[0],
      ) => {
        const entity = getEntityByModel(orm, model);
        const transformedWhereQuery = where ? transformWhere(where) : {};
        const instances = await em.find(entity, transformedWhereQuery, {
          limit,
          offset,
          fields: select,
          ...(sortBy && { orderBy: { [sortBy.field]: sortBy.direction } }),
        });
        return serialize(instances) as FindManyReturn<T>;
      },
      count: async ({ model, where }) => {
        const entity = getEntityByModel(orm, model);
        const transformedWhereQuery = where ? transformWhere(where) : {};
        return await em.count(entity, transformedWhereQuery);
      },
      delete: async ({ model, where }) => {
        const entity = getEntityByModel(orm, model);
        const transformedWhereQuery = where ? transformWhere(where) : {};
        const instances = await em.find(entity, transformedWhereQuery);
        em.remove(instances);
        await em.flush();
      },
      deleteMany: async ({ model, where }) => {
        const entity = getEntityByModel(orm, model);
        const transformedWhereQuery = where ? transformWhere(where) : {};
        const instances = await em.nativeDelete(entity, transformedWhereQuery);
        return instances;
      },
    };
  };
  let adapterOptions: AdapterFactoryOptions = {
    config: {
      adapterId: "mikro-orm",
      adapterName: "MikroORM Adapter",
      usePlural: config.usePlural ?? false,
      debugLogs: config.debugLogs ?? false,
      supportsJSON: config.supportsJSON ?? false,
      supportsDates: config.supportsDates ?? true,
      supportsBooleans: config.supportsBooleans ?? true,
      supportsNumericIds: config.supportsNumericIds ?? true,
      transaction: async callback =>
        await orm.em.transactional(async em => {
          const adapter = createAdapterFactory({
            config: adapterOptions.config!,
            adapter: createAdapter(em),
          });
          return callback(adapter(options!));
        }),
    },
    adapter: createAdapter(orm.em.fork()),
  };

  const factory = createAdapterFactory(adapterOptions);
  return (opts: BetterAuthOptions) => {
    options = opts;
    return factory(opts);
  };
};
