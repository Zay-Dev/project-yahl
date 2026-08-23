"use client"

import * as React from "react"

import type { TResponseSessionListItem } from "@project-yahl/server/modules/sessions/-api-types"

import { NavMain } from "@/components/nav-main"
import { NavProjects } from "@/components/nav-projects"
import { NavUser } from "@/components/nav-user"
import { TeamSwitcher } from "@/components/team-switcher"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
} from "@/components/ui/sidebar"
import { ActivityIcon, BookOpenIcon, ClockIcon, FolderOpenIcon, GalleryVerticalEndIcon, HeartPulseIcon, LayoutDashboardIcon, ListIcon, ListTodoIcon, RefreshCwIcon } from "lucide-react"

import { WIKI_PUBLIC_URL, CODE_SERVER_PUBLIC_URL } from "@/providers/constants"

const data = {
  user: {
    name: "Zay Lau",
    email: "license@omniflex.io",
    avatar: "/avatars/shadcn.jpg",
  },
  teams: [
    {
      name: "Acme Inc",
      logo: (
        <GalleryVerticalEndIcon
        />
      ),
      plan: "Enterprise",
    },
    {
      name: "Acme Corp.",
      logo: (
        <ActivityIcon
        />
      ),
      plan: "Startup",
    },
    {
      name: "Evil Corp.",
      logo: (
        <HeartPulseIcon
        />
      ),
      plan: "Free",
    },
  ],
}

type TAppSidebarProps = React.ComponentProps<typeof Sidebar> & {
  sessions: TResponseSessionListItem[]
}

export function AppSidebar({ sessions, ...props }: TAppSidebarProps) {
  const navMain = [
    {
      title: "Dashboard",
      url: "/dashboard",
      icon: (
        <LayoutDashboardIcon
        />
      ),
    },
    {
      title: "Tasks",
      url: "/tasks",
      icon: (
        <ListTodoIcon
        />
      ),
    },
    {
      title: "Sessions",
      url: "/sessions",
      icon: (
        <ListIcon
        />
      ),
    },
    {
      title: "Health",
      url: "/health",
      icon: (
        <HeartPulseIcon
        />
      ),
    },
    {
      title: "Approvals",
      url: "/platform/approvals",
      icon: (
        <ActivityIcon
        />
      ),
    },
    {
      title: "Channels",
      url: "/platform/channels",
      icon: (
        <ActivityIcon
        />
      ),
    },
    {
      title: "Cron jobs",
      url: "/platform/cron-jobs",
      icon: (
        <ClockIcon
        />
      ),
    },
    {
      title: "Knowledge",
      external: true,
      url: `${WIKI_PUBLIC_URL}/`,
      icon: (
        <BookOpenIcon
        />
      ),
    },
    {
      title: "Files",
      external: true,
      url: `${CODE_SERVER_PUBLIC_URL}/`,
      icon: (
        <FolderOpenIcon
        />
      ),
    },
    {
      title: "Knowledge Manager",
      url: "/platform/knowledge-policies",
      icon: (
        <RefreshCwIcon
        />
      ),
    },
  ]

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <TeamSwitcher teams={data.teams} />
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={navMain} />
        <NavProjects sessions={sessions} />
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={data.user} />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
