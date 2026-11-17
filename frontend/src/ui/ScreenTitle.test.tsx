import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import ScreenTitle from "./ScreenTitle";

afterEach(cleanup);

describe("ScreenTitle (09-C3)", () => {
  it("is the screen's level 1 heading, with the text as written", () => {
    render(<ScreenTitle>Nueva ficha</ScreenTitle>);

    // Upper case comes from the stylesheet, so screen readers get the words as written.
    expect(screen.getByRole("heading", { level: 1, name: "Nueva ficha" })).toBeDefined();
  });

  it("puts the text on the tape", () => {
    render(<ScreenTitle>Tartar de atún</ScreenTitle>);

    const heading = screen.getByRole("heading", { level: 1 });
    expect(heading.className).toBe("screen-title");
    expect(heading.querySelector(".screen-title-tape")?.textContent).toBe("Tartar de atún");
  });

  it("keeps a long name whole, on a smaller tape so it does not become a slab", () => {
    const name = "Pichón en dos cocciones con su jugo y remolacha asada a la sal";
    render(<ScreenTitle>{name}</ScreenTitle>);

    const heading = screen.getByRole("heading", { level: 1, name });
    expect(heading.classList.contains("long")).toBe(true);
  });

  it("keeps the full-size tape for a usual name", () => {
    render(<ScreenTitle>Preparaciones</ScreenTitle>);

    expect(screen.getByRole("heading", { level: 1 }).classList.contains("long")).toBe(false);
  });
});
