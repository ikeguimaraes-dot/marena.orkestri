"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../types/database";

export function getBrowserClient(): SupabaseClient<Database> | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return null;

  // Extrai o project ref da URL para montar o storageKey canônico do Supabase.
  // O server client (proxy.ts / server.ts) deriva o mesmo key da URL — garante paridade.
  const projectRef = url.match(/\/\/([^.]+)\.supabase\.co/)?.[1] ?? "";
  const storageKey = `sb-${projectRef}-auth-token`;

  return createBrowserClient<Database>(url, anonKey, {
    // cookieOptions define os atributos do cookie E o storageKey (via `name`).
    // Passado explicitamente para garantir que browser e server concordam no key.
    cookieOptions: {
      name: storageKey,
      path: "/",
      sameSite: "lax",
      secure: true,
      maxAge: 60 * 60 * 24 * 400,
    },
    // cookies: { getAll, setAll } bypassa o cookie.serialize() interno do @supabase/ssr,
    // que pode falhar silenciosamente em certos bundles (cookie v1.x + Turbopack).
    // Escrevemos document.cookie diretamente — o mesmo mecanismo que marena_unit_id usa.
    cookies: {
      getAll() {
        if (typeof document === "undefined") return [];
        return document.cookie.split(";").map((c) => {
          const eq = c.indexOf("=");
          const name = eq === -1 ? c.trim() : c.slice(0, eq).trim();
          const value = eq === -1 ? "" : c.slice(eq + 1);
          return { name, value };
        });
      },
      setAll(cookiesToSet) {
        if (typeof document === "undefined") return;
        cookiesToSet.forEach(({ name, value, options }) => {
          if (name.includes("auth-token") &&
              (value.length === 0 || (options?.maxAge != null && options.maxAge <= 0))) return;
          let str = `${name}=${value}`;
          if (options?.path) str += `; Path=${options.path}`;
          if (options?.maxAge != null) str += `; Max-Age=${options.maxAge}`;
          if (options?.sameSite) str += `; SameSite=${options.sameSite}`;
          if (options?.secure) str += "; Secure";
          document.cookie = str;
        });
      },
    },
  });
}
