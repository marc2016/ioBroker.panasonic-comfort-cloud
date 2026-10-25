import axios from 'axios';
import { AppType } from 'panasonic-comfort-cloud-client';

const APP_STORE_LOOKUP_URL = 'https://itunes.apple.com/lookup?id=1348640525';
const PLAY_STORE_URL = 'https://play.google.com/store/apps/details?id=com.panasonic.ACCsmart&hl=en&gl=US';
const LOOKUP_TIMEOUT_MS = 10000;
const VERSION_PATTERN = /^\d+\.\d+\.\d+$/;

/** A version/platform pair to log in with. */
export interface AppVersionCandidate {
    /** undefined = built-in default version of the client library */
    version: string | undefined;
    /** platform the version belongs to (X-APP-TYPE) */
    appType: AppType;
}

/** Inputs for {@link buildCandidates}. */
export interface CandidateOptions {
    /** automatic version detection (stores) enabled */
    automatic: boolean;
    /** manually configured app version */
    manualVersion?: string;
    /** platform of the manual version */
    manualAppType?: AppType;
    /** version read from Google Play */
    playStoreVersion?: string;
    /** version read from the iOS App Store */
    appStoreVersion?: string;
}

function validVersion(version: unknown): string | undefined {
    if (typeof version !== 'string') {
        return undefined;
    }
    const trimmed = version.trim();
    return VERSION_PATTERN.test(trimmed) ? trimmed : undefined;
}

/**
 * Human readable platform name for logs.
 *
 * @param appType platform
 */
export function platformName(appType: AppType): string {
    return appType === AppType.IOS ? 'iOS' : 'Android';
}

/**
 * Extracts the current app version from the Google Play details page.
 *
 * @param html page content
 */
export function parsePlayStoreVersion(html: string): string | undefined {
    const match = /\[\[\["(\d+\.\d+\.\d+)"\]\]/.exec(html);
    return validVersion(match?.[1]);
}

/** Current version of the iOS app, undefined if it cannot be read. */
export async function getAppStoreVersion(): Promise<string | undefined> {
    try {
        const response = await axios.get(APP_STORE_LOOKUP_URL, { timeout: LOOKUP_TIMEOUT_MS });
        return validVersion(response.data?.results?.[0]?.version);
    } catch {
        return undefined;
    }
}

/** Current version of the Android app, undefined if it cannot be read. */
export async function getPlayStoreVersion(): Promise<string | undefined> {
    try {
        const response = await axios.get(PLAY_STORE_URL, {
            timeout: LOOKUP_TIMEOUT_MS,
            responseType: 'text',
            headers: { 'User-Agent': 'Mozilla/5.0' },
        });
        return typeof response.data === 'string' ? parsePlayStoreVersion(response.data) : undefined;
    } catch {
        return undefined;
    }
}

/**
 * Ordered list of (version, platform) pairs to try for the login.
 * Manual mode returns exactly one pair; automatic mode tries Google Play (Android),
 * the App Store (iOS) and finally the library default (Android).
 *
 * @param options configured mode and the versions read from the stores
 */
export function buildCandidates(options: CandidateOptions): AppVersionCandidate[] {
    if (!options.automatic) {
        const manualVersion = options.manualVersion?.trim();
        // the library default is an Android version, so it is never combined with iOS
        return manualVersion
            ? [{ version: manualVersion, appType: options.manualAppType ?? AppType.ANDROID }]
            : [{ version: undefined, appType: AppType.ANDROID }];
    }

    const candidates: AppVersionCandidate[] = [];
    const add = (version: string | undefined, appType: AppType): void => {
        if (!candidates.some(c => c.version === version && c.appType === appType)) {
            candidates.push({ version, appType });
        }
    };
    const playStoreVersion = validVersion(options.playStoreVersion);
    const appStoreVersion = validVersion(options.appStoreVersion);
    if (playStoreVersion) {
        add(playStoreVersion, AppType.ANDROID);
    }
    if (appStoreVersion) {
        add(appStoreVersion, AppType.IOS);
    }
    add(undefined, AppType.ANDROID);
    return candidates;
}
