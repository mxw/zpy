import * as React from "react"
import * as CardEngine from "trivial-engine.ts"

interface Mutable<T> {
  val: T;
  reset: (val: T) => void;
};

function defaultMutable<T>(val: T): Mutable<T> {
  return {
    val,
    reset: (x: T) => {}
  };
}

export const Session = React.createContext<string | null>(null);

export const SendIntent = React.createContext<null | ((int: CardEngine.Intent) => void)>(null);
