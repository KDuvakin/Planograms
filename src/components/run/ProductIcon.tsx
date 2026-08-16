/** Generic product placeholder — no product photos exist in the imported data, so every item gets the same silhouette, tinted by the current step's state color. */
export function ProductIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 48 64" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path
        d="M18 4h12v8l4 4v40a4 4 0 0 1-4 4H18a4 4 0 0 1-4-4V16l4-4V4Z"
        fill="currentColor"
        fillOpacity="0.18"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path d="M14 26h20" stroke="currentColor" strokeWidth="2" />
      <path d="M18 4h12" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}
