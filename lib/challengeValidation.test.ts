import { describe, it, expect } from "../test/harness"
import { findLongDistanceViolations, isLongDistanceSafe } from "./challengeValidation"

describe("Long-distance validation", () => {
  it("flags physical actions when long-distance is enabled", () => {
    const challenge = { title: "Cozy movie night", description: "Cuddle on the couch and hold hands." }
    const violations = findLongDistanceViolations(challenge, true)
    expect(violations.length).toBeGreaterThan(0)
    expect(violations).toContain("cuddle")
    expect(violations).toContain("hold hands")
  })

  it("allows remote-friendly prompts when long-distance is enabled", () => {
    const challenge = { title: "Virtual trivia", description: "Jump on video and play trivia together." }
    const { ok, violations } = isLongDistanceSafe(challenge, true)
    expect(ok).toBe(true)
    expect(Array.isArray(violations)).toBe(true)
  })

  it("skips checks when long-distance mode is off", () => {
    const challenge = { title: "Date night", description: "Go for a walk and grab dinner." }
    const { ok, violations } = isLongDistanceSafe(challenge, false)
    expect(ok).toBe(true)
    expect(violations.length).toBe(0)
  })
})
