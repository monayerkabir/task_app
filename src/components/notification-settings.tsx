"use client";

import { useEffect, useState } from "react";
import { removePushSubscription, savePushSubscription, setEmailPref } from "@/app/actions/push";

function urlBase64ToUint8Array(base64: string) {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

export function PushToggle({ vapidKey }: { vapidKey: string }) {
  const [state, setState] = useState<"loading" | "unsupported" | "off" | "on" | "denied" | "error">("loading");
  const [msg, setMsg] = useState("");

  useEffect(() => {
    (async () => {
      if (!("serviceWorker" in navigator) || !("PushManager" in window) || !vapidKey) return setState("unsupported");
      if (Notification.permission === "denied") return setState("denied");
      const reg = await navigator.serviceWorker.register("/sw.js");
      const sub = await reg.pushManager.getSubscription();
      setState(sub ? "on" : "off");
    })().catch(() => setState("error"));
  }, [vapidKey]);

  async function enable() {
    try {
      const perm = await Notification.requestPermission();
      if (perm !== "granted") return setState("denied");
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(vapidKey) });
      const json = sub.toJSON() as { endpoint: string; keys: { p256dh: string; auth: string } };
      const r = await savePushSubscription(json);
      if (r.error) throw new Error(r.error);
      setState("on");
      setMsg("Phone alerts are on for this device.");
    } catch (e) {
      setState("error");
      setMsg((e as Error).message);
    }
  }

  async function disable() {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if (sub) {
      await removePushSubscription(sub.endpoint);
      await sub.unsubscribe();
    }
    setState("off");
    setMsg("");
  }

  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <p className="font-medium">Phone / browser alerts</p>
        <p className="muted">
          {state === "unsupported" && "Not available here. On iPhone, add Tick to your home screen first."}
          {state === "denied" && "Blocked. Allow notifications for this site in your browser settings."}
          {(state === "on" || state === "off") && "New tasks, transfers and approvals pop up on this device."}
          {msg && ` ${msg}`}
        </p>
      </div>
      {state === "on" ? (
        <button onClick={disable} className="btn-secondary shrink-0">
          Turn off
        </button>
      ) : state === "off" || state === "error" ? (
        <button onClick={enable} className="btn-primary shrink-0">
          Turn on
        </button>
      ) : null}
    </div>
  );
}

export function EmailToggle({ initial }: { initial: boolean }) {
  const [on, setOn] = useState(initial);
  return (
    <label className="flex items-start justify-between gap-4">
      <div>
        <p className="font-medium">Email</p>
        <p className="muted">A morning summary on working days, plus emails for assignments, transfers and deadline decisions.</p>
      </div>
      <input
        type="checkbox"
        className="mt-1 h-5 w-5 accent-brand-700"
        checked={on}
        onChange={async (e) => {
          setOn(e.target.checked);
          await setEmailPref(e.target.checked);
        }}
      />
    </label>
  );
}
