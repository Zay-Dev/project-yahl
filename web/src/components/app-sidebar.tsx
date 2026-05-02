import type { ComponentProps } from "react";
import { Activity, ListChecks, PlayCircle } from "lucide-react";

import { NavMain } from "@/components/nav-main";
import { NavRecentSessions } from "@/components/nav-recent-sessions";
import { NavUser } from "@/components/nav-user";
import { TeamSwitcher } from "@/components/team-switcher";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
} from "@/components/ui/sidebar";

const navMain = [
  {
    icon: PlayCircle,
    title: "Runner",
    to: "/runner",
  },
  {
    icon: ListChecks,
    title: "Sessions",
    to: "/sessions",
  },
];

const brand = {
  name: "Project Yahl",
  plan: "Local runtime",
  icon: Activity,
};

const user = {
  name: "yahl",
  email: "local",
  avatar: "",
};

export const AppSidebar = (props: ComponentProps<typeof Sidebar>) => (
  <Sidebar collapsible="icon" {...props}>
    <SidebarHeader>
      <TeamSwitcher brand={brand} />
    </SidebarHeader>

    <SidebarContent>
      <NavMain items={navMain} />
      <NavRecentSessions />
    </SidebarContent>

    <SidebarFooter>
      <NavUser user={user} />
    </SidebarFooter>

    <SidebarRail />
  </Sidebar>
);
