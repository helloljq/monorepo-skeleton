export interface User {
  /** Public ID (UUID) */
  id: string;
  email: string;
  name?: string | null;
  status: "ACTIVE" | "DISABLED" | "PENDING";
  createdAt: string;
  updatedAt: string;
  avatar?: string | null;
  roleCount?: number;
}

export interface UserListResponse {
  items: User[];
  pagination: {
    total: number;
    page: number;
    pageSize: number;
  };
}

export interface UserRole {
  role: {
    /** Public ID (UUID) */
    id: string;
    code: string;
    name: string;
    type: "SYSTEM" | "CUSTOM";
    isEnabled: boolean;
  };
  grantedAt: string;
  expiresAt: string | null;
  grantedBy: { id: string; name: string | null } | null;
}

export interface UserRolesResponse {
  items: UserRole[];
  pagination: {
    total: number;
    page: number;
    pageSize: number;
  };
}
