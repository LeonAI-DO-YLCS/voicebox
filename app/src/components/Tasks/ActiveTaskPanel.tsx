import { CheckCircle2, Loader2, XCircle } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import type { UnifiedActiveTask } from '@/lib/recording/activeTasks';

interface ActiveTaskPanelProps {
  tasks: UnifiedActiveTask[];
}

function StatusIcon({ status }: { status: UnifiedActiveTask['status'] }) {
  if (status === 'complete') {
    return <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />;
  }
  if (status === 'error') {
    return <XCircle className="h-4 w-4 text-destructive shrink-0" />;
  }
  return <Loader2 className="h-4 w-4 animate-spin shrink-0" />;
}

export function ActiveTaskPanel({ tasks }: ActiveTaskPanelProps) {
  if (tasks.length === 0) {
    return (
      <div className="fixed bottom-4 right-4 w-[320px] rounded-lg border bg-background/95 backdrop-blur p-3 shadow-xl">
        <p className="text-sm font-medium">Background Tasks</p>
        <p className="text-xs text-muted-foreground mt-1">No active tasks.</p>
      </div>
    );
  }

  return (
    <div className="fixed bottom-4 right-4 w-[360px] max-h-[45vh] overflow-auto rounded-lg border bg-background/95 backdrop-blur p-3 shadow-xl space-y-3">
      <p className="text-sm font-medium">Background Tasks</p>
      {tasks.map((task) => (
        <div key={task.id} className="rounded-md border p-2 space-y-2">
          <div className="flex items-start gap-2">
            <StatusIcon status={task.status} />
            <div className="min-w-0">
              <p className="text-sm font-medium truncate">{task.title}</p>
              <p className="text-xs text-muted-foreground break-words">{task.subtitle}</p>
            </div>
          </div>
          {task.progress !== null && <Progress value={task.progress} className="h-2" />}
        </div>
      ))}
    </div>
  );
}
