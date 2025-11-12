import { DateTime } from "luxon"

export const TOKYO_ZONE = "Asia/Tokyo"

export function nowTokyo() {
  return DateTime.now().setZone(TOKYO_ZONE)
}

export function formatTokyo(ts: string | Date | number) {
  return DateTime.fromJSDate(new Date(ts)).setZone(TOKYO_ZONE).toFormat("yyyy-LL-dd HH:mm")
}
