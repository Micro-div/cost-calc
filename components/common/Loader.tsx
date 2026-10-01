"use client";

import { useEffect, useState } from "react";

const MIN_DISPLAY_TIME = 2200;
const FADE_OUT_DURATION = 600;

const PARTICLES = Array.from({ length: 12 }, (_, i) => ({
  id: i,
  angle: (i / 12) * 360,
  size: 2 + ((i * 7) % 10) / 3,
  delay: ((i * 13) % 20) / 10,
  duration: 2 + ((i * 11) % 15) / 10,
}));

export function Loader() {
  const [visible, setVisible] = useState(true);
  const [fading, setFading] = useState(false);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const startTime = Date.now();
    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const pct = Math.min((elapsed / MIN_DISPLAY_TIME) * 100, 100);
      setProgress(Math.round(pct));
    }, 30);

    const fadeTimer = setTimeout(() => setFading(true), MIN_DISPLAY_TIME);
    const hideTimer = setTimeout(
      () => setVisible(false),
      MIN_DISPLAY_TIME + FADE_OUT_DURATION,
    );

    return () => {
      clearInterval(interval);
      clearTimeout(fadeTimer);
      clearTimeout(hideTimer);
    };
  }, []);

  if (!visible) return null;

  return (
    <div
      className={`loader-overlay${fading ? " loader-overlay--fading" : ""}`}
      aria-hidden={fading}
    >
      {/* Background grid */}
      <div className="loader-grid" />

      {/* Radial glow */}
      <div className="loader-glow" />

      {/* Scanning line */}
      <div className="loader-scanline" />

      <div className="loader-content">
        {/* Orbital system */}
        <div className="loader-orbital">
          {/* Outer ring */}
          <div className="loader-orbit-ring loader-orbit-ring--outer">
            {PARTICLES.map((p) => (
              <span
                key={p.id}
                className="loader-particle"
                style={{
                  "--angle": `${p.angle}deg`,
                  "--size": `${p.size}px`,
                  "--delay": `${p.delay}s`,
                  "--duration": `${p.duration}s`,
                } as React.CSSProperties}
              />
            ))}
          </div>

          {/* Inner ring */}
          <div className="loader-orbit-ring loader-orbit-ring--inner" />

          {/* Core */}
          <div className="loader-core">
            <div className="loader-core-inner">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z"
                  fill="currentColor"
                />
              </svg>
            </div>
          </div>

          {/* Glow pulse */}
          <div className="loader-pulse" />
        </div>

        {/* Brand text with glitch */}
        <div className="loader-brand">
          <span className="loader-brand-text">
            <span className="loader-brand-word loader-brand-word--accent">
              Cost
            </span>
            <span className="loader-brand-word">Calc</span>
          </span>
          <span className="loader-brand-glitch" data-text="CostCalc">
            CostCalc
          </span>
        </div>

        {/* Futuristic progress */}
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
          <div className="loader-progress-info">
            <span className="loader-progress-label">INITIALIZING</span>
            <span className="loader-progress-value">{progress}%</span>
          </div>
        </div>

        {/* Status text */}
        <p className="loader-status">
          <span className="loader-status-dot" />
          Calibrating estimation engine
        </p>
      </div>

      {/* Corner decorations */}
      <div className="loader-corner loader-corner--tl" />
      <div className="loader-corner loader-corner--tr" />
      <div className="loader-corner loader-corner--bl" />
      <div className="loader-corner loader-corner--br" />
    </div>
  );
}
