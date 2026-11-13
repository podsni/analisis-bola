"use client";

import Link from "next/link";
import { Crest } from "./Crest";

export function TeamLink({
  slug,
  id,
  name,
  logo,
  size = 28,
  className,
}: {
  slug: string;
  id?: string;
  name: string;
  logo?: string;
  size?: number;
  className?: string;
}) {
  const inner = (
    <>
      <Crest name={name} logo={logo} size={size} />
      <span>{name}</span>
    </>
  );
  if (!id) return <span className={`team-link ${className ?? ""}`}>{inner}</span>;
  return (
    <Link href={`/liga/${slug}/tim/${id}`} className={`team-link ${className ?? ""}`}>
      {inner}
    </Link>
  );
}
