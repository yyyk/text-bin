import { useId, useRef } from "react"
import { Upload } from "lucide-react"
import { Hint } from "@/components/Hint"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { BUILTIN_FONTS, type FontEntry } from "@/lib/fonts"

/**
 * The font: a built-in one or one uploaded this session, and a button to
 * upload one (.ttf, .otf), as in type-shards. Laid out like the other fields.
 */
export function FontField({
  value,
  fonts,
  onChange,
  onUpload,
}: {
  value: string
  fonts: readonly FontEntry[]
  onChange: (id: string) => void
  onUpload: (file: File) => void
}) {
  const id = useId()
  const fileRef = useRef<HTMLInputElement>(null)
  const isBuiltIn = (f: FontEntry) => BUILTIN_FONTS.some((b) => b.id === f.id)
  const items = fonts.map((f) => ({ value: f.id, label: f.name }))
  const uploaded = fonts.filter((f) => !isBuiltIn(f))

  return (
    <div className="flex items-center justify-between gap-2">
      <Label htmlFor={id}>Font</Label>
      <div className="flex w-32 gap-1">
        <Select
          items={items}
          value={value}
          onValueChange={(v) => v !== null && onChange(v)}
        >
          <SelectTrigger
            id={id}
            aria-label="Font"
            size="sm"
            className="min-w-0 flex-1"
          >
            <SelectValue />
          </SelectTrigger>
          {/* as wide as the longest name (up to max-w), not just the field */}
          <SelectContent className="w-auto max-w-80 min-w-(--anchor-width)">
            {fonts.filter(isBuiltIn).map((f) => (
              <SelectItem key={f.id} value={f.id}>
                {f.name}
              </SelectItem>
            ))}
            {uploaded.length > 0 && (
              <>
                <SelectSeparator />
                <SelectGroup>
                  <SelectLabel>Uploaded</SelectLabel>
                  {uploaded.map((f) => (
                    <SelectItem key={f.id} value={f.id}>
                      {f.name}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </>
            )}
          </SelectContent>
        </Select>
        <Hint label="Upload a font (.ttf, .otf)">
          <Button
            variant="outline"
            size="icon-sm"
            aria-label="Upload font"
            onClick={() => fileRef.current?.click()}
          >
            <Upload />
          </Button>
        </Hint>
        <input
          ref={fileRef}
          type="file"
          name="font-file"
          accept=".ttf,.otf"
          hidden
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) onUpload(file)
            e.target.value = "" // the same file again counts as a change
          }}
        />
      </div>
    </div>
  )
}
