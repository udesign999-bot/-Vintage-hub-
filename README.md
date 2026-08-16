# Vintage Hub — catalog site (per-category files for GitHub)

## What changed in this update

1. **Fixed: photos disappearing after GitHub upload.** The old "Download
   changed files" button gave you a `.zip` with the changed file(s) inside
   a `data/` folder. If you unzip that and drag the whole `data` folder in
   while you're already browsing inside your repo's own `data/` folder on
   GitHub, it nests as `data/data/retro-graphics.js` instead of
   overwriting the real file — so nothing visibly changed and your photo
   uploads looked like they vanished. **Fixed**: the button now downloads
   plain `.js` files directly (no zip, no folder nesting) — just drag them
   straight into `data/` and commit.
2. **Added: bulk photo upload.** Open a category as admin/sub-admin and
   you'll see a "Bulk add photos" button — pick several image files at
   once and they fill the next empty slots automatically, no need to open
   each tile one at a time. You can still open any tile afterwards to
   crop, re-order, or replace it individually.
3. **Fixed: rigid cropping.** Cropping is now completely free-form — drag
   whatever shape you want, nothing gets forced into a fixed box. Each
   photo's tile on the site now matches its own natural proportions
   instead of being squeezed into a fixed rectangle.
4. **Replaced the t-shirt outline with your actual photos.** The "Create
   Your Own Design" tool now shows your real `tfront.png` / `tback.png`
   product photos as the locked background, both on the side-picker screen
   and inside the designer canvas.
5. **Added: re-crop on placed designs.** Every image you place on the
   t-shirt now has a small pencil (✎) button — use it to re-crop or zoom
   that image again later, without having to remove and re-upload it.
6. **Fixed: the 129-screenshots bug.** "Confirm this side" and "Send order
   on WhatsApp" had no protection against being triggered more than once —
   if the tap felt slow and got tapped again (very easy to do on a phone
   while html2canvas is working), every extra tap saved another duplicate
   record. Both buttons now lock themselves the instant they're clicked,
   show a "Saving…" state, and only unlock again once that one action is
   completely finished. One tap now always means exactly one saved record.
7. **Added: a proper two-screenshot record, one per action.**
   - Click **Confirm this side** → exactly one screenshot of that design is
     saved to **Confirmed designs** in the dashboard.
   - Click **Send order on WhatsApp** → a second screenshot is taken — a
     receipt showing the reference number, sides, and collection window —
     and saved to **Orders placed**, so every order has its own labelled
     record alongside the design image(s).
   - That same reference number is included in the WhatsApp message, so
     what you see on WhatsApp and what's in the dashboard always match.
8. **Added: Clear buttons** on both Orders placed and Confirmed designs in
   the dashboard, so you can wipe out test data (like the 129 duplicate
   entries from the bug above) whenever you want. Each asks for
   confirmation first since it can't be undone.

## File structure

```
index.html
style.css
app.js
migrate-old-data.js            (one-time helper, see below)
assets/logo-vintagehub.js      (top logo)
assets/logo-aakriti.js         (footer "Powered by" logo)
assets/logo-tshirt-front.js    (t-shirt front photo)
assets/logo-tshirt-back.js     (t-shirt back photo)
data/typography.js             (20 photo slots)
data/retro-graphics.js         (20 photo slots)
data/pop-culture.js            (20 photo slots)
data/nature.js                 (20 photo slots)
data/humor.js                  (20 photo slots)
```

Each category file is its own small `.js` file — even completely full of
photos it's typically well under 1–2 MB, nowhere close to GitHub's 25 MB
per-file upload limit. When you only change one category, you only ever
need to re-upload that one file.

## 1. Put it on GitHub

1. Create a new **public** repository (or use your existing one).
2. Upload every file above, keeping the folder structure exactly as shown
   (the `data/` and `assets/` folders matter — `index.html` loads files
   from those exact paths).
3. **Settings → Pages** → source: your default branch, root folder. Save.
4. Your site is live at `https://<username>.github.io/<repo>/`.

## 2. How editing + publishing works

Admin and sub-admin unlock the same way as before (10 clicks on the
"Powered by AAKRITI" logo for admin, 5 clicks on the top logo for
sub-admin).

- **Single photo**: open any tile, upload, crop freely (any shape), save.
- **Several photos at once**: open a category, use **Bulk add photos**,
  select multiple files in the picker — they fill the next empty slots in
  the order you picked them, keeping each photo's own proportions. Go back
  and open any individual tile afterwards if one needs a manual crop.
- Every edit saves instantly **in this browser** so you don't lose work on
  reload. The admin bar shows how many category files have unpublished
  changes.
- Click **Download changed files** — downloads the raw `.js` file(s) for
  just the categories you touched. Drag them straight into your repo's
  `data/` folder on GitHub (no unzip step), replacing the old ones, and
  commit. GitHub Pages rebuilds in a minute or two and every visitor sees
  the update.

## 3. Bringing over the photos you already uploaded

If you were testing on an older single-file version, those photos are
sitting in that browser's local storage — not something reachable from
here. To pull them into this version without redoing the uploads:

1. Open the **old** site in your browser (the tab/page where you added
   photos through admin or sub-admin before).
2. Open Developer Tools (F12) → **Console** tab.
3. Open `migrate-old-data.js` (included in this project), copy its entire
   contents, paste into the console, press Enter.
4. It downloads one file per category that had photos in it. Drop those
   into this project's `data/` folder (overwriting the empty placeholders)
   before your first GitHub upload.

## 4. Create Your Own Design

- Choose **Back** or **Front** — the real t-shirt photo shows as a locked
  background you can't accidentally move.
- **+ Add design**: choose from your catalog or upload your own (cropped
  first, then deliberately kept small/lighter-quality so the page stays
  fast) — up to 3 images per side.
- **+ Add text**: a draggable text note for anything the customer wants
  written.
- Every image layer can be dragged, resized (corner handle), and re-cropped
  (pencil button) any time before confirming.
- **Confirm this side** saves one screenshot to the dashboard's Confirmed
  designs, then lets you do the other side or continue.
- **Send order on WhatsApp** saves a second, reference-numbered receipt
  screenshot to Orders placed, downloads the design image(s), and opens
  WhatsApp with everything pre-filled — one tap, no waiting on a share
  sheet.

## Notes on security

The 10-click / 5-click gestures are an obscurity layer, not real security.
The password + question (admin) and password + code (sub-admin) are
checked as hashes stored in `app.js`, never as plain text. Change them
anytime with the console command noted in the comments above
`ADMIN_PASSWORD_HASH` / `SUBADMIN_PASSWORD_HASH` in `app.js`.

Orders, confirmed designs, and the click dashboard still only reflect
activity on whatever single device/browser is being used — that part is
unchanged and still needs a real backend (e.g. Firebase) to track every
visitor for real. Ask any time if you'd like that added.
