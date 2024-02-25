import { Future } from "./future";
import { Option } from "./option";

export enum MaybeState {
  Pending,
  Fullfilled,
  Unfullfilled,
}

type MaybeCallback<T> = (maybe: Maybe<T>) => any;

export class Maybe<T> {
  static Fullfilled<T>(value: T): Maybe<T> {
    return new Maybe<T>(MaybeState.Fullfilled, value);
  }

  static Unfullfilled<T>(): Maybe<T> {
    return new Maybe<T>(MaybeState.Unfullfilled, null);
  }

  static new<T>(callback: MaybeCallback<T>): Maybe<T> {
    return new Maybe<T>(MaybeState.Pending, callback);
  }

  private constructor(
    private state: MaybeState,
    private value: T | null | MaybeCallback<T>
  ) {
    if (state === MaybeState.Pending) {
      const callback = value as MaybeCallback<T>;

      callback(this);
    }
  }

  private resolvedQueue = new Set<(value: Option<T>) => void>;

  public fullfill(data: T) {
    if (this.state !== MaybeState.Pending)
      throw new Error("called `Maybe.fullfill()` on a non-pending maybe");

    this.state = MaybeState.Fullfilled;
    this.value = data;

    for (const callback of this.resolvedQueue)
      callback(Option.some(data));
  }

  public unfullfill() {
    if (this.state !== MaybeState.Pending)
      throw new Error("called `Maybe.unfullfill()` on a non-pending maybe");

    this.state = MaybeState.Unfullfilled;

    for (const callback of this.resolvedQueue)
      callback(Option.none());
  }

  public isPending(): boolean { return this.state === MaybeState.Pending; }
  public isFullfilled(): boolean { return this.state === MaybeState.Fullfilled; }
  public isUnfullfilled(): boolean { return this.state === MaybeState.Unfullfilled; }

  public then(onFullfilled: (value: Option<T>) => void, onRejected?: (value: never) => void) {
    if (!this.isPending()) {
      if (this.isFullfilled())
        onFullfilled(Option.some(this.value as T));
      else
        onFullfilled(Option.none());
    }
    
    this.resolvedQueue.add(onFullfilled);
  }

  public async unwrap(): Promise<T> { return (await this).unwrap(); }
  public async unwrapOr(defaultValue: T): Promise<T> { return (await this).unwrapOr(defaultValue); }
  public async unwrapOrElse(fn: () => T): Promise<T> { return (await this).unwrapOrElse(fn); }
  public async expect(message: string): Promise<T> { return (await this).expect(message); }

  public map<U>(fn: (value: T) => U): Maybe<U> {
    if (this.isUnfullfilled())
      return Maybe.Unfullfilled();

    if (this.isFullfilled())
      return Maybe.Fullfilled(fn(this.value as T));

    return Maybe.new((maybe) => {
      this.then(value => {
        if (value.isNone())
          maybe.unfullfill();
        else
          maybe.fullfill(fn(value.unwrap()));
      });
    });
  }
  
  public flatMap<U>(fn: (value: T) => Maybe<U>): Maybe<U> {
    if (this.isUnfullfilled())
      return Maybe.Unfullfilled();

    if (this.isFullfilled())
      return fn(this.value as T);

    return Maybe.new((maybe) => {
      this.then(value => {
        if (value.isNone())
          maybe.unfullfill();
        else
          fn(value.unwrap()).then(value => {
            if (value.isNone())
              maybe.unfullfill();
            else
              maybe.fullfill(value.unwrap());
          });
      });
    });
  }

  public okOr<E>(error: E): Future<T, E> {
    if (this.isUnfullfilled())
      return Future.Rejected(error);

    if (this.isFullfilled())
      return Future.Resolved(this.value as T);

    return Future.new((future) => {
      this.then(value => {
        if (value.isNone())
          future.reject(error);
        else
          future.resolve(value.unwrap());
      });
    });
  }

  public okOrElse<E>(fn: () => E): Future<T, E> {
    if (this.isUnfullfilled())
      return Future.Rejected(fn());

    if (this.isFullfilled())
      return Future.Resolved(this.value as T);

    return Future.new((future) => {
      this.then(value => {
        if (value.isNone())
          future.reject(fn());
        else
          future.resolve(value.unwrap());
      });
    });
  }

  or(maybe: Maybe<T>): Maybe<T> {
    if (this.isFullfilled())
      return this;
    
    return Maybe.new((maybe) => {
      this.then(value => {
        if (value.isNone())
          maybe.unfullfill();
        else
          maybe.fullfill(value.unwrap());
      });
    });
  }

  and(maybe: Maybe<T>): Maybe<T> {
    if (this.isUnfullfilled())
      return this;

    return Maybe.new((maybe) => {
      this.then(value => {
        if (value.isNone())
          maybe.unfullfill();
        else
          maybe.fullfill(value.unwrap());
      });
    });
  }
}