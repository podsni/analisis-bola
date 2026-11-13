export function Prompt({ command }: { command: string }) {
  return (
    <p className="kicker prompt">
      $ {command}
      <span className="cursor" aria-hidden="true" />
    </p>
  );
}
