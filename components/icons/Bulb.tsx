// The "Test yourself" icon: a light bulb with a question mark.
export function Bulb({ size = 18, rays = false }: { size?: number; rays?: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true" className="inline-block shrink-0">
      {rays && (
        <g stroke="#e8b928" strokeWidth="2.4" strokeLinecap="round">
          <path d="M3 9l3 1.4M2 15h3.4M3 21l3-1.4M29 9l-3 1.4M30 15h-3.4M29 21l-3-1.4" />
        </g>
      )}
      <path d="M16 3a9.5 9.5 0 0 0-5.6 17.2V23h11.2v-2.8A9.5 9.5 0 0 0 16 3z" fill="#f3c94b" stroke="#2a221b" strokeWidth="1.6" />
      <path d="M16 3a9.5 9.5 0 0 1 5.6 17.2V23H16z" fill="#e9b52f" />
      <rect x="10.4" y="23" width="11.2" height="3.2" rx="1" fill="#2f5d62" stroke="#2a221b" strokeWidth="1.4" />
      <rect x="12.4" y="26.2" width="7.2" height="3" rx="1.4" fill="#1f4448" stroke="#2a221b" strokeWidth="1.4" />
      <path d="M13.4 10.6a2.7 2.7 0 1 1 3.9 2.5c-.9.4-1.3 1-1.3 1.9v.6" fill="none" stroke="#2f5d62" strokeWidth="2.2" strokeLinecap="round" />
      <circle cx="16" cy="18.6" r="1.3" fill="#2f5d62" />
    </svg>
  );
}
