import { File, Paths } from 'expo-file-system';
import { getContentUriAsync } from 'expo-file-system/legacy';
import { startActivityAsync } from 'expo-intent-launcher';

const FLAG_GRANT_READ_URI_PERMISSION = 1;
const APK_MIME = 'application/vnd.android.package-archive';

/**
 * Lädt die APK in den Cache der App und öffnet direkt den Android-Installationsdialog.
 * Beim ersten Mal fragt Android einmalig, ob Hitster Apps installieren darf.
 */
export async function downloadAndInstall(url: string, version: string, onProgress: (fraction: number) => void) {
  const target = new File(Paths.cache, `hitster-${version}.apk`);
  if (target.exists) target.delete();
  const task = File.createDownloadTask(url, target, {
    onProgress: ({ bytesWritten, totalBytes }) => {
      if (totalBytes > 0) onProgress(bytesWritten / totalBytes);
    },
  });
  const file = await task.downloadAsync();
  if (!file) throw new Error('Download abgebrochen.');
  onProgress(1);
  const contentUri = await getContentUriAsync(file.uri);
  await startActivityAsync('android.intent.action.VIEW', {
    data: contentUri,
    type: APK_MIME,
    flags: FLAG_GRANT_READ_URI_PERMISSION,
  });
}
