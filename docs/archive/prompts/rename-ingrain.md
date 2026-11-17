# Prompt log: Rename to Ingrain + homepage

## The prompt (feedback from my partner Devi's test)

> Let's rename the product to "Ingrain" (give it a nice and simple icon).
> Homepage: explain the vision in 2–3 lines and the why behind this product. Make the CTA more visible (widget sized).

## What was built

- **Name:** Recall → **Ingrain** in the header, homepage, page title, sign-up form, README, and schema.md.
- **Icon:** a sprout taking root (ink on the amber accent), shared by the `Logo` component and `app/icon.svg`
  (Next uses it as the favicon). The old default `favicon.ico` was removed.
- **Homepage:** headline "Read once. Know it for good.", a 2-line vision, and a "Why" block
  (we forget most of what we read; what sticks is connections, real-world examples, and recalling it yourself).
- **CTA:** the sign-up form is now a large widget ("Ingrain your first chapter") with an accent border and glow
  and a bigger button.

## Bug caught

The accent border on the widget didn't show. Our custom classes (`.card`, `.btn-*`, `.input`) weren't
in a CSS layer, so in Tailwind v4 they beat any utility class on the same element. I moved them into
`@layer components`, so utilities like `p-8` or `border-accent/60` can override them.

## Verification

Checked the homepage in the browser at 1280×800. The widget border, larger button, logo, and new copy all show.
