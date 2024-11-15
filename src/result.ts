import { Option } from "./option";

enum ResultState {
  Ok,
  Err
}

export class Result<T, E> {
  static ok<T, E>(value: T): Result<T, E> {
    return new Result<T, E>(ResultState.Ok, value);
  }

  static err<T, E>(value: E): Result<T, E> {
    return new Result<T, E>(ResultState.Err, value);
  }

  static fromError<T, E>(error: E): ResultBuilder<T, E> {
    return new ResultBuilder(Result.err(error))
  }

  static try<T>(callback: () => T): ResultBuilder<T, unknown> {
    try {
      return new ResultBuilder(Result.ok(callback()))
    } catch(err) {
      return new ResultBuilder(Result.err(err))
    }
  }

  private constructor(
    private state: ResultState,
    private value: T | E
  ) {}

  isOk(): this is Result<T, never> { return this.state === ResultState.Ok; }
  isErr(): this is Result<never, E> { return this.state === ResultState.Err; }

  ok(): Option<T> {
    if (this.isErr())
      return Option.none();

    return Option.some(this.value as T);
  }

  err(): Option<E> {
    if (this.isOk())
      return Option.none();

    return Option.some(this.value as E);
  }

  unwrap(): T {
    if (this.isErr())
      throw new Error("called `Result.unwrap()` on an `Err` value: " + this.value);

    return this.value as T;
  }

  unwrapErr(): E {
    if (this.isOk())
      throw new Error("called `Result.unwrapErr()` on an `Ok` value: " + this.value);

    return this.value as E;
  }

  unwrapOr(defaultValue: T): T {
    if (this.isOk())
      return this.value as T;

    return defaultValue;
  }

  unwrapErrOr(defaultValue: E): E {
    if (this.isErr())
      return this.value as E;

    return defaultValue;
  }

  unwrapOrElse(fn: (value: E) => T): T {
    if (this.isOk())
      return this.value as T;

    return fn(this.value as E);
  }

  unwrapErrOrElse(fn: (value: T) => E): E {
    if (this.isErr())
      return this.value as E;

    return fn(this.value as T);
  }

  expect(message: string): T {
    if (this.isErr())
      throw new Error(message);

    return this.value as T;
  }

  expectErr(message: string): E {
    if (this.isOk())
      throw new Error(message);

    return this.value as E;
  }

  mapInstanceOf<K extends abstract new (...args: any) => any, N>(klass: K, mapper: (value: InstanceType<K>) => N): Result<Exclude<T, InstanceType<K>> | N, E> {
    if (this.isErr())
      return Result.err(this.value as E);

    if (this.value instanceof klass)
      return Result.ok(mapper(this.value as InstanceType<K>));

    return Result.ok(this.value as T);
  }

  map<U>(fn: (value: T) => U): Result<U, E> {
    if (this.isErr())
      return Result.err(this.value as E);

    return Result.ok(fn(this.value as T));
  }

  flatMap<Nt, Ne>(fn: (value: T) => Result<Nt, Ne>): Result<Nt, Ne | E> {
    if (this.isErr())
      return Result.err(this.value as E);

    return fn(this.value as T);
  }

  flatMapErr<Nt, Ne>(fn: (value: E) => Result<Nt, Ne>): Result<Nt | T, Ne> {
    if (this.isErr())
      return fn(this.value as E);

    return Result.ok(this.value as T);
  }

  mapErrInstanceOf<K extends abstract new (...args: any) => any, N>(klass: K, mapper: (value: InstanceType<K>) => N): Result<T, Exclude<E, InstanceType<K>> | N> {
    if (this.isOk())
      return Result.ok(this.value as T);

    if (this.value instanceof klass)
      return Result.err(mapper(this.value as InstanceType<K>));

    return Result.err(this.value as E);
  }

  mapErr<U>(fn: (value: E) => U): Result<T, U> {
    if (this.isOk())
      return Result.ok(this.value as T);

    return Result.err(fn(this.value as E));
  }
}

class ResultBuilder<T, E, AllowedTypes extends any[] = []> {
  constructor(private result: Result<T, E>) {}

  private allowedTypes: AllowedTypes = [] as any;

  allowErrInstanceOf<Et>(type: Et): ResultBuilder<T, E, [...AllowedTypes, Et]> {
    this.allowedTypes.push(type);
    return this as any;
  }

  otherwiseThrow(): Result<T, {
    [key in keyof AllowedTypes]: InstanceType<AllowedTypes[key]>;
  }[number]> {
    if (this.result.isOk())
      return this.result;

    let v = this.result.unwrapErr();

    for (let i = 0; i < this.allowedTypes.length; i++) {
      if (v instanceof this.allowedTypes[i]) {
        return this.result as any;
      }
    }

    throw v;
  }
}