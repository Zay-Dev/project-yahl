"use client"

import type { TResponseSessionListItem } from "@project-yahl/server/modules/sessions/-api-types"

import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"
import { Clock3Icon } from "lucide-react"
import { NavLink, useLocation } from "react-router"

export function NavProjects({
  sessions,
}: {
  sessions: TResponseSessionListItem[]
}) {
  const location = useLocation()

  return (
    <SidebarGroup className="group-data-[collapsible=icon]:hidden">
      <SidebarGroupLabel>Recent Sessions</SidebarGroupLabel>
      <SidebarMenu>
        {sessions.slice(0, 8).map((session) => (
          <SidebarMenuItem key={session.sessionId}>
            <SidebarMenuButton
              isActive={location.pathname === `/sessions/${encodeURIComponent(session.sessionId)}`}
              render={<NavLink to={`/sessions/${encodeURIComponent(session.sessionId)}`} />}
            >
              <Clock3Icon
              />
              <span>{session.sessionId}</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        ))}
      </SidebarMenu>
    </SidebarGroup>
  )
}
