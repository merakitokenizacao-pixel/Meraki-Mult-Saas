// Logotipo VoraX — o mesmo desenho da sidebar do CRM: serifada, com o X dourado.
export function Logo({ className = "" }: { className?: string }) {
  return (
    <span
      className={`font-[family-name:var(--font-cormorant)] text-[26px] font-light leading-none tracking-[0.01em] text-s-ink ${className}`}
    >
      Vora<span className="text-s-gold">X</span>
    </span>
  );
}
