import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { ApprovalGate, canShipFeature } from "@/components/workspace/feature-detail/approval-gate";

function ApproveButton() {
  return <button>Approve &amp; Ship</button>;
}

describe("ApprovalGate — UI mirror of the server-side approve/reject role guard", () => {
  it("renders the Approve control for a reviewer when the feature is pending approval", () => {
    render(
      <ApprovalGate role="reviewer" featureStatus="PENDING_APPROVAL">
        <ApproveButton />
      </ApprovalGate>,
    );
    expect(screen.getByRole("button", { name: /approve/i })).toBeInTheDocument();
  });

  it("renders the Approve control for owner and admin too", () => {
    for (const role of ["owner", "admin"]) {
      const { unmount } = render(
        <ApprovalGate role={role} featureStatus="PENDING_APPROVAL">
          <ApproveButton />
        </ApprovalGate>,
      );
      expect(screen.getByRole("button", { name: /approve/i })).toBeInTheDocument();
      unmount();
    }
  });

  it("does not render the Approve control for a developer (not an approver role)", () => {
    render(
      <ApprovalGate role="developer" featureStatus="PENDING_APPROVAL">
        <ApproveButton />
      </ApprovalGate>,
    );
    expect(screen.queryByRole("button", { name: /approve/i })).not.toBeInTheDocument();
  });

  it("does not render the Approve control for a viewer", () => {
    render(
      <ApprovalGate role="viewer" featureStatus="PENDING_APPROVAL">
        <ApproveButton />
      </ApprovalGate>,
    );
    expect(screen.queryByRole("button", { name: /approve/i })).not.toBeInTheDocument();
  });

  it("does not render for a user with no membership role at all", () => {
    render(
      <ApprovalGate role={null} featureStatus="PENDING_APPROVAL">
        <ApproveButton />
      </ApprovalGate>,
    );
    expect(screen.queryByRole("button", { name: /approve/i })).not.toBeInTheDocument();
  });

  it("does not render for a reviewer when the feature isn't PENDING_APPROVAL yet", () => {
    render(
      <ApprovalGate role="reviewer" featureStatus="IN_DEVELOPMENT">
        <ApproveButton />
      </ApprovalGate>,
    );
    expect(screen.queryByRole("button", { name: /approve/i })).not.toBeInTheDocument();
  });

  it("does not render once the feature has already been SHIPPED (no re-approving)", () => {
    render(
      <ApprovalGate role="owner" featureStatus="SHIPPED">
        <ApproveButton />
      </ApprovalGate>,
    );
    expect(screen.queryByRole("button", { name: /approve/i })).not.toBeInTheDocument();
  });
});

describe("canShipFeature", () => {
  it("matches the server's APPROVER_ROLES set exactly", () => {
    expect(canShipFeature("owner", "PENDING_APPROVAL")).toBe(true);
    expect(canShipFeature("admin", "PENDING_APPROVAL")).toBe(true);
    expect(canShipFeature("reviewer", "PENDING_APPROVAL")).toBe(true);
    expect(canShipFeature("developer", "PENDING_APPROVAL")).toBe(false);
    expect(canShipFeature("viewer", "PENDING_APPROVAL")).toBe(false);
    expect(canShipFeature(undefined, "PENDING_APPROVAL")).toBe(false);
  });
});
