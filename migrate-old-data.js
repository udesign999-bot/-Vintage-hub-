/* ------------------------------------------------------------------
   ONE-TIME MIGRATION HELPER
   Run this in your browser console WHILE your old single-file
   Vintage Hub page is open (the one you already uploaded photos to).
   It reads whatever photos are saved in that page's browser storage
   and downloads them as the 5 new data/*.js category files, ready to
   drop into this new project's data/ folder before uploading to GitHub.

   How to use:
   1. Open the OLD site in your browser (the tab where you uploaded
      photos through admin/sub-admin before).
   2. Press F12 (or right-click → Inspect) to open Developer Tools,
      click the "Console" tab.
   3. Paste this entire script in and press Enter.
   4. It will download up to 5 files (one per category that had
      photos). Move them into this new project's data/ folder,
      overwriting the empty placeholders.
------------------------------------------------------------------- */
(function () {
  const CATS = [
    { key: 'typography', varName: 'TYPOGRAPHY_PHOTOS', path: 'typography.js', label: 'Typography', count: 20 },
    { key: 'retro', varName: 'RETRO_PHOTOS', path: 'retro-graphics.js', label: 'Retro Graphics', count: 20 },
    { key: 'popculture', varName: 'POPCULTURE_PHOTOS', path: 'pop-culture.js', label: 'Pop Culture & Fandom', count: 20 },
    { key: 'nature', varName: 'NATURE_PHOTOS', path: 'nature.js', label: 'Nature', count: 20 },
    { key: 'humor', varName: 'HUMOR_PHOTOS', path: 'humor.js', label: 'Humor', count: 20 },
  ];
  const raw = localStorage.getItem('vintageHubPhotos');
  if (!raw) { console.log('No saved photos found on this page — nothing to migrate.'); return; }
  let data;
  try { data = JSON.parse(raw); } catch (e) { console.log('Could not read saved photos.'); return; }

  let downloaded = 0;
  CATS.forEach(cat => {
    const arr = Array.isArray(data[cat.key]) ? data[cat.key] : [];
    if (!arr.some(Boolean)) return; // nothing uploaded in this category — skip
    const padded = arr.slice(0, cat.count);
    while (padded.length < cat.count) padded.push(null);
    const lines = padded.map(slot => {
      if (!slot) return '  null,';
      return `  {src:${JSON.stringify(slot.src)}, number:${JSON.stringify(slot.number || null)}, updated:${JSON.stringify(slot.updated || null)}},`;
    });
    const content = `// ${cat.varName}: ${cat.label} category, ${cat.count} photo slots. Each slot is null (empty) or {src, number, updated} once filled.\n` +
      `const ${cat.varName} = [\n${lines.join('\n')}\n];\n`;
    const blob = new Blob([content], { type: 'text/javascript' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = cat.path;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    downloaded++;
  });
  console.log(downloaded
    ? `Downloaded ${downloaded} category file(s). Move them into data/ in the new project.`
    : 'Found saved data, but no categories had any photos in them.');
})();
