import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import AccessScreen from "./AccessScreen";

function type(text: string) {
  fireEvent.change(screen.getByLabelText("Enlace o código de acceso"), {
    target: { value: text },
  });
}

const enter = () => screen.getByRole("button", { name: "Entrar" });

afterEach(() => {
  cleanup();
});

describe("AccessScreen (03-C2)", () => {
  it("says to open the app from the private link", () => {
    render(<AccessScreen onToken={vi.fn()} />);

    expect(screen.getByRole("heading", { name: "Acceso privado" })).toBeDefined();
    expect(screen.getByText(/enlace privado/)).toBeDefined();
  });

  it("passes the token read from a pasted link", () => {
    const onToken = vi.fn();
    render(<AccessScreen onToken={onToken} />);

    type("  https://escandaya.fly.dev/?token=abc  ");
    fireEvent.click(enter());

    expect(onToken).toHaveBeenCalledWith("abc");
  });

  it("submits with the Enter key", () => {
    const onToken = vi.fn();
    render(<AccessScreen onToken={onToken} />);

    type("abc");
    fireEvent.submit(screen.getByLabelText("Enlace o código de acceso"));

    expect(onToken).toHaveBeenCalledWith("abc");
  });

  it("shows a message and does not pass anything for unreadable input", () => {
    const onToken = vi.fn();
    render(<AccessScreen onToken={onToken} />);

    type("https://escandaya.fly.dev/");
    fireEvent.click(enter());

    expect(screen.getByRole("alert").textContent).toBe("No es un enlace ni un código válido");
    expect(onToken).not.toHaveBeenCalled();
  });

  it("clears the message when the chef edits the field", () => {
    render(<AccessScreen onToken={vi.fn()} />);
    type("");
    fireEvent.click(enter());
    expect(screen.getByRole("alert")).toBeDefined();

    type("a");

    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("shows the rejected message from the gate", () => {
    render(<AccessScreen onToken={vi.fn()} rejected />);

    expect(screen.getByRole("alert").textContent).toBe("Ese enlace no es válido");
  });

  it("disables the button while the pasted token is being checked", () => {
    render(<AccessScreen onToken={vi.fn()} checking />);

    const button = screen.getByRole("button", { name: "Comprobando…" });
    expect((button as HTMLButtonElement).disabled).toBe(true);
  });
});
