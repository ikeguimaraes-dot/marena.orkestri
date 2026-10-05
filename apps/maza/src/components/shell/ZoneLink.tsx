"use client";

import type { CSSProperties, ReactNode } from "react";

export function ZoneLink({
  href,
  children,
  style,
  current,
}: {
  href: string;
  children: ReactNode;
  style?: CSSProperties;
  current?: boolean;
}) {
  return (
    <a
      href={href}
      aria-current={current ? "page" : undefined}
      style={style}
    >
      {children}
    </a>
  );
}
