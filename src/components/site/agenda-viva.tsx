"use client";

import { useEffect, useState } from "react";

// A seção interativa — e a única coisa desta página que o concorrente não
// consegue imitar.
//
// Ele deixa arrastar cartão de mentira; aqui o visitante escolhe um
// procedimento e consulta a agenda de PRODUÇÃO. Quando ele escolhe
// microagulhamento e metade dos horários some, a promessa da seção acabou de
// se demonstrar sozinha — nenhum texto faz isso.

interface Horario {
  data: string;
  hora: number;
}

/** Usado só quando a API falha. Melhor um exemplo rotulado do que uma seção
 *  quebrada — mas rotulado, senão vira número inventado. */
const EXEMPLO: Horario[] = [
  { data: "", hora: 9 },
  { data: "", hora: 11 },
  { data: "", hora: 15 },
];

const DIAS = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];

function rotuloDia(iso: string): string {
  if (!iso) return "exemplo";
  const [a, m, d] = iso.split("-").map(Number);
  const dt = new Date(a, m - 1, d);
  const hoje = new Date();
  const mesmo =
    dt.getDate() === hoje.getDate() &&
    dt.getMonth() === hoje.getMonth() &&
    dt.getFullYear() === hoje.getFullYear();
  if (mesmo) return "hoje";
  return `${DIAS[dt.getDay()]} ${d}/${String(m).padStart(2, "0")}`;
}

export function AgendaViva() {
  const [procedimentos, setProcedimentos] = useState<string[]>([]);
  const [escolhido, setEscolhido] = useState<string>("");
  const [horarios, setHorarios] = useState<Horario[] | null>(null);
  const [erro, setErro] = useState(false);

  useEffect(() => {
    let vivo = true;
    // `horarios: null` = esqueleto. Os chips seguem clicáveis durante a
    // troca: travar a lista faria a seção parecer lenta justamente quando
    // ela está provando que é real.
    setHorarios(null);
    const q = escolhido ? `?procedimento=${encodeURIComponent(escolhido)}` : "";
    fetch(`/api/site/agenda-demo${q}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((j) => {
        if (!vivo) return;
        if (Array.isArray(j.procedimentos) && j.procedimentos.length > 0) {
          setProcedimentos(j.procedimentos);
        }
        setHorarios(j.horarios ?? []);
        setErro(false);
      })
      .catch(() => {
        if (!vivo) return;
        setHorarios(EXEMPLO);
        setErro(true);
      });
    return () => {
      vivo = false;
    };
  }, [escolhido]);

  const vazio = horarios !== null && horarios.length === 0;

  return (
    <div className="av">
      <div className="av-chips" role="group" aria-label="Procedimentos">
        <button
          type="button"
          className={`av-chip${escolhido === "" ? " ativo" : ""}`}
          onClick={() => setEscolhido("")}
        >
          Qualquer um
        </button>
        {procedimentos.map((p) => (
          <button
            key={p}
            type="button"
            className={`av-chip${escolhido === p ? " ativo" : ""}`}
            onClick={() => setEscolhido(p)}
          >
            {p}
          </button>
        ))}
      </div>

      <div className="av-quadro">
        <div className="av-quadro-topo">
          <span>Próximos horários livres</span>
          {erro && <span className="av-selo">exemplo</span>}
        </div>

        {horarios === null ? (
          <div className="av-grade">
            {[0, 1, 2, 3, 4].map((i) => (
              <span key={i} className="av-esqueleto" />
            ))}
          </div>
        ) : vazio ? (
          // O momento em que a promessa vira demonstração: o horário existia
          // com "qualquer um" e sumiu ao escolher o procedimento.
          <p className="av-vazio">
            Ninguém que faz <strong>{escolhido}</strong> está na escala nos
            próximos dias.
          </p>
        ) : (
          <div className="av-grade">
            {horarios.map((h, i) => (
              <span key={`${h.data}-${h.hora}-${i}`} className="av-slot">
                <em>{rotuloDia(h.data)}</em>
                {String(h.hora).padStart(2, "0")}:00
              </span>
            ))}
          </div>
        )}

        <p className="av-nota">
          Agenda real da LINS, consultada agora. Nenhum nome de cliente sai
          daqui — só o horário livre.
        </p>
      </div>
    </div>
  );
}
