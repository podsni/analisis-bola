export function Callout({
  children,
  soft = false,
}: {
  children: React.ReactNode;
  soft?: boolean;
}) {
  return <div className={`callout${soft ? " soft" : ""}`}>{children}</div>;
}
