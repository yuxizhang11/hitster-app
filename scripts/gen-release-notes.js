// Bettet RELEASE_NOTES.txt in die App ein, damit Neuerungen auch ohne Internet angezeigt werden.
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const text = fs.readFileSync(path.join(root, 'RELEASE_NOTES.txt'), 'utf8');
fs.writeFileSync(
  path.join(root, 'src/update/releaseNotes.generated.ts'),
  `// Erzeugt aus RELEASE_NOTES.txt durch scripts/gen-release-notes.js.\nexport const RELEASE_NOTES_TEXT = ${JSON.stringify(text)};\n`,
);
