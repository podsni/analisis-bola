import type { ReactNode } from "react";

export function MatchTabs({
  tabs,
}: {
  tabs: { id: string; label: string; node: ReactNode }[];
}) {
  const rules = tabs
    .map((t) => `.bb-tabs:has(#tab-${t.id}:checked) .panel-${t.id}{display:block}`)
    .join("");
  return (
    <div className="bb-tabs">
      <style dangerouslySetInnerHTML={{ __html: `${rules}.bb-tabpanel{display:none}` }} />
      <div className="bb-tablist">
        {tabs.map((t, i) => (
          <span key={t.id} className="bb-tab-item">
            <input type="radio" name="match-tab" id={`tab-${t.id}`} defaultChecked={i === 0} />
            <label htmlFor={`tab-${t.id}`}>{t.label}</label>
          </span>
        ))}
      </div>
      {tabs.map((t) => (
        <div key={t.id} className={`bb-tabpanel panel-${t.id}`} id={`panel-${t.id}`}>
          {t.node}
        </div>
      ))}
    </div>
  );
}
