import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";

import { AppShell } from "@/app/AppShell";
import { RunnerPage } from "@/pages/RunnerPage";
import { SessionA2uiPage } from "@/pages/SessionA2uiPage";
import { SessionDetailPage } from "@/pages/SessionDetailPage";
import { SessionsPage } from "@/pages/SessionsPage";

export const Router = () => (
  <BrowserRouter>
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<Navigate replace to="/runner" />} />
        <Route element={<RunnerPage />} path="/runner" />
        <Route element={<SessionsPage />} path="/sessions" />
        <Route element={<SessionDetailPage />} path="/sessions/:sessionId" />
        <Route element={<SessionA2uiPage />} path="/sessions/:sessionId/a2ui" />
      </Route>
    </Routes>
  </BrowserRouter>
);
