import { toast as sonner } from "sonner";

// Replica showToast do legacy usando o toast do shadcn (sonner).
// O <Toaster /> já está montado no layout raiz.
export type ToastType = "info" | "success" | "error";

export function showToast(msg: string, type: ToastType = "info") {
  if (type === "success") return sonner.success(msg);
  if (type === "error") return sonner.error(msg);
  return sonner.info(msg);
}
