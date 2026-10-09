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
  const inOrk = pathname.startsWith("/financeiro/ork/");
  const redirectTo = unit && ork !== inOrk ? (ork ? "/financeiro/ork/inteligencia" : "/financeiro") : null;
  useEffect(() => { if (redirectTo) router.replace(redirectTo); }, [redirectTo,router]);
  return redirectTo ? <p role="status">Abrindo a unidade selecionada…</p> : children;
}
