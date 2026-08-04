import { useEffect, useMemo, useState } from "react";
import type { ClipartCategory } from "@corvianaire/shared/types";
import { ProxyApiError } from "@corvianaire/shared/api";
import { clipartClient } from "../api/client";
import { loadFabric } from "../canvas/load-fabric";
import type { UseFabricCanvasResult } from "../canvas/use-fabric-canvas";

interface ClipartLibraryProps {
  fabricCanvas: UseFabricCanvasResult;
}

type LoadState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; categories: ClipartCategory[] };

export function ClipartLibrary({ fabricCanvas }: ClipartLibraryProps) {
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [search, setSearch] = useState("");

  useEffect(() => {
    let cancelled = false;
    clipartClient
      .getClipartLibrary()
      .then((categories) => {
        if (!cancelled) setState({ status: "ready", categories });
      })
      .catch((error) => {
        if (cancelled) return;
        const message = error instanceof ProxyApiError ? error.message : "Couldn't load clipart.";
        setState({ status: "error", message });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const filteredCategories = useMemo(() => {
    if (state.status !== "ready") return [];
    const query = search.trim().toLowerCase();
    if (!query) return state.categories;

    return state.categories
      .map((category) => ({
        ...category,
        assets: category.assets.filter(
          (asset) =>
            asset.name.toLowerCase().includes(query) ||
            asset.tags.some((tag) => tag.toLowerCase().includes(query)),
        ),
      }))
      .filter((category) => category.assets.length > 0);
  }, [state, search]);

  async function handleAddClipart(fileUrl: string) {
    const { fabric } = await loadFabric();
    fabric.loadSVGFromURL(fileUrl, (objects, options) => {
      const grouped = fabric.util.groupSVGElements(objects, options);
      const maxDim = 150;
      const scale = Math.min(1, maxDim / Math.max(grouped.width ?? maxDim, grouped.height ?? maxDim));
      grouped.set({ left: 120, top: 120, scaleX: scale, scaleY: scale });
      fabricCanvas.addObject(grouped);
    });
  }

  if (state.status === "loading") return <p>Loading clipart…</p>;
  if (state.status === "error") return <p className="corvianaire-error">{state.message}</p>;

  return (
    <div className="corvianaire-tool-panel corvianaire-clipart-tool">
      <input
        type="search"
        placeholder="Search clipart…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      {filteredCategories.length === 0 && <p>No clipart matches “{search}”.</p>}

      {filteredCategories.map((category) => (
        <div key={category.id} className="corvianaire-clipart-category">
          <h4>{category.name}</h4>
          <div className="corvianaire-clipart-grid">
            {category.assets.map((asset) => (
              <button
                key={asset.id}
                type="button"
                className="corvianaire-clipart-item"
                title={asset.name}
                disabled={!fabricCanvas.ready}
                onClick={() => handleAddClipart(asset.fileUrl)}
              >
                <img src={asset.thumbUrl} alt={asset.name} loading="lazy" />
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
