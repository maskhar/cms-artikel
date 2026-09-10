export function isFutureExpiration(value: string | null | undefined, now = new Date()) {
  return value == null || new Date(value).getTime() > now.getTime();
}
