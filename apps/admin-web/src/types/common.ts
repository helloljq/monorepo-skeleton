export interface BaseEntity {
  id: string;
  createdAt: string;
  updatedAt: string;
}

export type Status = "active" | "inactive" | "pending";

export interface Option<T = string> {
  label: string;
  value: T;
}
