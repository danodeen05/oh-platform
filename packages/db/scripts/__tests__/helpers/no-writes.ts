/**
 * Task G3: wraps a (fake or memory) Prisma client so any write throws.
 * A dry run that touches a write method fails its test loudly, instead of
 * a test having to diff state after the fact. Transactions are wrapped too:
 * the `tx` handed to a `$transaction` callback is guarded the same way.
 */
const WRITE_METHODS = new Set(["create", "createMany", "update", "updateMany", "upsert", "delete", "deleteMany", "$executeRaw", "$executeRawUnsafe"]);

export function noWrites<T extends object>(client: T, log: string[] = []): T {
  const wrapDelegate = (name: string, delegate: any) =>
    new Proxy(delegate, {
      get(target, prop, receiver) {
        const value = Reflect.get(target, prop, receiver);
        if (typeof prop === "string" && WRITE_METHODS.has(prop)) {
          return async () => {
            log.push(`${name}.${prop}`);
            throw new Error(`dry run wrote: ${name}.${prop}`);
          };
        }
        return typeof value === "function" ? value.bind(target) : value;
      },
    });
  return new Proxy(client as any, {
    get(target, prop, receiver) {
      const value = Reflect.get(target, prop, receiver);
      if (prop === "$transaction" && typeof value === "function") {
        return (fn: any) => value.call(target, (tx: any) => fn(noWrites(tx, log)));
      }
      if (typeof prop === "string" && WRITE_METHODS.has(prop)) {
        return async () => {
          log.push(String(prop));
          throw new Error(`dry run wrote: ${String(prop)}`);
        };
      }
      if (value && typeof value === "object" && typeof prop === "string" && !prop.startsWith("$")) return wrapDelegate(prop, value);
      return typeof value === "function" ? value.bind(target) : value;
    },
  }) as T;
}
