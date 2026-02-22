import { Activity, AlertTriangle, CheckCircle2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { AudioInputSignalProbe } from '@/platform/types';

interface AudioInputDiagnosticsPanelProps {
  title: string;
  description: string;
  onRunProbe: () => void;
  isProbing: boolean;
  probe: AudioInputSignalProbe | null;
  error?: string | null;
  disabled?: boolean;
}

function formatMetric(value: number): string {
  return Number.isFinite(value) ? value.toFixed(5) : '0.00000';
}

export function AudioInputDiagnosticsPanel({
  title,
  description,
  onRunProbe,
  isProbing,
  probe,
  error,
  disabled = false,
}: AudioInputDiagnosticsPanelProps) {
  return (
    <div className="rounded-md border border-border/70 bg-muted/20 p-3 space-y-2">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium flex items-center gap-2">
            <Activity className="h-4 w-4 text-muted-foreground" />
            {title}
          </p>
          <p className="text-xs text-muted-foreground mt-1">{description}</p>
        </div>
        <Button size="sm" variant="outline" onClick={onRunProbe} disabled={disabled || isProbing}>
          {isProbing ? (
            <>
              <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
              Checking...
            </>
          ) : (
            'Run 2s Check'
          )}
        </Button>
      </div>

      {error && (
        <p className="text-xs text-destructive flex items-start gap-2">
          <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
          {error}
        </p>
      )}

      {probe && (
        <div className="rounded border border-border/60 bg-background/50 p-2 space-y-1.5">
          <p
            className={`text-xs font-medium flex items-center gap-1.5 ${probe.has_signal ? 'text-emerald-500' : 'text-amber-500'}`}
          >
            {probe.has_signal ? (
              <CheckCircle2 className="h-3.5 w-3.5" />
            ) : (
              <AlertTriangle className="h-3.5 w-3.5" />
            )}
            {probe.has_signal ? 'Signal detected' : 'Near silence detected'}
          </p>
          <p className="text-xs text-muted-foreground">
            Source: <span className="text-foreground/90">{probe.device_name}</span>
          </p>
          <p className="text-xs text-muted-foreground">
            Peak: {formatMetric(probe.peak)} | RMS: {formatMetric(probe.rms)} | Samples:{' '}
            {probe.sample_count}
          </p>
          <p className="text-xs text-muted-foreground">{probe.message}</p>
          {probe.has_signal ? (
            <p className="text-xs text-emerald-500/90">
              Signal looks healthy. You can start recording/capture now.
            </p>
          ) : (
            <p className="text-xs text-amber-500/90">
              No usable signal detected. On WSL2, prefer a non-loopback source (like
              &apos;pulse&apos; or &apos;RDPSource&apos;), verify Windows microphone privacy for desktop
              apps, then run the check again.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
