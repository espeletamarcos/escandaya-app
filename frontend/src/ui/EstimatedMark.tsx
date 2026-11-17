import type { ReactNode } from "react";
import "./EstimatedMark.css";

/**
 * An estimated value, as the chef reads it: in marker blue after a "≈". Screen
 * readers skip the "≈" and hear "(estimado)" after the value instead (09-C7).
 */
function EstimatedMark({ children }: { children: ReactNode }) {
  return (
    <span className="estimated">
      <span aria-hidden="true">≈ </span>
      {children}{" "}
      <span className="visually-hidden">(estimado)</span>
    </span>
  );
}

export default EstimatedMark;
