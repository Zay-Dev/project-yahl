import { Link } from "react-router";

import { useWhatsAppChannel } from "@/hooks/use-whatsapp-channel";

export function WhatsAppStatusBanner() {
  const { channel } = useWhatsAppChannel();

  if (!channel?.enabled || channel.status === "ready") {
    return null;
  }

  const needsLogin = channel.status === "pending" || channel.status === "disconnected";

  return (
    <div className="border-b border-amber-500/30 bg-amber-500/10 px-4 py-2 text-sm text-amber-900 dark:text-amber-100">
      {needsLogin ? (
        <>
          Please log in to WhatsApp.{" "}
          <Link className="font-medium underline underline-offset-2" to="/platform/channels">
            Open channels
          </Link>
        </>
      ) : (
        "Waiting for WhatsApp"
      )}
    </div>
  );
}
