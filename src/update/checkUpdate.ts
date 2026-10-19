import Constants from 'expo-constants';

import { isNewer } from './version';

const REPO = 'yuxizhang11/hitster-app';
export const RELEASES_URL = `https://github.com/${REPO}/releases`;

export type UpdateInfo = {
  current: string;
  latest: string;
  available: boolean;
  /** Direkter Download-Link der APK. */
  apkUrl: string | null;
  pageUrl: string;
  notes: string;
};

export class UpdateError extends Error {}

/** Version dieser App, z. B. "0.2.0". Kommt beim Bauen aus dem Release-Tag. */
export function currentVersion(): string {
  return Constants.expoConfig?.version ?? '0.0.0';
}

type Release = { tag_name: string; html_url: string; body?: string; assets: { name: string; browser_download_url: string }[] };

/** Fragt die neueste Release auf GitHub ab. */
export async function checkForUpdate(): Promise<UpdateInfo> {
  let res: Response;
  try {
    res = await fetch(`https://api.github.com/repos/${REPO}/releases/latest`, {
      headers: { Accept: 'application/vnd.github+json' },
    });
  } catch {
    throw new UpdateError('Keine Internetverbindung.');
  }
  if (res.status === 404) throw new UpdateError('Keine Release gefunden. Ist das GitHub-Repo öffentlich?');
  if (!res.ok) throw new UpdateError(`GitHub antwortet gerade nicht (${res.status}). Später nochmal versuchen.`);
  const release = (await res.json()) as Release;
  const current = currentVersion();
  const latest = release.tag_name.replace(/^v/, '');
  const apk = release.assets.find((a) => a.name.endsWith('.apk'));
  return {
    current,
    latest,
    available: isNewer(latest, current),
    apkUrl: apk?.browser_download_url ?? null,
    pageUrl: release.html_url,
    notes: release.body?.trim() ?? '',
  };
}
