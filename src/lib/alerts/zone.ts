/**
 * Quiet hours mean the reader's night: the zone to save when the device's
 * differs from the stored one (the stored default is UTC until someone opts
 * in to push), or null when nothing needs saving.
 */
export function zoneToSave(saved: string, device: string | undefined): string | null {
  if (!device || device === saved) return null
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: device })
    return device
  } catch {
    return null
  }
}

/** "Asia/Kolkata" → "Kolkata time" for labels; the raw zone stays in the title attribute. */
export function zoneLabel(zone: string): string {
  if (zone === "UTC") return "UTC"
  const city = zone.split("/").at(-1)?.replaceAll("_", " ")
  return city ? `${city} time` : zone
}
