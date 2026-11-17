/**
 * A title that will wrap onto three lines or more at full size: it gets the smaller
 * tape, so it still reads as a strip of tape and not as a slab.
 */
export function isLongTitle(text: string): boolean {
  return text.trim().length > 24;
}
