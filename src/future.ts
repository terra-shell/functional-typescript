import { Matcher } from "./match";
import { Maybe } from "./maybe";
import { Result } from "./result";

export enum FutureState {
  Pending,
  Resolved,
  Rejected
}

type FutureCallback<T, E> = (future: Future<T, E>) => any;

export class Future<T, E> {
  static FromResult<T, E>(result: Result<T, E>): Future<T, E> {
    if (result.isOk())
      return Future.Resolved(result.unwrap());
    else
      return Future.Rejected(result.unwrapErr());
  }

  static Resolved<T, E>(value: T): Future<T, E> {
    return new Future<T, E>(FutureState.Resolved, value);
  }

  static ResolvesIn<T, E>(ms: number, value: T): Future<T, E> {
    return new Future<T, E>(FutureState.Pending, (future) => {
      setTimeout(() => future.resolve(value), ms);
    });
  }

  static Rejected<T, E>(value: E): Future<T, E> {
    return new Future<T, E>(FutureState.Rejected, value);
  }

  static RejectsIn<T, E>(ms: number, value: E): Future<T, E> {
    return new Future<T, E>(FutureState.Pending, (future) => {
      setTimeout(() => future.reject(value), ms);
    });
  }

  static new<T, E>(callback?: FutureCallback<T, E>): Future<T, E> {
    return new Future<T, E>(FutureState.Pending, callback ?? (() => {}));
  }

  constructor(
    private state: FutureState,
    private value: T | E | FutureCallback<T, E>
  ) {
    if (state === FutureState.Pending) {
      const callback = value as FutureCallback<T, E>;

      callback(this);
    }
  }

  private resolvedQueue = new Set<(value: Result<T, E>) => void>();

  public resolve(data: T) {
    if (this.state !== FutureState.Pending)
      throw new Error("called `Future.resolve()` on a non-pending future");

    this.state = FutureState.Resolved;
    this.value = data;
  }

  public reject(error: E) {
    if (this.state !== FutureState.Pending)
      throw new Error("called `Future.reject()` on a non-pending future");

    this.state = FutureState.Rejected;
    this.value = error;
  }

  public isPending(): boolean { return this.state === FutureState.Pending; }
  public isResolved(): this is Future<T, never> { return this.state === FutureState.Resolved; }
  public isRejected(): this is Future<never, E> { return this.state === FutureState.Rejected; }

  public then(onResolved: (value: Result<T, E>) => void, onRejected?: (value: never) => void) {
    if (!this.isPending()) {
      if (this.isResolved())
        onResolved(Result.ok(this.value as T));
      else
        onResolved(Result.err(this.value as E));
    }

    this.resolvedQueue.add(onResolved);
  }

  public resolved(): Maybe<T> {
    return Maybe.new<T>(maybe => {
      this.then(result => {
        if (result.isOk())
          maybe.fullfill(result.unwrap());
        else
          maybe.unfullfill();
      });
    });
  }

  public rejected(): Maybe<E> {
    return Maybe.new<E>(maybe => {
      this.then(result => {
        if (result.isErr())
          maybe.fullfill(result.unwrapErr());
        else
          maybe.unfullfill();
      });
    });
  }

  public async unwrap(): Promise<T> { return (await this.resolved()).unwrap(); }
  public async unwrapErr(): Promise<E> { return (await this.rejected()).unwrap(); }
  public async unwrapOr(defaultValue: T): Promise<T> { return (await this.resolved()).unwrapOr(defaultValue); }
  public async unwrapErrOr(defaultValue: E): Promise<E> { return (await this.rejected()).unwrapOr(defaultValue); }
  public async unwrapOrElse(fn: () => T): Promise<T> { return (await this.resolved()).unwrapOrElse(fn); }
  public async unwrapErrOrElse(fn: () => E): Promise<E> { return (await this.rejected()).unwrapOrElse(fn); }
  public async expect(message: string): Promise<T> { return (await this.resolved()).expect(message); }
  public async expectErr(message: string): Promise<E> { return (await this.rejected()).expect(message); }

  public map<U>(fn: (value: T) => U): Future<U, E> {
    if (this.isRejected())
      return this as unknown as Future<U, E>;

    if (this.isResolved())
      return Future.Resolved(fn(this.value as T));

    return Future.new((future) => {
      this.then(result => {
        if (result.isOk())
          future.resolve(fn(result.unwrap()));
        else
          future.reject(result.unwrapErr());
      });
    });
  }

  public mapErr<F>(fn: (value: E) => F): Future<T, F> {
    if (this.isResolved())
      return this as unknown as Future<T, F>;

    if (this.isRejected())
      return Future.Rejected(fn(this.value as E));

    return Future.new((future) => {
      this.then(result => {
        if (result.isOk())
          future.resolve(result.unwrap());
        else
          future.reject(fn(result.unwrapErr()));
      });
    });
  }

  public flatMap<U>(fn: (value: T) => Future<U, E> | Result<U, E>): Future<U, E> {
    if (this.isRejected())
      return this as unknown as Future<U, E>;

    if (this.isResolved()) {
      const result = fn(this.value as T);

      if (result instanceof Future)
        return result;

      return Future.FromResult(result);
    }

    return Future.new((future) => {
      this.then(async result => {
        if (result.isOk()) {
          const val = await fn(result.unwrap());
          
          if (val.isOk())
            future.resolve(val.unwrap());
          else
            future.reject(val.unwrapErr());
        }
        else
          future.reject(result.unwrapErr());
      });
    });
  }

  and<OT, OE>(other: Future<OT, OE>): Future<[T, OT], E | OE> {
    if (this.isRejected())
      return this as unknown as Future<[T, OT], E | OE>;

    if (other.isRejected())
      return other as unknown as Future<[T, OT], E | OE>;

    if (this.isResolved() && other.isResolved())
      return Future.Resolved([this.value as T, other.value as OT]);

    if (this.isResolved())
      return other.map(value => [this.value as T, value] as [T, OT]) as unknown as Future<[T, OT], E | OE>;

    if (other.isResolved())
      return this.map(value => [value, other.value as OT] as [T, OT]) as unknown as Future<[T, OT], E | OE>;

    return Future.new((future) => {
      this.then(async result => {
        if (result.isOk()) {
          const val = await other;

          if (val.isOk())
            future.resolve([result.unwrap(), val.unwrap()]);
          else
            future.reject(val.unwrapErr());
        }
        else
          future.reject(result.unwrapErr());
      });
    });
  }

  public match() {
    return Matcher.new(evaluator => this.map(evaluator))
  }

  public flatMatch() {
    return Matcher.new(evaluator => this.flatMap(evaluator))
  }

  public race(other: Future<T, E>): Future<T, E> {
    if (this.isResolved() || this.isRejected())
      return this;

    if (other.isResolved() || other.isRejected())
      return other;

    return Future.new((future) => {
      let cancelled = false;

      this.then(result => {
        if (cancelled)
          return;

        cancelled = true;

        if (result.isOk())
          future.resolve(result.unwrap());
        else
          future.reject(result.unwrapErr());
      });

      other.then(result => {
        if (cancelled)
          return;

        cancelled = true;

        if (result.isOk())
          future.resolve(result.unwrap());
        else
          future.reject(result.unwrapErr());
      });
    });
  }
}
