import { useList } from "@refinedev/core";
import { Outlet, useLocation } from "react-router";

import type { TResponseSessionListItem } from "@project-yahl/server/modules/sessions/-api-types";

import { AppSidebar } from "@/components/app-sidebar";
import { WhatsAppStatusBanner } from "@/components/whatsapp-status-banner";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Separator } from "@/components/ui/separator";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { useStreamStatus } from "@/hooks/use-stream-status";
import { RESOURCES } from "@/providers/constants";

const toTitle = (pathname: string) => {
  const path = pathname.split("/").filter(Boolean);
  if (path.length === 0) {
    return "Dashboard";
  }

  if (path[0] === "sessions" && path[1]) {
    return path[1];
  }

  return path[0].slice(0, 1).toUpperCase() + path[0].slice(1);
};

export function AppLayout() {
  const location = useLocation();
  const streamStatus = useStreamStatus();

  const { result } = useList<TResponseSessionListItem>({
    pagination: { currentPage: 1, mode: "client", pageSize: 100 },
    queryOptions: {
      placeholderData: { data: [], total: 0 },
    },
    resource: RESOURCES.sessions,
  });

  const sessions = result.data ?? [];

  return (
    <SidebarProvider>
      <AppSidebar sessions={sessions} />
      <SidebarInset>
        <WhatsAppStatusBanner />
        <header className="flex h-16 shrink-0 items-center gap-2 transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12">
          <div className="flex items-center gap-2 px-4">
            <SidebarTrigger className="-ml-1" />
            <Separator
              orientation="vertical"
              className="mr-2 data-[orientation=vertical]:h-4"
            />
            <Breadcrumb>
              <BreadcrumbList>
                <BreadcrumbItem className="hidden md:block">
                  <BreadcrumbPage>Project YAHL</BreadcrumbPage>
                </BreadcrumbItem>
                <BreadcrumbSeparator className="hidden md:block" />
                <BreadcrumbItem>
                  <BreadcrumbPage>{toTitle(location.pathname)}</BreadcrumbPage>
                </BreadcrumbItem>
                <BreadcrumbSeparator className="hidden md:block" />
                <BreadcrumbItem>
                  <BreadcrumbPage>{streamStatus}</BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
          </div>
        </header>
        <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
          <Outlet />
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
