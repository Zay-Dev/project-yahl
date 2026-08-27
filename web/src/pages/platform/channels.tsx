import type { TResponseWhatsAppChannel } from "@project-yahl/server/modules/platform/-api-types";

import { useWhatsAppChannel } from "@/hooks/use-whatsapp-channel";

const statusClass = (status: TResponseWhatsAppChannel["status"]) => {
  if (status === "ready") {
    return "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300";
  }

  if (status === "pending" || status === "connecting" || status === "authenticated") {
    return "bg-amber-500/15 text-amber-700 dark:text-amber-300";
  }

  return "bg-muted text-muted-foreground";
};

const statusMessage = (channel: TResponseWhatsAppChannel | null): string | null => {
  if (!channel) {
    return null;
  }

  if (!channel.enabled) {
    return "WhatsApp is disabled. Set WHATSAPP_ENABLED=true on the server and worker.";
  }

  if (channel.status === "ready") {
    return "Connected. Outbound WhatsApp is available.";
  }

  if (channel.status === "pending") {
    return channel.qrDataUrl
      ? "Scan this QR code with WhatsApp to log in."
      : "Waiting for a QR code from the worker.";
  }

  if (channel.status === "authenticated") {
    return "Session accepted, finishing connect…";
  }

  if (channel.status === "connecting") {
    return "Waiting for WhatsApp…";
  }

  return "Not connected. Wait for a QR code or restart the worker after enabling WhatsApp.";
};

export function PlatformChannelsPage() {
  const { channel, error } = useWhatsAppChannel();
  const status = channel?.status ?? "disconnected";
  const message = statusMessage(channel);

  return (
    <div className="flex flex-col gap-6 p-6">
      <div>
        <h1 className="text-xl font-semibold">Platform channels</h1>
        <p className="text-sm text-muted-foreground">
          WhatsApp Web login status for the worker. Scan the QR when pending.
        </p>
      </div>

      {error ? (
        <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      <section className="rounded-xl border bg-card p-6">
        <div className="mb-4 flex items-center gap-3">
          <h2 className="text-lg font-medium">WhatsApp</h2>
          <span className={`rounded px-2 py-0.5 text-xs font-medium ${statusClass(status)}`}>
            {status}
          </span>
        </div>

        {status === "pending" && channel?.qrDataUrl ? (
          <img
            alt="WhatsApp login QR code"
            className="mx-auto max-w-xs rounded-lg border bg-white p-4"
            src={channel.qrDataUrl}
          />
        ) : null}

        {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}

        {channel?.updatedAt ? (
          <p className="mt-4 text-xs text-muted-foreground">Updated {channel.updatedAt}</p>
        ) : null}
      </section>
    </div>
  );
}
