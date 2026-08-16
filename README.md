# Vintage Hub — catalog site (per-category files for GitHub)

This is the multi-file version of the site, so photos actually persist for
every visitor once it's on GitHub Pages — and so editing one category never
means re-uploading the whole site.

## File structure

```
index.html
style.css
app.js
assets/logo-vintagehub.js      (top logo)
assets/logo-aakriti.js         (footer "Powered by" logo)
data/typography.js             (20 photo slots)
data/retro-graphics.js         (20 photo slots)
data/pop-culture.js            (20 photo slots)
data/nature.js                 (20 photo slots)
data/humor.js                  (20 photo slots)
```

Each category file is its own small `.js` file — typically well under
1 MB even completely full of photos (20 photos × ~50–100 KB each), nowhere
close to GitHub's 25 MB per-file upload limit. When you only change one
category, you only ever need to re-upload that one file.

## 1. Put it on GitHub

1. Create a new **public** repository (or use your existing one).
2. Upload every file above, keeping the folder structure exactly as shown
   (the `data/` and `assets/` folders matter — `index.html` loads files
   from those exact paths).
3. **Settings → Pages** → source: your default branch, root folder. Save.
4. Your site is live at `https://<username>.github.io/<repo>/`.

## 2. How editing + publishing works now

Admin and sub-admin still unlock the same way as before (10 clicks on the
"Powered by AAKRITI" logo for admin, 5 clicks on the top logo for
sub-admin). Editing a photo still works the same — upload, drag, crop,
zoom, save.

The difference is what happens after you save a photo:

- It's saved instantly in **this browser** (so you can keep editing,
  reload the page, and not lose anything).
- The admin bar shows how many category files have unpublished changes.
- Click **Download changed files** — this downloads a small `.zip`
  containing **only** the category file(s) you actually touched (e.g. if
  you only edited Retro Graphics, you get just `retro-graphics.js`, not
  all five).
- Unzip it and drag that file into your GitHub repo's `data/` folder,
  replacing the old one. Commit. GitHub Pages rebuilds in a minute or two
  and every visitor sees the update — no need to touch typography, nature,
  or any other category's file.

## 3. Bringing over the photos you already uploaded

Since your previous testing was on the old single-file version, those
photos are sitting in that browser's local storage — not something I can
reach from here. To pull them into this new version without redoing the
uploads:

1. Open the **old** site in your browser (the tab/page where you added
   photos through admin or sub-admin before).
2. Open Developer Tools (F12) → **Console** tab.
3. Open `migrate-old-data.js` (included alongside this README), copy its
   entire contents, paste into the console, press Enter.
4. It downloads one file per category that had photos in it. Drop those
   into this new project's `data/` folder (overwriting the empty
   placeholders) before your first GitHub upload.

## Notes on security

Same as before — the 10-click / 5-click gestures are just an obscurity
layer, not real security. The password + question (admin) and password +
code (sub-admin) are checked as hashes stored in `app.js`, never as plain
text. Change them anytime with the console command noted in the comments
above `ADMIN_PASSWORD_HASH` / `SUBADMIN_PASSWORD_HASH` in `app.js`.

Orders, confirmed designs, and the click dashboard still only reflect
activity on whatever single device/browser is being used — that part is
unchanged and still needs a real backend (e.g. Firebase) to track every
visitor for real. Ask any time if you'd like that added.
