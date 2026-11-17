import type { ReactNode } from "react";
import { isLongTitle } from "./titleLength";
import "./ScreenTitle.css";

/**
 * The screen's `h1`, on a strip of light green masking tape stuck on slightly
 * crooked, the way the kitchen labels a container (09-C3). Upper case comes from
 * the stylesheet; a long name wraps and the tape grows with it.
 */
function ScreenTitle({ children }: { children: ReactNode }) {
  const long = typeof children === "string" && isLongTitle(children);
  return (
    <h1 className={long ? "screen-title long" : "screen-title"}>
      <span className="screen-title-tape">{children}</span>
    </h1>
  );
}

export default ScreenTitle;
