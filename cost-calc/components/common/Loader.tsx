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
    progress < 30
      ? "Initializing..."
      : progress < 60
        ? "Loading pricing data..."
        : progress < 90
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
      {/* Animated background elements */}
      <div className="loader-bg-grid" aria-hidden="true" />
      <div className="loader-orb loader-orb-one" aria-hidden="true" />
      <div className="loader-orb loader-orb-two" aria-hidden="true" />
      <div className="loader-orb loader-orb-three" aria-hidden="true" />

      <div className="loader-content">
        {/* Logo mark */}
        <div className="loader-logo" aria-hidden="true">
          <div className="loader-logo-ring" />
          <div className="loader-logo-ring loader-logo-ring--inner" />
          <div className="loader-logo-core">
            <svg viewBox="0 0 24 24" fill="none" className="loader-logo-icon">
              <path
                d="M13 2 3 14h9l-1 8 10-12h-9l1-8Z"
                fill="currentColor"
              />
            </svg>
          </div>
        </div>

        {/* Wordmark */}
        <div className="loader-wordmark">
          <span className="loader-word-cost">Cost</span>
          <span className="loader-word-calc">Calc</span>
        </div>

        {/* Progress section */}
        <div className="loader-progress">
          <div className="loader-progress-track">
            <div
              className="loader-progress-fill"
              style={{ width: `${progress}%` }}
            />
            <div
              className="loader-progress-glow"
              style={{ left: `${progress}%` }}
            />
          </div>
          <div className="loader-progress-meta">
            <span className="loader-status">{statusText}</span>
            <span className="loader-progress-value">
              {String(progress).padStart(2, "0")}%
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
