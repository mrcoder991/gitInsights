// React 19 stopped exposing `JSX` as a global. We use `JSX.Element` in our page
// signatures, so re-export it from React's type tree.
import type { JSX as ReactJSX } from 'react/jsx-runtime';

declare global {
  namespace JSX {
    type Element = ReactJSX.Element;
    type ElementType = ReactJSX.ElementType;
    type ElementClass = ReactJSX.ElementClass;
    type IntrinsicElements = ReactJSX.IntrinsicElements;
  }
}

export {};
