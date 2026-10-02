import { Permission } from '@rinseops/shared';
import {
  BarChart3,
  Boxes,
  CreditCard,
  LayoutDashboard,
  ListOrdered,
  type LucideIcon,
  PlusCircle,
  Settings,
  Shirt,
  Tags,
  Truck,
  UserCog,
  Users,
} from 'lucide-react';

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Shown when the user has any of these permissions. */
  anyOf: Permission[];
  /** Hidden when the user has this permission (e.g. driver-only entries). */
  hideIf?: Permission;
  shortcut?: string;
}

export const NAV_ITEMS: NavItem[] = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, anyOf: [Permission.DASHBOARD_VIEW] },
  { href: '/orders/new', label: 'New Order', icon: PlusCircle, anyOf: [Permission.ORDERS_CREATE], shortcut: 'N' },
  { href: '/orders', label: 'Orders', icon: ListOrdered, anyOf: [Permission.ORDERS_VIEW] },
  { href: '/customers', label: 'Customers', icon: Users, anyOf: [Permission.CUSTOMERS_VIEW] },
  { href: '/garments', label: 'Garments', icon: Shirt, anyOf: [Permission.GARMENTS_VIEW] },
  { href: '/tasks', label: 'Pickups & Deliveries', icon: Truck, anyOf: [Permission.TASKS_VIEW_ALL] },
  { href: '/driver', label: 'My Tasks', icon: Truck, anyOf: [Permission.TASKS_VIEW_OWN], hideIf: Permission.TASKS_VIEW_ALL },
  { href: '/racks', label: 'Racks', icon: Boxes, anyOf: [Permission.RACKS_VIEW] },
  { href: '/payments', label: 'Payments', icon: CreditCard, anyOf: [Permission.PAYMENTS_VIEW] },
  { href: '/catalog', label: 'Services & Pricing', icon: Tags, anyOf: [Permission.CATALOG_VIEW] },
  { href: '/reports', label: 'Reports', icon: BarChart3, anyOf: [Permission.REPORTS_VIEW] },
  { href: '/staff', label: 'Staff', icon: UserCog, anyOf: [Permission.STAFF_VIEW] },
  {
    href: '/settings',
    label: 'Settings',
    icon: Settings,
    anyOf: [Permission.SETTINGS_MANAGE, Permission.STORES_MANAGE, Permission.AUDIT_VIEW],
  },
];

export function visibleNav(can: (p: Permission) => boolean): NavItem[] {
  return NAV_ITEMS.filter((item) => item.anyOf.some(can) && !(item.hideIf && can(item.hideIf)));
}

/** Longest matching nav entry for the current path. */
export function activeHref(pathname: string, items: NavItem[]): string | undefined {
  return items.filter((i) => pathname === i.href || pathname.startsWith(`${i.href}/`)).sort((a, b) => b.href.length - a.href.length)[0]
    ?.href;
}
