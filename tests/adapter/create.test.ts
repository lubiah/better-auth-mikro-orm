import { MikroORM } from "@mikro-orm/sqlite";
import { beforeEach, describe, expect, it } from "vitest";
import { adapter as mikroAdapter } from "../../src/adapter";
import { AccountEntity, coreEntities, SessionEntity } from "../fixtures/entities";

const orm = await MikroORM.init({
  dbName: ":memory:",
  entities: coreEntities,
});

const adapter = mikroAdapter(orm)({});

beforeEach(async () => {
  await orm.schema.refresh();
});

describe.only("adapter create function", () => {
  describe("adapter create function", () => {
    it("can create model data", async () => {
      const results = await adapter.create({
        model: "user",
        data: {
          name: "Test",
          email: "test@example.com",
        },
      });

      expect(results).toMatchObject({ name: "Test", email: "test@example.com" });
    });

    it("can create a session with a foreign key referencing a created user", async () => {
      const user = await adapter.create({
        model: "user",
        data: {
          name: "FK User",
          email: "fk@example.com",
        },
      });

      const session = await adapter.create({
        model: "session",
        data: {
          token: "test-token",
          userId: user.id,
          expiresAt: new Date(Date.now() + 86400_000),
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });

      expect(session).toMatchObject({ token: "test-token" });
      expect(session.userId).toBe(user.id);

      const storedSession = await orm.em.fork().findOne(SessionEntity, { id: session.id });

      expect(storedSession).not.toBeNull();
      expect(storedSession?.userId.id).toBe(user.id);
    });

    it("can create an account with a foreign key referencing a created user", async () => {
      const user = await adapter.create({
        model: "user",
        data: {
          name: "Account User",
          email: "account@example.com",
        },
      });

      const account = await adapter.create({
        model: "account",
        data: {
          userId: user.id,
          accountId: "provider-account-1",
          providerId: "github",
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });

      expect(account).toMatchObject({
        userId: user.id,
        accountId: "provider-account-1",
        providerId: "github",
      });

      const storedAccount = await orm.em.fork().findOne(AccountEntity, { id: account.id });

      expect(storedAccount).not.toBeNull();
      expect(storedAccount?.userId.id).toBe(user.id);
    });

    it("can create multiple related records for the same user", async () => {
      const user = await adapter.create({
        model: "user",
        data: {
          name: "Multi Relation User",
          email: "multi@example.com",
        },
      });

      const session = await adapter.create({
        model: "session",
        data: {
          token: "shared-user-session",
          userId: user.id,
          expiresAt: new Date(Date.now() + 86400_000),
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });

      const account = await adapter.create({
        model: "account",
        data: {
          userId: user.id,
          accountId: "shared-provider-account",
          providerId: "google",
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });

      expect(session.userId).toBe(user.id);
      expect(account.userId).toBe(user.id);
    });
  });
});
