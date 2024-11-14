import { Future } from "./future";
import { Maybe } from "./maybe";
import { Option } from "./option";

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

  public map<N>(mapper: (input: T) => N) {
    let iterator = this.iterator;

    return new AsyncIterator(async function*() {
      for await (let item of iterator) {
        yield mapper(item)
      }
    })
  }

  public flatMap<N>(mapper: (input: T) => (Option<N> | Maybe<N>)) {
    let iterator = this.iterator;

    return new AsyncIterator(async function*() {
      for await (let item of iterator) {
        let result = await mapper(item);

        if (result.isSome()) {
          yield result.unwrap();
        }
      }
    })
  }

  public async collectArray(): Promise<T[]> {
    let iterator = this.iterator;
    let results = [];

    for await (let item of iterator) {
      results.push(item);
    }

    return results;
  }
}