import { vi } from "vitest";

export type Result = { data: any; error: any };
export function mockDatabase() {
  const results: Result[] = [];
  const calls: { table: string; steps: [string, ...any[]][] }[] = [];
  const from = vi.fn((table: string) => {
    const call = { table, steps: [] as [string, ...any[]][] };
    calls.push(call);
    const query: any = {};
    for (const method of [
      "select",
      "insert",
      "update",
      "upsert",
      "delete",
      "eq",
      "in",
      "or",
      "ilike",
      "gte",
      "gt",
      "lte",
      "not",
      "order",
      "limit",
    ]) {
      query[method] = (...args: any[]) => {
        call.steps.push([method, ...args]);
        return query;
      };
    }
    const resolve = () =>
      Promise.resolve(results.shift() || { data: null, error: null });
    query.single = () => {
      call.steps.push(["single"]);
      return resolve();
    };
    query.maybeSingle = () => {
      call.steps.push(["maybeSingle"]);
      return resolve();
    };
    query.then = (success: any, failure: any) =>
      resolve().then(success, failure);
    return query;
  });
  const rpc = vi.fn((name: string, args: any) => {
    calls.push({ table: `rpc:${name}`, steps: [["args", args]] });
    return Promise.resolve(results.shift() || { data: null, error: null });
  });
  return {
    rpc,
    from,
    calls,
    reply: (data: any = null, error: any = null) =>
      results.push({ data, error }),
    reset: () => {
      calls.length = 0;
      results.length = 0;
      from.mockClear();
      rpc.mockClear();
    },
  };
}
