import { Activity, CheckCircle2 } from "lucide-react";
import { NavLink, useParams } from "react-router-dom";

import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { useSessions } from "@/hooks/useSessions";

const RECENT_LIMIT = 10;

export const NavRecentSessions = () => {
  const params = useParams<{ sessionId?: string }>();
  const { loading, sessions } = useSessions();

  const recent = sessions.slice(0, RECENT_LIMIT);

  return (
    <SidebarGroup className="group-data-[collapsible=icon]:hidden">
      <SidebarGroupLabel>Recent sessions</SidebarGroupLabel>

      <SidebarMenu>
        {loading && !recent.length ? (
          <SidebarMenuItem>
            <SidebarMenuButton className="text-sidebar-foreground/60" disabled>
              <span>Loading...</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        ) : null}

        {!loading && !recent.length ? (
          <SidebarMenuItem>
            <SidebarMenuButton className="text-sidebar-foreground/60" disabled>
              <span>No sessions yet</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        ) : null}

        {recent.map((session) => {
          const Icon = session.finalizedAt ? CheckCircle2 : Activity;
          const isActive = params.sessionId === session.sessionId;

          return (
            <SidebarMenuItem key={session.sessionId}>
              <SidebarMenuButton asChild isActive={isActive} tooltip={session.sessionId}>
                <NavLink to={`/sessions/${session.sessionId}`}>
                  <Icon
                    className={
                      session.finalizedAt
                        ? "text-emerald-500"
                        : "text-amber-500"
                    }
                  />
                  <span className="font-mono text-xs">{session.sessionId.slice(0, 8)}</span>
                </NavLink>
              </SidebarMenuButton>
            </SidebarMenuItem>
          );
        })}
      </SidebarMenu>
    </SidebarGroup>
  );
};
