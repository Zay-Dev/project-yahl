import { Cpu } from "lucide-react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";

type SidebarUser = {
  avatar: string;
  email: string;
  name: string;
};

export const NavUser = ({ user }: { user: SidebarUser }) => (
  <SidebarMenu>
    <SidebarMenuItem>
      <SidebarMenuButton size="lg" tooltip={user.name}>
        <Avatar className="size-8 rounded-lg">
          <AvatarFallback className="rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
            <Cpu className="size-4" />
          </AvatarFallback>
        </Avatar>

        <div className="grid flex-1 text-left text-sm leading-tight">
          <span className="truncate font-medium">{user.name}</span>
          <span className="truncate text-xs text-slate-500 dark:text-slate-400">{user.email}</span>
        </div>
      </SidebarMenuButton>
    </SidebarMenuItem>
  </SidebarMenu>
);
