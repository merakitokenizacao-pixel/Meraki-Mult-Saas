// Mockup da agenda — reproduz a grade real do painel, com a capacidade que
// vem da escala das profissionais. Dados fictícios, mas o comportamento é o
// que o sistema faz de verdade: segunda de manhã fechada, almoço fora,
// contador de vagas e o horário que lotou.
const DIAS = ["Seg", "Ter", "Qua", "Qui", "Sex"];
const HORAS = [10, 11, 12, 13, 14, 15];

type Cel =
  | { t: "fechado"; rotulo?: string }
  | { t: "livre"; vagas?: string; cheio?: boolean }
  | { t: "evento"; nome: string; servico: string; cor: string; vagas?: string };

// [hora][dia]
const GRADE: Cel[][] = [
  // 10h — segunda fechada (pós-graduação da dona)
  [
    { t: "fechado", rotulo: "Pós-grad" },
    { t: "livre" },
    { t: "evento", nome: "Marina", servico: "Limpeza", cor: "#9b7d5a" },
    { t: "livre" },
    { t: "livre" },
  ],
  // 11h
  [
    { t: "fechado" },
    { t: "evento", nome: "Ana P.", servico: "Drenagem", cor: "#3a6b4f" },
    { t: "livre" },
    { t: "livre" },
    { t: "evento", nome: "Júlia", servico: "Peeling", cor: "#2a5278" },
  ],
  // 12h — almoço em todos
  [
    { t: "fechado", rotulo: "Almoço" },
    { t: "fechado" },
    { t: "fechado" },
    { t: "fechado" },
    { t: "fechado" },
  ],
  // 13h — 2 profissionais
  [
    { t: "livre", vagas: "2/2" },
    { t: "livre", vagas: "2/2" },
    { t: "evento", nome: "Carla", servico: "Botox", cor: "#5c4fa0", vagas: "1/2" },
    { t: "livre", vagas: "2/2" },
    { t: "livre", vagas: "2/2" },
  ],
  // 14h — 3 profissionais
  [
    { t: "livre", vagas: "3/3" },
    { t: "evento", nome: "Bia", servico: "Laser", cor: "#b5600a", vagas: "2/3" },
    { t: "livre", vagas: "3/3" },
    { t: "livre", vagas: "3/3" },
    { t: "livre", vagas: "3/3" },
  ],
  // 15h — o horário que lotou
  [
    { t: "livre", vagas: "3/3" },
    { t: "livre", vagas: "1/3" },
    { t: "livre", vagas: "3/3" },
    { t: "livre", cheio: true },
    { t: "livre", vagas: "2/3" },
  ],
];

export function MockAgenda() {
  return (
    <div className="s-mock w-full max-w-[460px]">
      <div className="s-mock-topo">
        <span className="s-mock-titulo">Agenda</span>
        <span className="s-mock-sub">Semana de 20 jul</span>
      </div>

      <div className="s-agenda">
        <div className="s-agenda-cab" />
        {DIAS.map((d) => (
          <div key={d} className="s-agenda-cab">
            {d}
          </div>
        ))}

        {HORAS.map((h, li) => (
          <div key={h} style={{ display: "contents" }}>
            <div className="s-agenda-hora">{h}h</div>
            {GRADE[li].map((c, ci) => {
              if (c.t === "fechado") {
                return (
                  <div key={ci} className="s-agenda-cel fechado">
                    {c.rotulo && <span className="s-agenda-rotulo">{c.rotulo}</span>}
                  </div>
                );
              }
              if (c.t === "evento") {
                return (
                  <div key={ci} className="s-agenda-cel">
                    {c.vagas && <span className="s-agenda-vagas">{c.vagas}</span>}
                    <div
                      className="s-agenda-ev"
                      style={{ background: `${c.cor}14`, borderLeftColor: c.cor }}
                    >
                      <b>{c.nome}</b>
                      <span className="text-s-muted">{c.servico}</span>
                    </div>
                  </div>
                );
              }
              return (
                <div key={ci} className={`s-agenda-cel${c.cheio ? " cheio" : ""}`}>
                  {c.cheio ? (
                    <span className="s-agenda-vagas">cheio</span>
                  ) : (
                    c.vagas && <span className="s-agenda-vagas">{c.vagas}</span>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
