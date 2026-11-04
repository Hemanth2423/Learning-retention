// Ingrain mark: a sprout taking root, the idea of knowledge that grows and stays.
export function LogoMark({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      <rect width="32" height="32" rx="8" fill="#E8A33D" />
      <path d="M16 26V14" stroke="#1E2A3A" strokeWidth="2.4" strokeLinecap="round" />
      <path d="M16 18C10.5 18 8 14.5 8 10c5 0 8 3 8 8Z" fill="#1E2A3A" />
      <path d="M16 15c0-5 3-8 8.5-8.5C24.5 11.5 21.5 15 16 15Z" fill="#1E2A3A" />
      <path d="M11 26h10" stroke="#1E2A3A" strokeWidth="2.4" strokeLinecap="round" />
    </svg>
  );
}

export function Logo({ size = 28 }: { size?: number }) {
  return (
    <span className="inline-flex items-center gap-2 font-serif text-xl font-semibold">
      <LogoMark size={size} />
      Ingrain
    </span>
  );
}
