const { withDangerousMod } = require('expo/config-plugins');
const fs = require('fs');
const path = require('path');

// WorkManager (für die Update-Prüfung im Hintergrund) sucht seine Datenbank per Klassenname. R8 benennt sie im
// Release-Build sonst um, und die App stürzt schon beim Start ab.
const RULES = `
# Hitster: WorkManager/Room
-keep class androidx.work.impl.WorkDatabase { *; }
-keep class androidx.work.impl.WorkDatabase_Impl { *; }
-keep class * extends androidx.room.RoomDatabase { *; }
`;

module.exports = function withProguardKeep(config) {
  return withDangerousMod(config, [
    'android',
    (c) => {
      const file = path.join(c.modRequest.platformProjectRoot, 'app', 'proguard-rules.pro');
      const current = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
      if (!current.includes('Hitster: WorkManager')) fs.writeFileSync(file, current + RULES);
      return c;
    },
  ]);
};
