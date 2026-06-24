export function BrandLogo({ className = "h-10 w-10" }: { className?: string }) {
  return (
    <img
      src="/rk-global-logo.svg"
      alt="RK Global"
      className={className}
      loading="eager"
      decoding="async"
    />
  );
}
