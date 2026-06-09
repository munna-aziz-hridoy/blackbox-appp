export function displayName(
  name: string | null | undefined,
  email: string | null | undefined,
  id: string,
): string {
  return name?.trim() || email?.trim() || id.slice(0, 8);
}
