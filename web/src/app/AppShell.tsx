import { Fragment } from "react";
import { Link, Outlet, useLocation, useParams } from "react-router-dom";

import { RunnerProvider } from "@/app/RunnerContext";
import { AppSidebar } from "@/components/app-sidebar";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
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

type Crumb = { href?: string; label: string };

const buildCrumbs = (pathname: string, sessionId: string | undefined): Crumb[] => {
  if (pathname.startsWith("/runner")) {
    return [{ label: "Runner" }];
  }

  if (pathname.startsWith("/sessions")) {
    if (sessionId) {
      return [
        { href: "/sessions", label: "Sessions" },
        { label: sessionId.slice(0, 8) },
      ];
    }

    return [{ label: "Sessions" }];
  }

  return [{ label: "Home" }];
};

export const AppShell = () => {
  const location = useLocation();
  const params = useParams<{ sessionId?: string }>();

  const crumbs = buildCrumbs(location.pathname, params.sessionId);

  return (
    <SidebarProvider>
      <RunnerProvider>
        <AppSidebar />

        <SidebarInset>
          <header className="flex h-14 shrink-0 items-center gap-2 border-b px-4">
            <SidebarTrigger className="-ml-1" />
            <Separator orientation="vertical" className="mr-2 data-[orientation=vertical]:h-4" />

            <Breadcrumb>
              <BreadcrumbList>
                <BreadcrumbItem className="hidden md:block">
                  <BreadcrumbLink asChild>
                    <Link to="/">Project Yahl</Link>
                  </BreadcrumbLink>
                </BreadcrumbItem>

                {crumbs.map((crumb, index) => {
                  const isLast = index === crumbs.length - 1;

                  return (
                    <Fragment key={`${crumb.label}-${index}`}>
                      <BreadcrumbSeparator className="hidden md:block" />
                      <BreadcrumbItem>
                        {isLast || !crumb.href ? (
                          <BreadcrumbPage>{crumb.label}</BreadcrumbPage>
                        ) : (
                          <BreadcrumbLink asChild>
                            <Link to={crumb.href}>{crumb.label}</Link>
                          </BreadcrumbLink>
                        )}
                      </BreadcrumbItem>
                    </Fragment>
                  );
                })}
              </BreadcrumbList>
            </Breadcrumb>
          </header>

          <div className="flex flex-1 flex-col gap-4 p-4 pt-4">
            <Outlet />
          </div>
        </SidebarInset>
      </RunnerProvider>
    </SidebarProvider>
  );
};
