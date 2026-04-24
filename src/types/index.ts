// ─── Supabase ─────────────────────────────────────────────────────────────────

export interface SupabaseUser {
  id: string;
  email: string;
  created_at?: string;
  [key: string]: unknown;
}

export interface SupabaseSession {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  expires_at?: number;
  token_type: string;
  user: SupabaseUser;
}

export interface SupabaseResponse<T = unknown> {
  data: T | null;
  error: { message: string } | null;
}

// ─── App Domain ───────────────────────────────────────────────────────────────

export type LangCode = "EN" | "ES" | "FR" | "PT";

export type TierKey = "compact" | "midsize" | "executive" | "luxury";

export interface Tier {
  key: TierKey;
  label: string;
  description: string;
  tokens: number;
}

export interface Profile {
  id: string;
  email: string;
  token_balance: number;
  created_at?: string;
}

export interface Workspace {
  id: string;
  name: string;
  created_by: string;
  token_balance: number;
  created_at?: string;
}

export type WorkspaceRole = "owner" | "co-owner" | "member";

export interface WorkspaceMember {
  id: string;
  workspace_id: string;
  user_id: string;
  role: WorkspaceRole;
  invited_by: string;
}

// ─── Chassis / AI Output ──────────────────────────────────────────────────────

export interface BusinessAbout {
  label: string;
  value: string;
}

export interface BusinessInfo {
  name: string;
  type: string;
  location: string;
  website: string;
  established: string;
  description: string;
  whyChassis: string;
  chassisValue: string[];
  about: BusinessAbout[];
}

export interface ADDISItem {
  name: string;
  description?: string;
  items?: string[];
  [key: string]: unknown;
}

export interface ChassisData {
  business: BusinessInfo;
  ADDIS: Record<string, ADDISItem[]>;
  BLIPS: Record<string, unknown[]>;
  KBRs: Array<{
    title: string;
    description: string;
    metrics?: string[];
    [key: string]: unknown;
  }>;
}

export type BeyondProfitKey = "CSR" | "ESG" | "DEI" | "TBL" | "Sustainability";

export interface BeyondProfitData {
  [key: string]: unknown;
}

// ─── Responsive ───────────────────────────────────────────────────────────────

export interface ResponsiveState {
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
  width: number;
}
