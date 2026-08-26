import type { NextConfig } from "next";
import { verificarBanco } from "./src/lib/env";

// Antes de qualquer coisa: confere para qual banco este painel está apontando.
// O Next carrega os arquivos .env ANTES de avaliar este config, então a
// variável já está aqui — e um `dev`/`build`/`start` contra o banco errado
// morre agora, não depois de escrever alguma coisa lá. Ver src/lib/env.ts.
verificarBanco();

const nextConfig: NextConfig = {
  /* config options here */
};

export default nextConfig;
