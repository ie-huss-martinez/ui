---
"@hussmartinez/ui": minor
---

Add `TextArea`, a multi-line text input styled like `TextField` and using its tokens, states and density. `rows` sets its height, three by default, and the user can drag it taller. Native textarea props pass through, plus `onValueChange(value)` and `label`; in a `Field`, it takes the field's label, description and error. It adds the component token `--hm-text-area-padding-y`.

```tsx
<Field label={t("text.content")}>
  <TextArea value={text} onValueChange={setText} rows={4} />
</Field>
```
