"use client";

import { useState } from "react";

export function Crest({
  name,
  logo,
  size = 28,
}: {
  name: string;
  logo?: string;
  size?: number;
}) {
  const [failed, setFailed] = useState(false);
  if (!logo || failed) {
    return (
      <span className="crest fallback" style={{ width: size, height: size, fontSize: size * 0.32 }} title={name}>
        {name
          .split(" ")
          .filter(Boolean)
          .slice(0, 2)
          .map((w) => w[0])
          .join("")
          .toUpperCase()}
      </span>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      className="crest"
      src={logo}
      alt=""
      width={size}
      height={size}
      onError={() => setFailed(true)}
    />
  );
}
