export type ChallengePayload = { title?: string; description?: string }

const PHYSICAL_TERMS = [
  "kiss",
  "cuddle",
  "cuddling",
  "hug",
  "massage",
  "touch",
  "hold hands",
  "hand holding",
  "spoon",
  "spooning",
  "in-person",
  "physically",
  "physical touch",
  "shoulder rub",
  "back rub",
  "body heat",
  "sit together",
  "walk together",
  "go for a walk",
  "go for a run",
  "go for a drive",
  "movie night together",
  "cook together",
  "dinner date",
  "picnic",
  "cafe date",
  "restaurant",
]

function normalize(text?: string) {
  return (text || "").toLowerCase()
}

export function findLongDistanceViolations(challenge: ChallengePayload, longDistanceEnabled: boolean): string[] {
  if (!longDistanceEnabled) return []
  const haystack = `${normalize(challenge.title)} ${normalize(challenge.description)}`
  const matches = PHYSICAL_TERMS.filter((term) => haystack.includes(term))
  return Array.from(new Set(matches))
}

export function isLongDistanceSafe(challenge: ChallengePayload, longDistanceEnabled: boolean) {
  const violations = findLongDistanceViolations(challenge, longDistanceEnabled)
  return {
    ok: violations.length === 0,
    violations,
  }
}
