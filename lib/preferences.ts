import { DateTime } from "luxon"

export function isPreferencesFrozen(testDate?: DateTime): boolean {
  const now = testDate || DateTime.now().setZone("Asia/Tokyo")
  const dayOfWeek = now.weekday // 1 = Monday, 7 = Sunday
  
  // Freeze starts on Wednesday (day 3) at 00:00 Tokyo time
  // Changes apply starting next week
  return dayOfWeek >= 3
}

export function getNextWeekStart(): string {
  const now = DateTime.now().setZone("Asia/Tokyo")
  const nextWeek = now.plus({ weeks: 1 }).startOf("week")
  return nextWeek.toISO() || ""
}

export function getCurrentWeekStart(): string {
  const now = DateTime.now().setZone("Asia/Tokyo")
  return now.startOf("week").toISO() || ""
}