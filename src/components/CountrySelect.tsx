"use client";

import { useMemo, useRef, useState } from "react";
import { ChevronDown, X } from "lucide-react";
import { countryFlag } from "@/lib/country-flags";

type Props = {
  countries: string[];
  value: string | null;
  onChange: (country: string | null) => void;
};

export function CountrySelect({ countries, value, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return countries;
    return countries.filter(
      (c) =>
        c.toLowerCase().includes(q) ||
        countryFlag(c).includes(q),
    );
  }, [countries, query]);

  function select(c: string | null) {
    onChange(c);
    setQuery("");
    setOpen(false);
  }

  return (
    <div className="relative">
      <div className="flex h-10 items-center rounded-md border border-input bg-background text-sm">
        <input
          ref={inputRef}
          type="text"
          value={open ? query : value ? `${countryFlag(value)} ${value}` : ""}
          placeholder="All countries"
          spellCheck={false}
          onChange={(e) => {
            setQuery(e.target.value);
            if (!open) setOpen(true);
          }}
          onFocus={() => {
            setOpen(true);
            setQuery("");
          }}
          className="flex-1 bg-transparent px-3 py-2 text-foreground placeholder:text-muted-foreground outline-none min-w-0"
        />
        {value ? (
          <button
            type="button"
            onClick={() => select(null)}
            className="px-2 text-muted-foreground hover:text-foreground"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        ) : (
          <ChevronDown className="mr-2 h-3.5 w-3.5 text-muted-foreground shrink-0" />
        )}
      </div>

      {open && (
        <ul className="absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-md border border-border bg-card shadow-lg">
          <li>
            <button
              type="button"
              onClick={() => select(null)}
              className="w-full px-3 py-2 text-left text-sm text-muted-foreground hover:bg-muted/60"
            >
              All countries
            </button>
          </li>
          {filtered.map((c) => (
            <li key={c}>
              <button
                type="button"
                onClick={() => select(c)}
                className="w-full px-3 py-2 text-left text-sm text-foreground hover:bg-muted/60 flex items-center gap-2"
              >
                <span>{countryFlag(c)}</span>
                <span className={value === c ? "font-semibold text-primary" : ""}>
                  {c}
                </span>
              </button>
            </li>
          ))}
          {filtered.length === 0 && (
            <li className="px-3 py-2 text-xs text-muted-foreground">
              No matching countries
            </li>
          )}
        </ul>
      )}

      {open && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setOpen(false)}
        />
      )}
    </div>
  );
}
