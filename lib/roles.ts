export type Role = {
  key: string;
  label: string;
  slots: number;
  color: string;
  soft: string;
};

export const ROLES: Role[] = [
  { key: "BAR", label: "BAR", slots: 6, color: "#4f6ef7", soft: "#eef2ff" },
  { key: "KEL", label: "KEL", slots: 4, color: "#0d9f6e", soft: "#e7f8f2" },
  { key: "BAK", label: "BAK", slots: 4, color: "#e07a0f", soft: "#fff4e6" },
  { key: "PROMO", label: "PROMO", slots: 1, color: "#c026d3", soft: "#fdf0ff" },
];

export const ROLE_BY_KEY = new Map(ROLES.map((role) => [role.key, role]));

export const TOTAL_SLOTS = ROLES.reduce((sum, role) => sum + role.slots, 0);

export function roleFor(key: string): Role | undefined {
  return ROLE_BY_KEY.get(key);
}
