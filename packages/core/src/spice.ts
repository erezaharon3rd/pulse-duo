// מדד שובבות וגבולות (אפיון 1.8).

export const SPICE_NAMES = ['וניל', 'קינמון', "צ'ילי", 'חריף', 'אש'] as const;

/** הצימוד משתמש בנמוך מבין השניים. הערך לא נחשף לאף צד. */
export function effectiveSpice(a: number, b: number): number {
  return Math.min(a, b);
}

/** תגים שאסורים תמיד, בכל רמה (חנק / הגבלת נשימה). */
export const FORBIDDEN_TAGS = ['breath_restriction', 'choking'];

export function passesLimits(tags: string[], hardLimitsA: string[], hardLimitsB: string[]): boolean {
  const blocked = new Set([...FORBIDDEN_TAGS, ...hardLimitsA, ...hardLimitsB]);
  return !tags.some((t) => blocked.has(t));
}

/** הנוסח של הטיזר: אף פעם לא מציג את הרמה (כדי שאי אפשר יהיה להסיק מה בחר הצד השני). */
export const TEASER_SPICE_TEXT = 'המפגש נבנה במקום ששניכם נוחים בו';
