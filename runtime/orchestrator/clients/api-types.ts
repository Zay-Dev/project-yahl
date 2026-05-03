export interface OneCliContainerConfig {
  caCertificate?: string;
  caCertificateContainerPath?: string;
  env?: Record<string, unknown>;
}

export interface OneCliDashboardClient {
  getContainerConfig(): Promise<OneCliContainerConfig | null | undefined>;
}
