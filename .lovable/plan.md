## Problem

`src/index.css` sets a global `color: #ffffff` on `html, body`. Native `<input>`, `<select>`, and `<textarea>` elements inherit that color. On the older AppShell pages we always paired inputs with shadcn's `<Input>` / `<Textarea>` components (which set their own dark text), but the newer **Scouting** (Add prospect) and **Welfare & Education** (New pastoral log) pages use raw `<input>`, `<select>`, and `<textarea>` tags styled only with `rounded-lg border border-slate-200 …`. With no explicit text color they render white text on a white background — typed values and selected options are invisible.

## Fix

Two-part fix so this doesn't recur:

### 1. Global safety net in `src/index.css`

Add a base rule so any unstyled native form control on a light background still renders readable text and placeholders:

```css
@layer base {
  input, select, textarea {
    color: hsl(222 47% 11%); /* slate-900 */
  }
  input::placeholder, textarea::placeholder {
    color: hsl(215 16% 47%); /* slate-500 */
  }
  option {
    color: hsl(222 47% 11%);
    background: #ffffff;
  }
}
```

This catches any other newly-added page that forgets explicit text classes, without affecting the iOS dark screens (those use shadcn components or set their own `text-white` explicitly, which wins via specificity/utility order).

### 2. Explicit utilities on the offending controls

Update the raw form controls in:

- `src/pages/Scouting.tsx` — the "Add prospect" form (5 text inputs + DOB date input)
- `src/pages/Welfare.tsx` — the "New pastoral log" form (3 selects, 1 input, 1 textarea)

Append `text-slate-900 placeholder-slate-400 bg-white` to the existing `className` of each `<input>`, `<select>`, and `<textarea>`. This makes the intent explicit and survives any future change to the global rule.

## Verification

1. Open `/scouting`, click **Add prospect**, type into First name / Last name / Position / Current club / Parent contact, pick a DOB — text is dark and readable.
2. Open `/welfare`, click **New log**, open each of the three dropdowns (Player, Type, Status), type into Tags and Notes — option list and typed text are dark and readable.
3. Spot-check Compliance, Settings, Medical, Fitness Testing, Player Profile to confirm no regression (those use shadcn `<Input>` so unaffected).
