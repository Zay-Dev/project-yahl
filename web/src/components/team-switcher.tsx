import type { LucideIcon } from "lucide-react";

import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";

type Brand = {
  icon: LucideIcon;
  name: string;
  plan: string;
};

export const TeamSwitcher = ({ brand }: { brand: Brand }) => {
  const Icon = brand.icon;

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <SidebarMenuButton size="lg" tooltip={brand.name}>
          <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
            <Icon className="size-4" />
          </div>

          <div className="grid flex-1 text-left text-sm leading-tight">
            <span className="truncate font-semibold">{brand.name}</span>
            <span className="truncate text-xs text-slate-500 dark:text-slate-400">{brand.plan}</span>
          </div>
        </SidebarMenuButton>
      </SidebarMenuItem>
    </SidebarMenu>
  );
};
