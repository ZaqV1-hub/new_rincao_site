function normalizeConfiguredOrigin(value: string | undefined) {
  const trimmed = value?.trim();

  if (!trimmed) {
    return null;
  }

  const unquoted = trimmed.replace(/^["']|["']$/g, "").trim();

  if (!unquoted) {
    return null;
  }

  try {
    return new URL(unquoted).origin;
  } catch {
    return null;
  }
}

export function getPublicRequestOrigin(request: Request) {
  return (
    normalizeConfiguredOrigin(process.env.NEXT_PUBLIC_SITE_URL) ??
    new URL(request.url).origin
  );
}
