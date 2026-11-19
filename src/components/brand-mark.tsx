export function BrandMark({ className = "size-9" }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden className={className}>
      <rect width="32" height="32" rx="8" className="fill-primary" />
      <path
        d="M16 6.5c.5 4 3.1 6.5 6.2 7.6-3.1 1.2-5.3 4-6.2 7.6-.9-3.6-3.1-6.4-6.2-7.6 3.1-1.1 5.7-3.6 6.2-7.6Z"
        className="fill-primary-foreground"
      />
    </svg>
  );
}
