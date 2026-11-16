// Module × action permission model. Shared by server checks and the role editor.

export const MODULES = [
  { key: "members", gu: "સભ્યો અને ડિરેક્ટરી", en: "Members & directory", ready: true },
  { key: "messages", gu: "મેસેજ", en: "Messages", ready: false },
  { key: "donations", gu: "દાન રસીદ", en: "Donation receipts", ready: true },
  { key: "bookings", gu: "વાડી બુકિંગ અને બિલ", en: "Wadi booking & bills", ready: true },
  { key: "accounts", gu: "હિસાબ અને રિપોર્ટ", en: "Accounts & reports", ready: true },
  { key: "inventory", gu: "ઇન્વેન્ટરી", en: "Inventory", ready: true },
  { key: "users", gu: "યુઝર્સ અને રોલ", en: "Users & roles", ready: true },
] as const;

export const ACTIONS = [
  { key: "view", gu: "જુઓ", en: "View" },
  { key: "create", gu: "બનાવો", en: "Create" },
  { key: "edit", gu: "સુધારો", en: "Edit" },
  { key: "cancel", gu: "રદ / બંધ", en: "Cancel" },
] as const;

export type ModuleKey = (typeof MODULES)[number]["key"];
export type ActionKey = (typeof ACTIONS)[number]["key"];
export type PermissionMap = Partial<Record<ModuleKey, ActionKey[]>>;

export type RoleLike = { isSuperAdmin: boolean; permissions: unknown };

export function can(role: RoleLike, module: ModuleKey, action: ActionKey): boolean {
  if (role.isSuperAdmin) return true;
  const perms = (role.permissions ?? {}) as PermissionMap;
  return perms[module]?.includes(action) ?? false;
}

/** The audit log is readable only by a super admin, by design. */
export function canReadAudit(role: RoleLike) {
  return role.isSuperAdmin;
}

export function sanitizePermissions(input: unknown): PermissionMap {
  const out: PermissionMap = {};
  if (!input || typeof input !== "object") return out;
  const moduleKeys = MODULES.map((m) => m.key) as string[];
  const actionKeys = ACTIONS.map((a) => a.key) as string[];
  for (const [m, actions] of Object.entries(input as Record<string, unknown>)) {
    if (!moduleKeys.includes(m) || !Array.isArray(actions)) continue;
    const clean = actions.filter((a): a is ActionKey => typeof a === "string" && actionKeys.includes(a));
    if (clean.length) out[m as ModuleKey] = Array.from(new Set(clean));
  }
  return out;
}

// Starting roles from the plan. The Super Admin can change any of these later.
export const DEFAULT_ROLES: {
  key: string;
  nameGu: string;
  nameEn: string;
  isSuperAdmin?: boolean;
  permissions: PermissionMap;
}[] = [
  { key: "super_admin", nameGu: "સુપર એડમિન", nameEn: "Super Admin", isSuperAdmin: true, permissions: {} },
  {
    key: "trustee",
    nameGu: "ટ્રસ્ટી",
    nameEn: "Trustee",
    permissions: {
      members: ["view", "create", "edit", "cancel"],
      messages: ["view", "create", "edit", "cancel"],
      donations: ["view"],
      bookings: ["view"],
      accounts: ["view"],
      inventory: ["view"],
    },
  },
  {
    key: "accountant",
    nameGu: "હિસાબનીશ",
    nameEn: "Accountant",
    permissions: {
      members: ["view"],
      donations: ["view", "create", "edit"],
      bookings: ["view"],
      accounts: ["view", "create", "edit"],
      inventory: ["view"],
    },
  },
  {
    key: "receipt_clerk",
    nameGu: "રસીદ ક્લાર્ક",
    nameEn: "Receipt clerk",
    permissions: { members: ["view", "create"], donations: ["view", "create"] },
  },
  {
    key: "wadi_manager",
    nameGu: "વાડી મેનેજર",
    nameEn: "Wadi manager",
    permissions: {
      members: ["view"],
      bookings: ["view", "create", "edit"],
      inventory: ["view", "create", "edit"],
    },
  },
  {
    key: "store_keeper",
    nameGu: "સ્ટોર કીપર",
    nameEn: "Store keeper",
    permissions: { bookings: ["view"], inventory: ["view", "create", "edit", "cancel"] },
  },
];
