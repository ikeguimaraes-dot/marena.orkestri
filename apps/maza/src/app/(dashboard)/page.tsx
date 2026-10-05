import { redirect } from "next/navigation";

// Raiz do dashboard — redireciona pro Dashboard Executivo (E3).
export default async function DashboardRootPage() {
  redirect("/dashboard");
}
