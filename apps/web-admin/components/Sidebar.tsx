"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  ShoppingBag,
  Boxes,
  Users,
  TrendingUp,
  Cpu,
  Receipt,
  Settings,
  CreditCard,
  UserCog,
  ListOrdered,
} from "lucide-react";
import { cn } from "@squarely/ui-web";

export const navItems = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
  { href: "/dashboard/orders", label: "Orders", icon: ShoppingBag },
  { href: "/dashboard/items", label: "Items", icon: ListOrdered },
  { href: "/dashboard/categories", label: "Categories", icon: Boxes },
  { href: "/dashboard/inventory", label: "Inventory", icon: Boxes },
  { href: "/dashboard/customers", label: "Customers", icon: Users },
  { href: "/dashboard/reports", label: "Reports", icon: TrendingUp },
  { href: "/dashboard/devices", label: "Devices", icon: Cpu },
  { href: "/dashboard/team", label: "Team", icon: UserCog },
  { href: "/dashboard/billing", label: "Billing", icon: CreditCard },
  { href: "/dashboard/settings", label: "Settings", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  return (
    <aside className="hidden w-64 shrink-0 border-r border-slate-200 bg-white md:block">
      <div className="px-6 py-5 text-xl font-bold tracking-tight">Squarely</div>
      <nav className="px-3 pb-6">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium",
                active
                  ? "bg-brand-50 text-brand-700"
                  : "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
              )}
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}

export { Receipt };
