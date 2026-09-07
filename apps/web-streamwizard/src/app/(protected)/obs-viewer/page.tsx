"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { CloudOBSViewer } from "@repo/obs-web";
import { getInstanceNodeApiUrlAction } from "@/actions/nodes";
import { mintNoVncConnection } from "@repo/obs-web";

function ObsViewerContent() {
  const searchParams = useSearchParams();
  const instanceId = searchParams.get("instanceId");
  const name = searchParams.get("name");

  // apiUrl comes from a trusted server-side lookup; the WS URL (with a fresh
  // single-use ticket) is minted per connection attempt inside CloudOBSViewer.
  const [apiUrl, setApiUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!instanceId) {
      setError("Missing instanceId in the URL.");
      return;
    }

    getInstanceNodeApiUrlAction(instanceId).then(({ data: nodeData, error: nodeError }) => {
      if (nodeError || !nodeData) {
        setError(nodeError ?? "Couldn't resolve this instance's node API URL.");
        return;
      }
      setApiUrl(nodeData.apiUrl);
    });
  }, [instanceId]);

  const getConnection = useCallback(() => {
    if (!apiUrl || !instanceId) return Promise.reject(new Error("Instance not ready."));
    return mintNoVncConnection(apiUrl, {
      ticketPath: `/instances/${instanceId}/ws-ticket`,
      wsPath: `/instances/${instanceId}/novnc`,
    });
  }, [apiUrl, instanceId]);

  return (
    <div className="flex h-screen w-screen flex-col bg-black">
      {name && (
        <div className="flex items-center justify-between border-b border-white/10 px-4 py-2">
          <span className="font-mono text-sm text-white">{name}</span>
        </div>
      )}
      <div className="flex-1">
        {error ? (
          <div className="flex h-full flex-col items-center justify-center gap-3">
            <p className="text-sm text-red-400">{error}</p>
            <button className="text-xs text-white/40 underline underline-offset-2" onClick={() => window.close()}>
              Close window
            </button>
          </div>
        ) : apiUrl && instanceId ? (
          <CloudOBSViewer getConnection={getConnection} />
        ) : (
          <p className="p-4 text-sm text-white/60">Resolving instance…</p>
        )}
      </div>
    </div>
  );
}

export default function ObsViewerPage() {
  return (
    <Suspense fallback={<div className="h-screen w-screen bg-black" />}>
      <ObsViewerContent />
    </Suspense>
  );
}
