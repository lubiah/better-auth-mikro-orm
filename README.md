# @lubiah/better-auth-mikro-orm

MikroORM adapter for Better Auth.

## Installation

Using npm:

```bash
npm i @lubiah/better-auth-mikro-orm
```

Using pnpm:

```bash
pnpm add @lubiah/better-auth-mikro-orm
```

Using yarn:

```bash
yarn add @lubiah/better-auth-mikro-orm
```

## Usage

```ts
import { betterAuth } from "better-auth";
import { adapter as mikroOrmAdapter } from "@lubiah/better-auth-mikro-orm";
import { orm } from "./orm";

export const auth = betterAuth({
  database: mikroOrmAdapter(orm),
  advanced: {
    database: {
      // Disable if IDs are already managed by MikroORM
      generateId: false,
    },
  },
});
```

Note:

- This adapter does not create or migrate schema for you.
- Better Auth model names must match your MikroORM table names.

## API

```ts
adapter(orm: MikroORM, config?: MikroOrmAdapterConfig)
```

Creates a Better Auth database adapter bound to your MikroORM instance.

### Config

```ts
interface MikroOrmAdapterConfig {
  debugLogs?: boolean;
  usePlural?: boolean;
  supportsJSON?: boolean;
  supportsDates?: boolean;
  supportsBooleans?: boolean;
  supportsNumericIds?: boolean;
  supportsJoin?: boolean;
}
```

## License

MIT
