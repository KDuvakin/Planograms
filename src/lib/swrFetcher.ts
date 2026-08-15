/** Shared SWR fetcher: throws on a non-OK response instead of resolving with
 * the error body, so `data` stays `undefined` (safe with `?.`) rather than
 * an `{ error }` object that crashes `.map()` calls. */
export async function fetcher<T = unknown>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Request to ${url} failed with ${res.status}`);
  }
  return res.json();
}
