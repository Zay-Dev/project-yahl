import { Refine } from "@refinedev/core";
import routerProvider from "@refinedev/react-router";

import { BrowserRouter, Navigate, Route, Routes } from "react-router";

import { AppLayout } from "@/layouts/app-layout";
import { DashboardPage } from "@/pages/dashboard";
import { HealthPage } from "@/pages/health";
import { KnowledgePoliciesPage } from "@/pages/platform/knowledge-policies";
import { PlatformApprovalsPage } from "@/pages/platform/approvals";
import { PlatformChannelsPage } from "@/pages/platform/channels";
import { CronJobsPage } from "@/pages/platform/cron-jobs";
import { CronJobCreatePage } from "@/pages/platform/cron-jobs/create";
import { CronJobEditPage } from "@/pages/platform/cron-jobs/edit";
import { SessionDetailPage } from "@/pages/sessions/detail";
import { PendingQuestionsPage } from "@/pages/sessions/pending-questions";
import { SessionsPage } from "@/pages/sessions";
import { TaskCreatePage } from "@/pages/tasks/create";
import { TaskDetailPage } from "@/pages/tasks/detail";
import { TasksPage } from "@/pages/tasks";
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
          {
            create: "/tasks/new",
            edit: "/tasks/:taskId",
            list: "/tasks",
            name: RESOURCES.tasks,
            show: "/tasks/:taskId",
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
            <Route path="sessions/pending-questions" element={<PendingQuestionsPage />} />
            <Route path="sessions/:id" element={<SessionDetailPage />} />
            <Route path="tasks" element={<TasksPage />} />
            <Route path="tasks/new" element={<TaskCreatePage />} />
            <Route path="tasks/:taskId" element={<TaskDetailPage />} />
            <Route path="platform/approvals" element={<PlatformApprovalsPage />} />
            <Route path="platform/channels" element={<PlatformChannelsPage />} />
            <Route path="platform/knowledge-policies" element={<KnowledgePoliciesPage />} />
            <Route path="platform/cron-jobs" element={<CronJobsPage />} />
            <Route path="platform/cron-jobs/new" element={<CronJobCreatePage />} />
            <Route path="platform/cron-jobs/:jobId" element={<CronJobEditPage />} />
          </Route>
        </Routes>
      </Refine>
    </BrowserRouter>
  );
}

export default App;
