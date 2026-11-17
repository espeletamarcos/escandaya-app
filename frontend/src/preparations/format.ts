// Spanish texts for saved preparations, kept apart so the screens stay small.

export function coversText(covers: number | null): string {
  if (covers === null) return "Raciones: falta";
  return covers === 1 ? "1 ración" : `${covers} raciones`;
}

export function missingText(count: number): string {
  if (count === 0) return "Completa";
  return count === 1 ? "Falta 1 dato" : `Faltan ${count} datos`;
}

/**
 * The confirmation time, such as "14 nov 2026, 13:30", in the phone's own time
 * zone. `timeZone` is only passed by tests, so they do not depend on the machine.
 */
export function formatDate(iso: string, timeZone?: string): string {
  return new Intl.DateTimeFormat("es-ES", { dateStyle: "medium", timeStyle: "short", timeZone }).format(
    new Date(iso),
  );
}

/** The day only, such as "14 nov": the date in red marker on sheets and in the list. */
export function formatDay(iso: string, timeZone?: string): string {
  return new Intl.DateTimeFormat("es-ES", { day: "numeric", month: "short", timeZone }).format(
    new Date(iso),
  );
}
