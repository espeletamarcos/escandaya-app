import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import EstimatedMark from "./EstimatedMark";

afterEach(cleanup);

describe("EstimatedMark (09-C7)", () => {
  it("shows the value after a ≈", () => {
    render(<EstimatedMark>3 ud</EstimatedMark>);

    const mark = document.querySelector(".estimated");
    expect(mark?.querySelector("[aria-hidden='true']")?.textContent).toBe("≈ ");
    expect(mark?.textContent).toContain("≈ 3 ud");
  });

  it("is read as estimado by screen readers, not as ≈", () => {
    render(
      <button type="button">
        <EstimatedMark>3 ud</EstimatedMark>
      </button>,
    );

    expect(screen.getByRole("button", { name: "3 ud (estimado)" })).toBeDefined();
  });

  it("hides the word estimado from sight only", () => {
    render(<EstimatedMark>40 raciones</EstimatedMark>);

    expect(screen.getByText("(estimado)").className).toBe("visually-hidden");
  });
});
