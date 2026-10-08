"use client";

import { useEffect, useState } from "react";

const MIN_DISPLAY_TIME = 2200;

export function Loader({ fading }: { fading: boolean }) {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const startTime = Date.now();
    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const pct = Math.min((elapsed / MIN_DISPLAY_TIME) * 100, 100);
      setProgress(pct);
    }, 16);

    return () => clearInterval(interval);
  }, []);

  const statusText =
    progress < 25
      ? "Initializing"
      : progress < 55
        ? "Loading pricing data"
        : progress < 85
          ? "Preparing estimator"
          : "Ready";

  const circumference = 2 * Math.PI * 52;
  const strokeDashoffset = circumference - (progress / 100) * circumference;

  return (
    <div
      className={`loader-overlay${fading ? " loader-overlay--fading" : ""}`}
      role="status"
      aria-live="polite"
      aria-label="Loading CostCalc"
      aria-hidden={fading}
    >
      {/* Background layers */}
      <div className="loader-bg-mesh" aria-hidden="true" />
      <div className="loader-aurora loader-aurora-one" aria-hidden="true" />
      <div className="loader-aurora loader-aurora-two" aria-hidden="true" />
      <div className="loader-aurora loader-aurora-three" aria-hidden="true" />

      <div className="loader-content">
        {/* Circular progress ring with logo */}
        <div className="loader-ring-container">
          <svg className="loader-ring" viewBox="0 0 120 120">
            <defs>
              <linearGradient id="loaderGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#6754e7" />
                <stop offset="50%" stopColor="#9a7cf1" />
                <stop offset="100%" stopColor="#5cc8aa" />
              </linearGradient>
              <filter id="loaderGlow">
                <feGaussianBlur stdDeviation="3" result="coloredBlur" />
                <feMerge>
                  <feMergeNode in="coloredBlur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>
            {/* Background track */}
            <circle
              cx="60"
              cy="60"
              r="52"
              fill="none"
              stroke="rgba(103,84,231,0.12)"
              strokeWidth="2"
            />
            {/* Progress arc */}
            <circle
              cx="60"
              cy="60"
              r="52"
              fill="none"
              stroke="url(#loaderGradient)"
              strokeWidth="3"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              filter="url(#loaderGlow)"
              transform="rotate(-90 60 60)"
              className="loader-ring-progress"
            />
          </svg>

          {/* Center logo */}
          <div className="loader-center">
            <div className="loader-logo-mark">
              <svg viewBox="0 0 24 24" fill="none" className="loader-logo-icon">
                <path
                  d="M13 2 3 14h9l-1 8 10-12h-9l1-8Z"
                  fill="currentColor"
                />
              </svg>
            </div>
            <span className="loader-percentage">
              {Math.round(progress)}%
            </span>
          </div>
        </div>

        {/* Wordmark */}
        <div className="loader-wordmark">
          <span className="loader-word-cost">Cost</span>
          <span className="loader-word-calc">Calc</span>
        </div>

        {/* Status */}
        <div className="loader-status-row">
          <div className="loader-status-dot" />
          <span className="loader-status-text">{statusText}</span>
        </div>
      </div>
    </div>
  );
}
