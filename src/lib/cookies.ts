/** Plain DOM side effect, kept outside component scope so the react-compiler
 * eslint rule doesn't mistake a `document.cookie` write for state mutation. */
export function setCookie(name: string, value: string, maxAgeSeconds: number) {
  document.cookie = `${name}=${value};path=/;max-age=${maxAgeSeconds};samesite=lax`;
}
