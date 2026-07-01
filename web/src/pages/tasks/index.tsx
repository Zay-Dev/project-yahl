import type { TResponseTaskListItem } from "@project-yahl/server/modules/tasks/-api-types";

import { useList } from "@refinedev/core";
import { Link, useNavigate } from "react-router";

import { Button } from "@/components/ui/button";
import { createRun } from "@/pages/tasks/lib/tasks-api";
import { RESOURCES } from "@/providers/constants";

export function TasksPage() {
  const navigate = useNavigate();
  const { result } = useList<TResponseTaskListItem>({
    pagination: { currentPage: 1, mode: "client", pageSize: 100 },
    queryOptions: {
      placeholderData: { data: [], total: 0 },
    },
    resource: RESOURCES.tasks,
  });

  const tasks = result.data ?? [];

  const runTask = async (task: TResponseTaskListItem) => {
    if (task.runInputKeys?.length) {
      navigate(`/tasks/${encodeURIComponent(task.taskId)}`);
      return;
    }

    const run = await createRun(task.taskId);

    navigate(`/sessions/${encodeURIComponent(run.sessionId)}`);
  };

  return (
    <div className="rounded-xl bg-muted/50 p-4">
      <div className="flex items-center justify-between gap-4">
        <p className="text-sm text-muted-foreground">YAHL tasks from server/tasks</p>
        <Button render={<Link to="/tasks/new" />} size="sm">
          New task
        </Button>
      </div>
      <div className="mt-4 overflow-hidden rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="p-3 text-left font-medium">Task</th>
              <th className="p-3 text-left font-medium">Description</th>
              <th className="p-3 text-left font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {tasks.map((task) => (
              <tr className="border-t" key={task.taskId}>
                <td className="p-3">
                  <Link
                    className="text-primary underline-offset-2 hover:underline"
                    to={`/tasks/${encodeURIComponent(task.taskId)}`}
                  >
                    {task.name || task.taskId}
                  </Link>
                  <div className="text-xs text-muted-foreground">{task.taskId}</div>
                </td>
                <td className="p-3">{task.description || "—"}</td>
                <td className="p-3">
                  <div className="flex gap-2">
                    <Button onClick={() => void runTask(task)} size="sm">
                      Run
                    </Button>
                    <Button
                      render={<Link to={`/tasks/${encodeURIComponent(task.taskId)}`} />}
                      size="sm"
                      variant="outline"
                    >
                      Edit
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
