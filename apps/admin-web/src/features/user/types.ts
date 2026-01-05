export interface User {
  id: number;
  email: string;
  name?: string | null;
  status: "ACTIVE" | "DISABLED" | "PENDING";
  createdAt: string;
  updatedAt: string;
}

export interface UserListResponse {
  data: User[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export interface UserRole {
  id: number;
  code: string;
  name: string;
  description?: string | null;
  isEnabled: boolean;
}

export interface UserRolesResponse {
  data: UserRole[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}
