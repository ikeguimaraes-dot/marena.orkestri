"use client";
import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useUnit } from "@maza/auth/context";
import { isReconciliationUnit } from "@/lib/ork/config";

export function OrkBoundary({children}: {children: React.ReactNode}) {
  const {unit} = useUnit();
  const pathname = usePathname();
  const router = useRouter();
  const ork = isReconciliationUnit(unit);
  const needsRedirect = ork && !pathname.startsWith("/financeiro/ork/");
  useEffect(() => { if (needsRedirect) router.replace("/financeiro/ork/inteligencia"); }, [needsRedirect,router]);
  return needsRedirect ? <p role="status">Abrindo a área de conciliação da Restaurante Ork…</p> : children;
}
