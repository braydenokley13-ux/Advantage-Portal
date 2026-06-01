import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { EmptyState } from "./states";

describe("EmptyState", () => {
  it("renders the title and description", () => {
    render(
      <EmptyState title="Nothing here" description="No tasks assigned yet." />
    );
    expect(screen.getByText("Nothing here")).toBeInTheDocument();
    expect(screen.getByText("No tasks assigned yet.")).toBeInTheDocument();
  });

  it("renders without a description", () => {
    render(<EmptyState title="Empty" />);
    expect(screen.getByText("Empty")).toBeInTheDocument();
  });
});
