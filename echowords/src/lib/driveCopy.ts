// A complete copy of the library (words, folders AND recordings) kept in a file in the
// family's own Google Drive, chosen once with Android's «save to» screen. After every
// change the app rewrites that file by itself. After reinstalling the app, «بازیابی از
// گوگل درایو» reads it back and syncing continues to the same file.
import { buildBackup, restoreBackup } from './backup';
import { type CloudInfo, nativeCloudLink, nativeCloudOpen, nativeCloudStatus, nativeCloudUnlink, nativeCloudWrite, nativeHasCloud } from './native';

export const DRIVE_FILE_NAME = 'AMIR-ABC-ganjineh-sedaye-man.json';
const LAST_SYNC = 'echowords-drive-last-sync';

export const driveAvailable = (): boolean => nativeHasCloud();
export const driveStatus = (): CloudInfo => (driveAvailable() ? nativeCloudStatus() : { linked: false });
export const isGoogleDrive = (authority?: string): boolean => !!authority && /com\.google\.android\.apps\.docs/.test(authority);

export function lastDriveSync(): string | null {
  try {
    return localStorage.getItem(LAST_SYNC);
  } catch {
    return null;
  }
}

function markSynced(): void {
  try {
    localStorage.setItem(LAST_SYNC, new Date().toISOString());
  } catch {
    /* ignore */
  }
}

export class DriveError extends Error {
  constructor(public code: string, detail?: string) {
    super(detail ?? code);
  }
}

/** Choose the place (Google Drive) and save everything there right away. */
export async function linkDrive(): Promise<CloudInfo> {
  const r = await nativeCloudLink(DRIVE_FILE_NAME, await buildBackup());
  if (!r.ok) throw new DriveError(r.error, r.detail);
  if (!r.linked) throw new DriveError('read-only', 'this place does not allow saving changes');
  markSynced();
  return { linked: true, name: r.name, authority: r.authority };
}

/** Pick the copy (e.g. after reinstalling) and bring everything back. */
export async function restoreFromDrive(): Promise<{ added: number; skipped: number; info: CloudInfo }> {
  const r = await nativeCloudOpen();
  if (!r.ok) throw new DriveError(r.error, r.detail);
  const bin = atob(r.b64 ?? '');
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  const res = await restoreBackup(new Blob([bytes], { type: 'application/json' }));
  if (r.linked) await syncDriveNow(); // the copy now also holds anything that was only on this device
  return { ...res, info: { linked: r.linked, name: r.name, authority: r.authority } };
}

/** Rewrite the linked copy with the current library. */
export async function syncDriveNow(): Promise<void> {
  if (!driveStatus().linked) return;
  const r = await nativeCloudWrite(await buildBackup());
  if (!r.ok) throw new DriveError(r.error ?? 'io', r.detail);
  markSynced();
}

export function unlinkDrive(): void {
  nativeCloudUnlink();
  try {
    localStorage.removeItem(LAST_SYNC);
  } catch {
    /* ignore */
  }
}
