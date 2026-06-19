import { Refine } from "@refinedev/core";
import routerProvider from "@refinedev/react-router";

import { BrowserRouter, Navigate, Route, Routes } from "react-router";

import { AppLayout } from "@/layouts/app-layout";
import { DashboardPage } from "@/pages/dashboard";
import { HealthPage } from "@/pages/health";
import { PlatformApprovalsPage } from "@/pages/platform/approvals";
import { SessionDetailPage } from "@/pages/sessions/detail";
import { SessionsPage } from "@/pages/sessions";
import { RESOURCES } from "@/providers/constants";
import { dataProvider } from "@/providers/data-provider";
import { liveProvider } from "@/providers/live-provider";

export function App() {
  return (
    <BrowserRouter>
      <Refine
        dataProvider={dataProvider}
        liveProvider={liveProvider}
        routerProvider={routerProvider}
        resources={[
          {
            list: "/sessions",
            name: RESOURCES.sessions,
            show: "/sessions/:id",
          },
        ]}
        options={{
          disableTelemetry: true,
          liveMode: "auto",
        }}
      >
        <Routes>
          <Route path="/" element={<AppLayout />}>
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="dashboard" element={<DashboardPage />} />
            <Route path="health" element={<HealthPage />} />
            <Route path="sessions" element={<SessionsPage />} />
            <Route path="sessions/:id" element={<SessionDetailPage />} />
            <Route path="platform/approvals" element={<PlatformApprovalsPage />} />
          </Route>
        </Routes>
      </Refine>
    </BrowserRouter>
  );
}

export default App;
