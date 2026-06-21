export type LicenseType = 'AYLIK' | 'YILLIK' | 'OZEL';

export interface LicenseKeyData {
  id: string;     // Machine ID
  exp: string;    // Expiration date formatted as YYYY-MM-DD
  type: LicenseType; // Package type name
}

export interface StoredLicense {
  id: string;       // Unique ID inside history
  machineId: string;
  expiresAt: string;
  type: LicenseType;
  licenseKey: string;
  createdAt: string; // ISO string when key was generated
}
