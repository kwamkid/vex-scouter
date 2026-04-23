import {
  BarChart3,
  Calendar,
  ListPlus,
  User,
  type LucideIcon,
} from "lucide-react";

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  /**
   * Additional route prefixes that should mark this item as active.
   * Example: "/scout" is active on "/events/[id]" too.
   */
  activeFor?: string[];
};

export const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "Rankings", icon: BarChart3 },
  { href: "/scout", label: "Events", icon: Calendar, activeFor: ["/events"] },
  { href: "/profile", label: "My Team", icon: User },
  { href: "/manual", label: "Manual", icon: ListPlus, activeFor: ["/compare"] },
];

export function isNavItemActive(item: NavItem, pathname: string): boolean {
  if (item.href === "/") return pathname === "/";
  if (pathname === item.href || pathname.startsWith(`${item.href}/`)) {
    return true;
  }
  return (item.activeFor ?? []).some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );
}

export const APP_NAME = "VEX Worlds Match Scout";
export const APP_TAGLINE = "Skills ranking from scouted data";
