import type { LucideIcon } from "lucide-react";
import { NavLink, useLocation } from "react-router-dom";

import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";

type NavMainItem = {
  icon: LucideIcon;
  title: string;
  to: string;
};

const isPathActive = (pathname: string, to: string) =>
  pathname === to || pathname.startsWith(`${to}/`);

export const NavMain = ({ items }: { items: NavMainItem[] }) => {
  const location = useLocation();

  return (
    <SidebarGroup>
      <SidebarGroupLabel>Platform</SidebarGroupLabel>
      <SidebarMenu>
        {items.map((item) => (
          <SidebarMenuItem key={item.title}>
            <SidebarMenuButton
              asChild
              isActive={isPathActive(location.pathname, item.to)}
              tooltip={item.title}
            >
              <NavLink to={item.to}>
                <item.icon />
                <span>{item.title}</span>
              </NavLink>
            </SidebarMenuButton>
          </SidebarMenuItem>
        ))}
      </SidebarMenu>
    </SidebarGroup>
  );
};
