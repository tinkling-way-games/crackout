// @types/node を入れずにテストを型チェックするための最小限の宣言。
// npm でパッケージを入れられるようになったら @types/node に置き換えてよい。
declare module 'node:test' {
  type Fn = () => void | Promise<void>;
  export function describe(name: string, fn: Fn): void;
  export function it(name: string, fn: Fn): void;
  export function test(name: string, fn: Fn): void;
}

declare module 'node:assert/strict' {
  interface Assert {
    (value: unknown, message?: string): asserts value;
    ok(value: unknown, message?: string): asserts value;
    equal<T>(actual: unknown, expected: T, message?: string): asserts actual is T;
    notEqual(actual: unknown, expected: unknown, message?: string): void;
    deepEqual<T>(actual: unknown, expected: T, message?: string): asserts actual is T;
    throws(fn: () => unknown, error?: RegExp, message?: string): void;
  }
  const assert: Assert;
  export default assert;
}
