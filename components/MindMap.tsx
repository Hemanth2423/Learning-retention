"use client";

import { Transformer } from "markmap-lib";
import { Markmap } from "markmap-view";
import { useEffect, useRef } from "react";

const transformer = new Transformer();

// Renders the AI's markdown outline as an interactive, zoomable mind map (click a node to fold it).
export function MindMap({ markdown }: { markdown: string }) {
  const svgRef = useRef<SVGSVGElement>(null);
  const mmRef = useRef<Markmap | null>(null);

  // Create and destroy together, so React's dev double-mount doesn't reuse a destroyed map.
  useEffect(() => {
    if (!svgRef.current) return;
    const mm = Markmap.create(svgRef.current, { initialExpandLevel: 3, duration: 300 });
    mmRef.current = mm;
    const { root } = transformer.transform(markdown);
    mm.setData(root).then(() => mm.fit());
    return () => {
      mm.destroy();
      mmRef.current = null;
    };
  }, [markdown]);

  return (
    <section>
      <div className="mb-3 flex items-baseline justify-between">
        <h2 className="font-serif text-2xl">Mind map</h2>
        <button className="text-sm text-muted hover:text-ink" onClick={() => mmRef.current?.fit()}>
          Re-center
        </button>
      </div>
      <div className="card overflow-hidden p-0">
        <svg
          ref={svgRef}
          className="markmap h-[440px] w-full"
          style={{ ["--markmap-text-color" as string]: "var(--ink)" }}
        />
      </div>
      <p className="mt-2 text-xs text-muted">Scroll to zoom, drag to pan, click a node to collapse it.</p>
    </section>
  );
}
