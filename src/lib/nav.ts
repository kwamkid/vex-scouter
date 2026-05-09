import {
  BarChart3,
  Cake,
  Calendar,
  ListPlus,
  Star,
  Trophy,
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

// Primary nav — always visible in the bottom tab bar.
export const PRIMARY_NAV: NavItem[] = [
  { href: "/", label: "Events", icon: Calendar, activeFor: ["/events", "/scout"] },
  { href: "/watching", label: "Favorites", icon: Star },
  { href: "/profile", label: "My Team", icon: User },
];

// More — grouped under a "More" overflow menu in the bottom tab bar.
export const TOOLS_NAV: NavItem[] = [
  { href: "/rankings", label: "Rankings", icon: BarChart3 },
  { href: "/awards", label: "Compare Awards", icon: Trophy },
  { href: "/manual", label: "Manual Compare", icon: ListPlus, activeFor: ["/compare"] },
  { href: "/age-check", label: "Age Check", icon: Cake },
];

export const ALL_NAV: NavItem[] = [...PRIMARY_NAV, ...TOOLS_NAV];

export function isNavItemActive(item: NavItem, pathname: string): boolean {
  if (item.href === "/") return pathname === "/";
  if (pathname === item.href || pathname.startsWith(`${item.href}/`)) {
    return true;
  }
  return (item.activeFor ?? []).some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );
}

export function isAnyActive(items: NavItem[], pathname: string): boolean {
  return items.some((i) => isNavItemActive(i, pathname));
}

export const APP_NAME = "VEX Hub";
export const APP_TAGLINE = "All-in-one toolkit for VEX Robotics teams.";
