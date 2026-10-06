"use client";

import { useEffect, useState } from "react";

const MIN_DISPLAY_TIME = 2200;
const FADE_OUT_DURATION = 600;

export function Loader({ fading }: { fading: boolean }) {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const startTime = Date.now();
    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const pct = Math.min((elapsed / MIN_DISPLAY_TIME) * 100, 100);
      setProgress(Math.round(pct));
    }, 30);

    return () => clearInterval(interval);
  }, []);

  const statusText =
    progress < 40
      ? "Loading pricing data..."
      : progress < 85
        ? "Preparing estimator..."
        : "Ready";

  return (
    <div
      className={`loader-overlay${fading ? " loader-overlay--fading" : ""}`}
      role="status"
      aria-live="polite"
      aria-label="Loading CostCalc"
      aria-hidden={fading}
    >
      <div className="loader-dot-grid" aria-hidden="true" />

      <div className="loader-content">
        <div className="loader-wordmark">
          <span className="loader-word-cost">Cost</span>
          <span className="loader-word-calc">Calc</span>
        </div>

        <div
          className="loader-progress"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={progress}
          aria-label="Loading progress"
        >
          <div className="loader-progress-track">
            <div
              className="loader-progress-fill"
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="loader-progress-meta">
            <span className="loader-progress-value">{String(progress).padStart(2, "0")}%</span>
            <span className="loader-status">{statusText}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
