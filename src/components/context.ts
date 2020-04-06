import * as React from "react"

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
