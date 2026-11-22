/* eslint-disable @typescript-eslint/indent */
// This file extends the AdapterConfig type from "@types/iobroker"

// Augment the globally declared type ioBroker.AdapterConfig
declare global {
	// eslint-disable-next-line @typescript-eslint/no-namespace
	namespace ioBroker {
			interface AdapterConfig {
					// Define the shape of your options here (recommended)
					username: string;
					password: string;
					refreshInterval: number;
					/** Legacy key written by older admin configs, migrated to refreshInterval on start */
					pollinterval?: number | null;
					automaticRefreshEnabled: boolean;
					appVersion: string;
					appVersionFromAppStore: string;
					appVersionFromPlayStore: string;
					appType: 'android' | 'ios';
					useAppVersionFromAppStore: boolean;
					historyEnabled: boolean;
			}
	}
}

// this is required so the above AdapterConfig is found by TypeScript / type checking
export {};