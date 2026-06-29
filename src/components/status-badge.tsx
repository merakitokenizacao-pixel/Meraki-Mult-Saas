import { statusBadgeClass } from "@/lib/format";

// Replica badgeHtml do legacy: <span class="badge badge-X">status</span>.
export function StatusBadge({ status }: { status?: string | null }) {
  return (
    <span className={`badge ${statusBadgeClass(status)}`}>
      {status || "novo"}
    </span>
  );
}
