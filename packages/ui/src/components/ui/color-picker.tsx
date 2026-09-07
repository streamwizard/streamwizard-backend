"use client"

import * as React from "react"
import { HexColorPicker } from "react-colorful"

import { cn } from "@/lib/utils"
import { Input } from "./input"
import { Popover, PopoverContent, PopoverTrigger } from "./popover"

const DEFAULT_SWATCHES = [
  "#ffffff",
  "#d4d4d8",
  "#71717a",
  "#000000",
  "#ef4444",
  "#f97316",
  "#facc15",
  "#22c55e",
  "#06b6d4",
  "#3b82f6",
  "#9e7aff",
  "#ec4899",
]

const HEX_RE = /^#[0-9a-fA-F]{6}$/

/** Coerce anything into a valid 6-digit hex, falling back to `fallback`. */
function normalizeHex(value: string | undefined, fallback: string) {
  if (!value) return fallback
  const withHash = value.startsWith("#") ? value : `#${value}`
  if (HEX_RE.test(withHash)) return withHash.toLowerCase()
  // Expand shorthand (#abc -> #aabbcc)
  if (/^#[0-9a-fA-F]{3}$/.test(withHash)) {
    const [r, g, b] = withHash.slice(1).split("")
    return `#${r}${r}${g}${g}${b}${b}`.toLowerCase()
  }
  return fallback
}

type ColorPickerProps = {
  value: string
  onChange: (value: string) => void
  /** Used when `value` is empty or not a valid hex. */
  fallback?: string
  swatches?: string[]
  disabled?: boolean
  className?: string
  id?: string
  "aria-label"?: string
}

function ColorPicker({
  value,
  onChange,
  fallback = "#ffffff",
  swatches = DEFAULT_SWATCHES,
  disabled,
  className,
  id,
  "aria-label": ariaLabel,
}: ColorPickerProps) {
  const color = normalizeHex(value, fallback)
  // Local draft so the user can type a partial hex without it being committed.
  const [draft, setDraft] = React.useState(color)

  React.useEffect(() => {
    setDraft(color)
  }, [color])

  const commitDraft = (raw: string) => {
    const next = normalizeHex(raw, color)
    setDraft(next)
    if (next !== color) onChange(next)
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          id={id}
          disabled={disabled}
          aria-label={ariaLabel ?? "Pick a color"}
          className={cn(
            "flex h-9 w-full items-center gap-2 rounded-md border border-input bg-background px-2 text-left text-xs shadow-xs transition-colors",
            "hover:bg-accent/50 focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none",
            "disabled:cursor-not-allowed disabled:opacity-50",
            className
          )}
        >
          <span
            className="size-5 shrink-0 rounded-sm border border-border/60"
            style={{ backgroundColor: color }}
          />
          <span className="truncate font-mono uppercase text-muted-foreground">
            {color}
          </span>
        </button>
      </PopoverTrigger>

      <PopoverContent align="start" className="w-56 space-y-3 p-3">
        <HexColorPicker
          color={color}
          onChange={onChange}
          className="!w-full"
          style={{ width: "100%", height: 140 }}
        />

        <div className="flex items-center gap-2">
          <span
            className="size-8 shrink-0 rounded-md border border-border/60"
            style={{ backgroundColor: color }}
          />
          <Input
            value={draft}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              setDraft(e.target.value)
            }
            onBlur={(e: React.FocusEvent<HTMLInputElement>) =>
              commitDraft(e.target.value)
            }
            onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => {
              if (e.key === "Enter") {
                e.preventDefault()
                commitDraft(e.currentTarget.value)
              }
            }}
            spellCheck={false}
            aria-label="Hex color"
            className="h-8 font-mono text-xs uppercase"
          />
        </div>

        {swatches.length > 0 && (
          <div className="grid grid-cols-6 gap-1.5">
            {swatches.map((swatch) => (
              <button
                key={swatch}
                type="button"
                aria-label={swatch}
                onClick={() => onChange(normalizeHex(swatch, fallback))}
                className={cn(
                  "size-6 rounded-sm border border-border/60 transition-transform hover:scale-110",
                  normalizeHex(swatch, fallback) === color &&
                    "ring-2 ring-ring ring-offset-1 ring-offset-popover"
                )}
                style={{ backgroundColor: swatch }}
              />
            ))}
          </div>
        )}
      </PopoverContent>
    </Popover>
  )
}

export { ColorPicker, normalizeHex as normalizeHexColor }
