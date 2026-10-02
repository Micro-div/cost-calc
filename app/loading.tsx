export default function Loading() {
  return (
    <div className="loading-screen">
      <div className="loading-backdrop" />
      <div className="loading-content">
        <div className="loading-logo">
          <div className="loading-logo-ring" />
          <div className="loading-logo-ring loading-logo-ring--delay" />
          <div className="loading-logo-icon">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              className="loading-logo-svg"
            >
              <path
                d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z"
                fill="currentColor"
              />
            </svg>
          </div>
        </div>
        <div className="loading-text">
          <span className="loading-word loading-word--1">Cost</span>
          <span className="loading-word loading-word--2">Calc</span>
        </div>
        <div className="loading-bar">
          <div className="loading-bar-fill" />
        </div>
        <p className="loading-subtitle">Preparing your estimate...</p>
      </div>
    </div>
  );
}
