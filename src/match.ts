import { Fn } from "./fn";
import { Future } from "./future";

const MatchFailed = Symbol('MatchFailed');

export class Matcher<V  = never> {
  static new(terminationHandler: (evaluator: (data: any) => any) => any) {
    return new Matcher(terminationHandler);
  }

  private constructor(private terminationHandler: (evaluator: (data: any) => any) => any) {}

  private checks: Array<(data: any) => any> = [];

  private evaluate(data: any) {
    for (const check of this.checks) {
      const result = check(data);

      if (result !== MatchFailed) {
        return result;
      }
    }

    return undefined;
  }

  private terminate() {
    return this.terminationHandler(this.evaluate.bind(this));
  }

  public end() {
    return this.otherwise(undefined);
  }

  instanceof<T, R>(type: new (...args: any[]) => T, matcher: (x: T) => R): Matcher<V | R> {
    this.checks.push((data: any) => {
      if (data instanceof type) {
        return matcher(data);
      }

      return MatchFailed;
    });

    return this;
  }

  is<T, R>(value: T, matcher: (x: T) => R): Matcher<V | R> {
    this.checks.push((data: any) => {
      if (data === value) {
        return matcher(data);
      }

      return MatchFailed;
    });

    return this;
  }

  not<T, R>(value: T, matcher: (x: T) => R): Matcher<V | R> {
    this.checks.push((data: any) => {
      if (data !== value) {
        return matcher(data);
      }

      return MatchFailed;
    });

    return this;
  }

  gt<T, R>(value: T, matcher: (x: T) => R): Matcher<V | R> {
    this.checks.push((data: any) => {
      if (data > value) {
        return matcher(data);
      }

      return MatchFailed;
    });

    return this;
  }

  gte<T, R>(value: T, matcher: (x: T) => R): Matcher<V | R> {
    this.checks.push((data: any) => {
      if (data >= value) {
        return matcher(data);
      }

      return MatchFailed;
    });

    return this;
  }

  lt<T, R>(value: T, matcher: (x: T) => R): Matcher<V | R> {
    this.checks.push((data: any) => {
      if (data < value) {
        return matcher(data);
      }

      return MatchFailed;
    });

    return this;
  }

  lte<T, R>(value: T, matcher: (x: T) => R): Matcher<V | R> {
    this.checks.push((data: any) => {
      if (data <= value) {
        return matcher(data);
      }

      return MatchFailed;
    });

    return this;
  }

  otherwise<R>(constant: R): V | R {
    this.checks.push((data: any) => {
      return constant;
    });

    return this.terminate();
  }

  else<R>(generator: () => R): V | R {
    this.checks.push((data: any) => {
      return generator();
    });

    return this.terminate();
  }
}

export function match<T>(data: T) {
  return Matcher.new(f => f(data));
}