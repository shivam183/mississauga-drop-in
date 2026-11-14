"use client";

import { useEffect } from "react";

export default function Error({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div role="alert">
      <h1 className="page-title">Something went wrong</h1>
      <p className="muted">
        We couldn&rsquo;t load the schedule from ActiveMississauga. It may be busy or down for a
        moment.
      </p>
      <button type="button" className="button" onClick={() => retry()}>
        Try again
      </button>
    </div>
  );
}
