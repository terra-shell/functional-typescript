import { Maybe } from "./maybe";

export class AsyncIterator<T> {
  static From<T>(iterable: AsyncIterable<T>): AsyncIterator<Awaited<T>> {
    return new AsyncIterator(async function* () { yield* iterable; });
  }

  static Empty(): AsyncIterator<never> {
    return new AsyncIterator(async function* () { });
  }

  private constructor(generator: () => AsyncIterableIterator<T>) {
    this.iterator = generator();
  }

  private iterator: AsyncIterableIterator<T>;

  public [Symbol.asyncIterator]() {
    return this.iterator;
  }

  public next(): Maybe<T> {
    return Maybe.new(async maybe => {
      const result = await this.iterator.next();

      if (result.done) maybe.unfullfill();
      else maybe.fullfill(result.value);
    });
  }
}