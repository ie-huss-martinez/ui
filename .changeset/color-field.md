---
"@hussmartinez/ui": minor
---

Add `ColorField`, a colour input that works with the keyboard alone and doesn't use the browser's own colour picker: a hex input (`#rrggbb` or `#rgb`, with or without the `#`) beside a preview, and optional `swatches`, each `{ value, label }`, as a radio group named after the field. Its value is always lowercase `#rrggbb`, through `value` and `onValueChange` or `defaultValue`, and `name` submits it with a form. In a `Field`, it takes the field's label, description and error.

```tsx
<Field label={t("shape.fill")}>
  <ColorField value={fill} onValueChange={setFill} swatches={[{ value: "#d92d20", label: t("colors.red") }]} />
</Field>
```

It adds the message `colorField.swatches` and the component tokens `--hm-color-field-gap`, `--hm-color-field-swatch-size`, `--hm-color-field-swatch-radius`, `--hm-color-field-swatch-border-color` and `--hm-color-field-swatch-checked-border-color`. `Field`'s label now has an `id`.
