import { Refine } from "@refinedev/core";
import dataProvider from "@refinedev/simple-rest";
import routerProvider from "@refinedev/react-router";

import { BrowserRouter, Route, Routes, Outlet } from "react-router";

import { Home } from '@/pages/home';

const API_URL = "https://api.fake-rest.refine.dev";

export function App() {
  return (
    <BrowserRouter>
      <Refine
        routerProvider={routerProvider}
        dataProvider={dataProvider(API_URL)}
        options={{
          disableTelemetry: true,
        }}
      >
        <Routes>
          <Route path="/" element={<Outlet />}>
            <Route index element={<Home />} />
          </Route>
        </Routes>
        <Home />
      </Refine>
    </BrowserRouter>
  );
}
export default App
