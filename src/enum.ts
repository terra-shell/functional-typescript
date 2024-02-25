import { Maybe } from "./maybe";
import { Option } from "./option"

export type EnumInstance<T> = T extends TranslateTypeToStatic<infer U> ? (TranslateTypeToInstance<U> & InstanceType<T>) : never;

export const Default = Symbol("Default");

interface BaseInstance<T extends { [key: string]: { new(...args: any): any } }> {
  when<K extends keyof T, RT>(object: (...args: ConstructorParameters<T[K]>) => TranslateTypeToWellDefined<T, K>, handler: (instance: InstanceType<T[K]>) => RT): RT extends Promise<infer U> ? Maybe<U> : Option<RT>;
  asyncWhen<K extends keyof T, RT>(object: (...args: ConstructorParameters<T[K]>) => TranslateTypeToWellDefined<T, K>, handler: (instance: InstanceType<T[K]>) => Promise<RT>): Maybe<RT>;
  match<K extends keyof T, H extends ({
    [key in keyof T]?: (instance: InstanceType<T[key]>) => any
  } & Record<typeof Default, () => any> | {
    [key in keyof T]: (instance: InstanceType<T[key]>) => any
  })>(handlers: H): ReturnType<Exclude<H[keyof H], undefined>>;
}

type TranslateTypeToStatic<T extends { [key: string]: { new(...args: any): any } }> = {
  [K in keyof T]: <V extends { new(...args: any): any }>(this: V, ...args: ConstructorParameters<T[K]>) => TranslateTypeToWellDefined<T, K> & InstanceType<V>;
} & X<T>;

interface X<T extends { [key: string]: { new(...args: any): any } }> {
  new(current: keyof T, value: InstanceType<T[keyof T]>): TranslateTypeToInstance<T>;
}

type TranslateTypeToInstance<T extends { [key: string]: { new(...args: any): any } }> = BaseInstance<T> & {
  [K in keyof T as `is${Capitalize<string & K>}`]: (a: TranslateTypeToInstance<T>) => a is TranslateTypeToWellDefined<T, K>;
}

type TranslateTypeToWellDefined<T extends { [key: string]: { new(...args: any): any } }, K extends keyof T> = TranslateTypeToInstance<T> & {
  [key in K]: InstanceType<T[key]>;
}

export function Enum<T extends { [key: string]: { new (...args: any): any }}>(classObject: T) {
  const base = class<K extends keyof T> {
    [Symbol.toStringTag]() { return name }

    constructor(
      public current: K,
      public value: InstanceType<T[K]>,
    ) {}

    match<RT>(handlers: { [key in keyof T]?: (instance: InstanceType<T[key]>) => RT } & (Record<typeof Default, () => RT> | {})): RT {
      const handler = handlers[this.current];

      if (handler) {
        return handler(this.value);
      }

      if (handlers[Default as any] !== undefined) {
        return (handlers[Default as any] as any)();
      }

      throw new Error(`PANIC! No handler for ${String(this.current)}!`);
    }
  };

  const baseAny = base as any;
  
  const keys = Object.keys(classObject) as (keyof T)[];

  const map: any = {};

  for (const key of keys) {
    classObject[key].prototype[Symbol.toStringTag] = () => key;

    const stringKey = String(key);
    const capitalized = stringKey.charAt(0).toUpperCase() + stringKey.slice(1);

    baseAny.prototype[`is${capitalized}`] = function (a: TranslateTypeToInstance<T>): a is TranslateTypeToWellDefined<T, keyof T> {
      return (a as any).current === key;
    }

    Object.defineProperty(baseAny.prototype, stringKey, {
      get() {
        if (this.current !== key) {
          throw new Error(`Tried to access ${String(key)} when current is ${this.current}`);
        }

        return this.value;
      }
    });

    map[key] = baseAny[key] = function (...args: any[]) {
      return new this(key, new classObject[key](...args));
    }
  }

  baseAny.prototype.when = function when<K1 extends T[keyof T], RT>(object: K1, handler: (instance: InstanceType<K1>) => RT): Option < RT > {
    if(map[this.current] as any === object as any) {
      return Option.some(handler(this.value as unknown as InstanceType<K1>));
    }

    return Option.none();
  }

  baseAny.prototype.asyncWhen = function asyncWhen<K1 extends T[keyof T], RT>(object: K1, handler: (instance: InstanceType<K1>) => Promise<RT>): Maybe<RT> {
    if(map[this.current] as any === object as any) {
      return Maybe.new<RT>(m => {
        handler(this.value as unknown as InstanceType<K1>).then(m.fullfill).catch(m.unfullfill);
      });
    }

    return Maybe.Unfullfilled();
  }

  return baseAny as TranslateTypeToStatic<T>;
}