# KH Esports — Advertisement System

## Critical fixes in this version

### 1. `+ Add Block` no longer silently fails
The previous code created the button as `data-row-add="0"` but then read `btn.dataset.row`, which is a different dataset property. That produced `undefined`, `Number(undefined) -> NaN`, and the handler returned without creating anything.

The fixed version reads the actual `data-row-add` attribute and validates the row index.

### 2. Firestore `missing or insufficient permissions`
This error is caused by Firebase Firestore Security Rules, not by the Save Advertisement button. The signed-in Admin account must be allowed to write:

`advertisements/main`

Add the following rule to your EXISTING Firestore rules:

```text
match /advertisements/{advertisementId} {
  allow read: if true;
  allow write: if request.auth != null;
}
```

Do not delete your existing `brackets`, users, or other collection rules.

The included `firestore.rules` file is a reference/example. If your project already has a complete ruleset, merge only the advertisement `match` block into it.

For stronger security, replace `request.auth != null` with your actual admin-only condition (custom admin claim or specific admin UID).

### 3. Firebase Storage
Image uploads use Firebase Storage under:

`advertisements/...`

The signed-in Admin must be allowed to write there. The included `storage.rules` file contains the corresponding reference rule.

## Public page
- Full-screen advertisement on page load when enabled.
- X close button.
- Closed advertisement becomes a floating reopen button.
- Floating button moves above Back-to-Top when necessary.
- Firestore `onSnapshot` keeps the public page synchronized.

## Block types
- Text: Title / Subtitle / Paragraph, width, alignment, font, color/theme, bold, italic, underline.
- Image: Firebase Storage upload or image URL, alt text, preview.
- Countdown: label and target date/time.
- Blocks can be reordered within a row and moved between rows.

## Files changed
- `admin.html`
- `firestore.rules` (reference rules)
- `storage.rules` (reference rules)
- `ADVERTISEMENT-SETUP.md`
