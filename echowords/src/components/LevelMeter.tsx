const BARS = 9;

/** Bars driven by the REAL microphone level (0..1). Shows nothing fake when level is unknown. */
export function LevelMeter({ level, active }: { level: number | null; active: boolean }) {
  // Speech RMS rarely exceeds ~0.3; scale so normal talking fills most bars.
  const v = level === null ? 0 : Math.min(1, level * 4);
  return (
    <div className={`meter${active ? '' : ' meter-idle'}`} aria-hidden>
      {Array.from({ length: BARS }, (_, i) => {
        const centre = 1 - Math.abs(i - (BARS - 1) / 2) / ((BARS - 1) / 2); // middle bars taller
        const h = 12 + v * (40 + centre * 60);
        return <span key={i} style={{ height: `${h}%` }} />;
      })}
    </div>
  );
}
