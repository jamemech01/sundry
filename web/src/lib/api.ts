export async function apiFetch<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const headers = new Headers(options.headers);

  if (options.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(`/api/${path.replace(/^\/+/, "")}`, {
    ...options,
    headers,
    cache: "no-store",
  });

  const data: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    const message =
      typeof data === "object" &&
        data !== null &&
        "message" in data
        ? data.message
        : `Request failed (${response.status})`;

    throw new Error(
      Array.isArray(message) ? message.join(", ") : String(message),
    );
  }

  return data as T;
}
