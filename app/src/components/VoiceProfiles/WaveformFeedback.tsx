interface LiveLevelMeterProps {
  level: number;
}

interface WaveformStripProps {
  samples: number[];
  playheadProgress?: number;
  className?: string;
}

export function LiveLevelMeter({ level }: LiveLevelMeterProps) {
  const clampedLevel = Math.max(0, Math.min(1, level));
  return (
    <div className="w-full h-2 rounded-full bg-muted overflow-hidden">
      <div
        className="h-full bg-accent transition-[width] duration-100"
        style={{ width: `${Math.round(clampedLevel * 100)}%` }}
      />
    </div>
  );
}

export function WaveformStrip({ samples, playheadProgress, className = '' }: WaveformStripProps) {
  const bars = samples.length > 0 ? samples : Array.from({ length: 60 }, () => 0.08);
  const playheadPercent =
    playheadProgress !== undefined ? Math.max(0, Math.min(1, playheadProgress)) * 100 : null;

  return (
    <div
      className={`relative h-20 w-full rounded-md bg-background/40 border border-border px-2 py-2 flex items-end gap-[2px] overflow-hidden ${className}`}
    >
      {bars.map((sample, index) => (
        <div
          key={`${index}-${sample}`}
          className="flex-1 bg-accent/70 rounded-sm"
          style={{ height: `${Math.max(6, Math.round(sample * 100))}%` }}
        />
      ))}
      {playheadPercent !== null && (
        <div
          className="absolute top-0 bottom-0 w-[2px] bg-primary"
          style={{ left: `calc(${playheadPercent}% - 1px)` }}
        />
      )}
    </div>
  );
}
