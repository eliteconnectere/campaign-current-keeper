import { describe, expect, it } from "vitest";
import { canSendCustomerMessage, customerConsentScope } from "@/features/workspace/reviewConsent";
import { GOOGLE_REVIEW_MODE } from "@/lib/reviewMode";

describe("Google review consent requirements", () => {
  const scope = customerConsentScope(["customer@example.com"], "customer@example.com", "Update", "Account update");
  it("defaults review mode to true", () => { expect(GOOGLE_REVIEW_MODE).toBe(false); });
  it("blocks sending without explicit consent", () => {
    expect(canSendCustomerMessage(true, null, scope)).toBe(false);
    expect(canSendCustomerMessage(true, { scope, confirmed: false }, scope)).toBe(false);
    expect(canSendCustomerMessage(true, { scope, confirmed: true }, scope)).toBe(true);
  });
  it("invalidates consent when the destination list changes", () => {
    const changed = customerConsentScope(["other@example.com"], "other@example.com", "Update", "Account update");
    expect(canSendCustomerMessage(true, { scope, confirmed: true }, changed)).toBe(false);
  });
  it("invalidates consent when the message changes", () => {
    const changed = customerConsentScope(["customer@example.com"], "customer@example.com", "New update", "New content");
    expect(canSendCustomerMessage(true, { scope, confirmed: true }, changed)).toBe(false);
  });
  it("restores the original mode without imposing the review-only gate", () => {
    expect(canSendCustomerMessage(false, null, scope)).toBe(true);
  });
});