import { DateTime, DurationLikeObject } from "luxon"

export type TimesPerDay = 1 | 2 | 3

const TOKYO = "Asia/Tokyo"

const SLOT_MAP: Record<TimesPerDay, number[]> = {
  1: [8],
  2: [8, 20],
  3: [8, 16, 20],
}

export function getSlotHours(timesPerDay: number): number[] {
  const normalized = ([1, 2, 3] as TimesPerDay[]).includes(timesPerDay as TimesPerDay)
    ? (timesPerDay as TimesPerDay)
    : 2
  return SLOT_MAP[normalized]
}

function getExpiryDuration(timesPerDay: number, slotHour: number): DurationLikeObject {
  if (timesPerDay === 1) {
    return { hours: 24 }
  }
  if (timesPerDay === 2) {
    return { hours: 12 }
  }
  if (slotHour === 8) return { hours: 8 }
  if (slotHour === 16) return { hours: 4 }
  return { hours: 12 }
}

export type SlotComputationResult = {
  scheduledAtTokyo: DateTime
  expiresAtTokyo: DateTime
  slotHour: number
}

export function computeNextSlot(timesPerDay: number, reference?: DateTime): SlotComputationResult {
  const now = (reference || DateTime.now().setZone(TOKYO)).setZone(TOKYO)
  const hours = getSlotHours(timesPerDay)
  const today = now.startOf("day")
  let scheduledAtTokyo = today.plus({ hours: hours[0] })
  let slotHour = hours[0]

  for (const hour of hours) {
    const candidate = today.plus({ hours: hour })
    if (now <= candidate) {
      scheduledAtTokyo = candidate
      slotHour = hour
      break
    }
  }

  if (now > scheduledAtTokyo) {
    slotHour = hours[0]
    scheduledAtTokyo = today.plus({ days: 1, hours: slotHour })
  }

  const expiresAtTokyo = scheduledAtTokyo.plus(getExpiryDuration(timesPerDay, slotHour))
  return { scheduledAtTokyo, expiresAtTokyo, slotHour }
}

export function computeExpiryForSlot(timesPerDay: number, scheduledAtTokyo: DateTime, slotHour: number) {
  return scheduledAtTokyo.plus(getExpiryDuration(timesPerDay, slotHour))
}

export function isSlotTrigger(now: DateTime, slotHour: number) {
  return now.hour === slotHour && now.minute === 0
}
