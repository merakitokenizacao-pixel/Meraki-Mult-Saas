// Placeholder temporário das telas ainda não migradas (será substituído nas próximas etapas).
export function PagePlaceholder({
  title,
  etapa,
}: {
  title: string;
  etapa: string;
}) {
  return (
    <div
      style={{
        border: "1px solid var(--mk-linha)",
        background: "var(--mk-superficie)",
        borderRadius: "var(--mk-raio)",
        padding: "3rem",
        textAlign: "center",
        color: "var(--mk-tinta-fraca)",
      }}
    >
      <h2
        style={{
          fontFamily: "var(--font-cormorant), serif",
          fontSize: "28px",
          fontWeight: 300,
          color: "var(--mk-tinta)",
          marginBottom: "8px",
        }}
      >
        {title}
      </h2>
      <p style={{ fontSize: "13px" }}>Tela a migrar — {etapa}.</p>
    </div>
  );
}
