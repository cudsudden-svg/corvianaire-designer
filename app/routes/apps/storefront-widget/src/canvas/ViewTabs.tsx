import type { PrintViewName } from "@corvianaire/shared/types";
import { printViewLabel } from "@corvianaire/shared/utils";

interface ViewTabsProps {
  views: PrintViewName[];
  activeView: PrintViewName;
  onSelect: (view: PrintViewName) => void;
}

export function ViewTabs({ views, activeView, onSelect }: ViewTabsProps) {
  return (
    <div className="corvianaire-view-tabs" role="tablist">
      {views.map((view) => (
        <button
          key={view}
          type="button"
          role="tab"
          aria-selected={view === activeView}
          className={view === activeView ? "is-active" : undefined}
          onClick={() => onSelect(view)}
        >
          {printViewLabel(view)}
        </button>
      ))}
    </div>
  );
}
