"use client";

import { useState } from "react";
import {
  QueryCache,
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query";
import { showToast } from "@/lib/toast";

// Camada de dados: cache/dedupe de fetch compartilhado entre as telas.
// Erros de qualquer query caem num toast único (centraliza o tratamento).
export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        queryCache: new QueryCache({
          onError: () => showToast("Erro ao carregar os dados.", "error"),
        }),
        defaultOptions: {
          queries: {
            staleTime: 30_000, // 30s: navegar entre telas não refaz o fetch
            refetchOnWindowFocus: false,
            retry: 1,
          },
        },
      })
  );

  return (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
}
