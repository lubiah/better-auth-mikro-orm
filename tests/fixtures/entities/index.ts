import { defineEntity, p } from "@mikro-orm/core";

export const UserEntity = defineEntity({
  name: "user",
  properties: {
    id: p.string().primary(),
    name: p.string(),
    email: p.string(),
    emailVerified: p.boolean(),
    image: p.string().nullable(),
    createdAt: p.datetime(),
    updatedAt: p.datetime(),
  },
});

export const SessionEntity = defineEntity({
  name: "session",
  properties: {
    id: p.string().primary(),
    userId: () => p.manyToOne(UserEntity).foreignKeyName("userId"),
    token: p.string(),
    expiresAt: p.datetime(),
    ipAddress: p.string().nullable(),
    userAgent: p.string().nullable(),
    createdAt: p.datetime(),
    updatedAt: p.datetime(),
  },
});

export const AccountEntity = defineEntity({
  name: "account",
  properties: {
    id: p.string().primary(),
    userId: () => p.manyToOne(UserEntity),
    accountId: p.string(),
    providerId: p.string(),
    accessToken: p.string().nullable(),
    refreshToken: p.string().nullable(),
    accessTokenExpiresAt: p.datetime().nullable(),
    refreshTokenExpiresAt: p.datetime().nullable(),
    scope: p.string().nullable(),
    idToken: p.string().nullable(),
    password: p.string().nullable(),
    createdAt: p.datetime(),
    updatedAt: p.datetime(),
  },
});

export const VerificationEntity = defineEntity({
  name: "verification",
  properties: {
    id: p.string().primary(),
    identifier: p.string(),
    value: p.string(),
    expiresAt: p.datetime(),
    createdAt: p.datetime(),
    updatedAt: p.datetime(),
  },
});

export const coreEntities = [
  UserEntity,
  SessionEntity,
  AccountEntity,
  VerificationEntity,
];
