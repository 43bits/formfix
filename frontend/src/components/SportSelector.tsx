import { useEffect, useState, useMemo } from "react";
import type { Sport } from "../types";

interface Props {
  selected: string;
  onSelect: (key: string) => void;
}

export function SportSelector({ selected, onSelect }: Props) {
  const [sports, setSports] = useState<Sport[]>([]);
  const [search, setSearch]   = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("http://localhost:8000/api/sports/")
      .then((r) => r.json())
      .then((data) => { setSports(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const filtered = useMemo(() =>
    sports.filter((s) =>
      s.label.toLowerCase().includes(search.toLowerCase())
    ), [sports, search]
  );

  const current = sports.find((s) => s.key === selected);

  return (
    <div style={{ marginBottom: 16 }}>
      {/* Search + Auto button row */}
      <div style={{ display: "flex", gap: 8, marginBottom: 10, alignItems: "center" }}>
        <button
          onClick={() => { onSelect("unknown"); setSearch(""); }}
          style={{
            padding: "6px 14px", borderRadius: 20, fontSize: 13,
            border: "1px solid var(--color-border-secondary)", cursor: "pointer",
            whiteSpace: "nowrap", flexShrink: 0,
            background: selected === "unknown" ? "var(--color-text-primary)" : "transparent",
            color: selected === "unknown" ? "var(--color-background-primary)" : "var(--color-text-primary)",
          }}
        >
          Auto-detect
        </button>
        <input
          placeholder="Search exercise…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            flex: 1, padding: "6px 12px", borderRadius: 20, fontSize: 13,
            border: "1px solid var(--color-border-secondary)",
            background: "var(--color-background-secondary)",
            color: "var(--color-text-primary)", outline: "none",
          }}
        />
        {selected !== "unknown" && (
          <span style={{
            padding: "5px 12px", borderRadius: 20, fontSize: 12, fontWeight: 500,
            background: "var(--color-text-primary)", color: "var(--color-background-primary)",
            whiteSpace: "nowrap", flexShrink: 0,
          }}>
            {current?.label ?? selected.replace(/_/g, " ")}
          </span>
        )}
      </div>

      {/* Exercise grid */}
      {loading ? (
        <div style={{ fontSize: 13, color: "var(--color-text-secondary)" }}>Loading…</div>
      ) : (
        <div style={{
          display: "flex", flexWrap: "wrap", gap: 6,
          maxHeight: search ? "none" : 80, overflow: "hidden",
          transition: "max-height 0.2s",
        }}>
          {(search ? filtered : sports).map((s) => (
            <button
              key={s.key}
              onClick={() => { onSelect(s.key); setSearch(""); }}
              style={{
                padding: "5px 12px", borderRadius: 20, fontSize: 12,
                border: "1px solid var(--color-border-secondary)", cursor: "pointer",
                background: selected === s.key ? "var(--color-text-primary)" : "transparent",
                color: selected === s.key ? "var(--color-background-primary)" : "var(--color-text-primary)",
              }}
            >
              {s.label}
            </button>
          ))}
        </div>
      )}

      {/* Cues for selected */}
      {current?.cues && current.cues.length > 0 && (
        <div style={{
          display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8,
        }}>
          {current.cues.map((c, i) => (
            <span key={i} style={{
              padding: "3px 10px", borderRadius: 10, fontSize: 11,
              background: "var(--color-background-secondary)",
              color: "var(--color-text-secondary)",
            }}>
              {c}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}