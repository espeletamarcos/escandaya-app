import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FakeRecorder } from "../recorder/FakeRecorder";
import { RecorderError } from "../recorder/Recorder";
import RecordScreen from "./RecordScreen";

describe("RecordScreen", () => {
  beforeEach(() => {
    // jsdom does not implement object URLs
    URL.createObjectURL = vi.fn(() => "blob:fake-url");
    URL.revokeObjectURL = vi.fn();
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("shows a record button and no player at first", () => {
    render(<RecordScreen recorder={new FakeRecorder()} />);
    expect(screen.getByRole("button", { name: "Record" })).toBeDefined();
    expect(document.querySelector("audio")).toBeNull();
  });

  it("shows the recording state after pressing the button (01-C1)", async () => {
    render(<RecordScreen recorder={new FakeRecorder()} />);
    fireEvent.click(screen.getByRole("button", { name: "Record" }));
    const stop = await screen.findByRole("button", { name: "Stop" });
    expect(stop.getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByText("Recording…")).toBeDefined();
  });

  it("shows a player with the recording after stopping (01-C2)", async () => {
    render(<RecordScreen recorder={new FakeRecorder()} />);
    fireEvent.click(screen.getByRole("button", { name: "Record" }));
    fireEvent.click(await screen.findByRole("button", { name: "Stop" }));
    await screen.findByRole("button", { name: "Record" });
    const audio = document.querySelector("audio");
    expect(audio?.getAttribute("src")).toBe("blob:fake-url");
    expect(audio?.hasAttribute("controls")).toBe(true);
  });

  it("shows the error message when the microphone is not available (01-C4)", async () => {
    const recorder = new FakeRecorder(new RecorderError("no-microphone", "None"));
    render(<RecordScreen recorder={recorder} />);
    fireEvent.click(screen.getByRole("button", { name: "Record" }));
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toMatch(/microphone/i);
    expect(screen.getByRole("button", { name: "Record" })).toBeDefined();
  });
});
