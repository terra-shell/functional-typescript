export enum OptionState {
  Some,
  None
}

export class Option<T> {
  static some<T>(value: T): Option<T> {
    return new Option<T>(OptionState.Some, value);
  }

  static none<T>(): Option<T> {
    return new Option<T>(OptionState.None, null);
  }

  static fromNullable<T>(value: T | null | undefined): Option<T> {
    if (value === null || value === undefined)
      return Option.none();

    return Option.some(value);
  }
  
  constructor(
    private state: OptionState,
    private value: T | null
  ) {}

  isSome(): boolean { return this.state === OptionState.Some; }
  isNone(): boolean { return this.state === OptionState.None; }

  unwrap(): T {
    if (this.isNone())
      throw new Error("called `Option.unwrap()` on a `None` value");

    return this.value as T;
  }

  unwrapOr(defaultValue: T): T {
    if (this.isSome())
      return this.value as T;

    return defaultValue;
  }

  unwrapOrElse(fn: () => T): T {
    if (this.isSome())
      return this.value as T;

    return fn();
  }

  expect(message: string): T {
    if (this.isNone())
      throw new Error(message);

    return this.value as T;
  }

  map<U>(fn: (value: T) => U): Option<U> {
    if (this.isNone())
      return Option.none();

    return Option.some(fn(this.value as T));
  }

  flatMap<U>(fn: (value: T) => Option<U>): Option<U> {
    if (this.isNone())
      return Option.none();

    return fn(this.value as T);
  }
}