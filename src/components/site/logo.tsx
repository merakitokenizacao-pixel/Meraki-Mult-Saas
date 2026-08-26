// Logotipo Meraki — o mesmo desenho da sidebar do CRM: serifada, com a
// última letra dourada.
export function Logo({ className = "" }: { className?: string }) {
  return (
    <span
      className={`font-[family-name:var(--font-cormorant)] text-[26px] font-light leading-none tracking-[0.01em] text-s-ink ${className}`}
    >
      Merak<span className="text-s-gold">i</span>
    </span>
  );
}
