import { match } from "./match";
import { Option } from "./option";

export class Iterator<T> {
  static Range(start: number, end: number, step: number = 1): Iterator<number> {
    return new Iterator(function* () {
      for (let i = start; i < end; i += step) {
        yield i;
      }
    });
  }

  static Repeat<T>(value: T, times: number): Iterator<T> {
    return new Iterator(function* () {
      for (let i = 0; i < times; i++) {
        yield value;
      }
    });
  }

  static From<T>(iterable: Iterable<T>): Iterator<T> {
    return new Iterator(function* () { yield* iterable; });
  }

  static Empty(): Iterator<never> {
    return new Iterator(function* () {});
  }

  private constructor(generator: () => IterableIterator<T>) {
    this.iterator = generator();
  }

  private iterator: IterableIterator<T>;

  public [Symbol.iterator]() {
    return this.iterator;
  }

  public next(): Option<T> {
    const result = this.iterator.next();

    if (result.done)
      return Option.none();

    return Option.some(result.value);
  }
}