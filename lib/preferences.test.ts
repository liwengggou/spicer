import { describe, it, expect } from "vitest"
import { DateTime } from "luxon"
import { isPreferencesFrozen, getCurrentWeekStart, getNextWeekStart } from "../lib/preferences"

describe("Preferences Timezone Logic", () => {
  it("should correctly identify mid-week freeze period", () => {
    // Monday (should not be frozen)
    const monday = DateTime.fromISO("2024-01-01T12:00:00", { zone: "Asia/Tokyo" })
    expect(isPreferencesFrozen(monday)).toBe(false)
    
    // Wednesday (should be frozen)
    const wednesday = DateTime.fromISO("2024-01-03T12:00:00", { zone: "Asia/Tokyo" })
    expect(isPreferencesFrozen(wednesday)).toBe(true)
    
    // Friday (should be frozen)
    const friday = DateTime.fromISO("2024-01-05T12:00:00", { zone: "Asia/Tokyo" })
    expect(isPreferencesFrozen(friday)).toBe(true)
  })

  it("should return valid ISO strings for week starts", () => {
    const currentWeek = getCurrentWeekStart()
    const nextWeek = getNextWeekStart()
    
    expect(currentWeek).toBeTruthy()
    expect(nextWeek).toBeTruthy()
    expect(typeof currentWeek).toBe("string")
    expect(typeof nextWeek).toBe("string")
    
    // Next week should be after current week
    expect(new Date(nextWeek).getTime()).toBeGreaterThan(new Date(currentWeek).getTime())
  })

  it("should handle Tokyo timezone correctly", () => {
    const now = DateTime.now().setZone("Asia/Tokyo")
    const weekStart = getCurrentWeekStart()
    
    // Week start should be Monday 00:00 Tokyo time
    const weekStartDate = DateTime.fromISO(weekStart, { zone: "Asia/Tokyo" })
    expect(weekStartDate.weekday).toBe(1) // Monday
    expect(weekStartDate.hour).toBe(0)
    expect(weekStartDate.minute).toBe(0)
  })
})