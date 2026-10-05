/**
 * Reader auto-play preference.
 *
 * One global on/off switch, remembered on this device: turning auto-play ON (or OFF) in any
 * story or episode applies to every story and episode read afterwards, until it is toggled again.
 * Default is OFF.
 */

export const AUTOPLAY_PREF_KEY = 'drive_reader_autoplay';

/** Minimal storage shape so this can be unit-tested without a browser. */
type KV = Pick<Storage, 'getItem' | 'setItem'>;

function store(): KV | null {
  try {
    return typeof localStorage !== 'undefined' ? localStorage : null;
  } catch {
    return null; // storage blocked (private mode etc.) -> behave as "off, not remembered"
  }
}

export function readAutoplayPref(kv: KV | null = store()): boolean {
  try {
    return kv?.getItem(AUTOPLAY_PREF_KEY) === '1';
  } catch {
    return false;
  }
}

export function writeAutoplayPref(on: boolean, kv: KV | null = store()): void {
  try {
    kv?.setItem(AUTOPLAY_PREF_KEY, on ? '1' : '0');
  } catch {
    /* ignore: the toggle still works for this session */
  }
}
