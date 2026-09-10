export const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function isValidSlug(value: string) {
  return slugPattern.test(value);
}
