export class Fn {
  static Void = () => undefined;
  static Identity = <T>(x: T) => x;
  static Of = <T>(x: T) => () => x;
  static Evaluate = <T>(fn: () => T) => fn();
}