/**
 * Card identification (v1.1). Stub only while NEXT_PUBLIC_FEATURE_CARD_ID=false.
 * Real embedding / OCR / index matching lands in Phases 17–18.
 */

export const CARD_ID_PACKAGE_VERSION = "0.1.0-stub";

export function isCardIdEnabled(flag: string | undefined | null): boolean {
  return flag === "true";
}
