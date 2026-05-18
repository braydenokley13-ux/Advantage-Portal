import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// Unmount React trees rendered via Testing Library after each test so the
// jsdom document does not leak elements between cases.
afterEach(() => {
  cleanup();
});
