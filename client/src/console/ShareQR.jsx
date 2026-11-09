import { useRef, useState } from "react";
import { toast } from "sonner";
import { QRCodeCanvas } from "qrcode.react";
import { Copy, Download, ExternalLink, Printer } from "lucide-react";
import { Button, Card } from "../components/ui";
import { PageHeader } from "./ConsoleLayout";

/** A QR code and a short link that open the ticket-buying page directly. Always uses the live website address. */
export default function ShareQR() {
  const origin = window.location.origin;
  const links = [
    {
      key: "buy",
      label: "Buy tickets page",
      path: "/buy",
      note: "Opens the ticket selection straight away. Best for the QR code, flyers and social media.",
    },
    {
      key: "home",
      label: "Home page",
      path: "/",
      note: "The full website with the event details.",
    },
    {
      key: "find",
      label: "Find my ticket",
      path: "/find-ticket",
      note: "For people who already paid and lost their email.",
    },
  ];
  const [sel, setSel] = useState("buy");
  const link = links.find((l) => l.key === sel);
  const url = `${origin}${link.path}`;
  const canvasRef = useRef(null);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Link copied.");
    } catch {
      toast.error(
        "Could not copy. Please select the link and copy it by hand.",
      );
    }
  };

  const download = () => {
    const canvas = canvasRef.current?.querySelector("canvas");
    if (!canvas) return;
    const a = document.createElement("a");
    a.href = canvas.toDataURL("image/png");
    a.download = `ngfw-${link.key}-qr.png`;
    a.click();
  };

  const print = () => {
    const canvas = canvasRef.current?.querySelector("canvas");
    if (!canvas) return;
    const w = window.open("", "_blank");
    if (!w) return toast.error("Please allow pop-ups to print.");
    w.document.write(`<!doctype html><title>Nigeria Gala Fashion Week</title>
      <body style="margin:0;font-family:Georgia,serif;text-align:center;padding:48px 24px">
      <p style="letter-spacing:.5em;font:14px Arial;color:#8a6d2f;margin:0">NIGERIA</p>
      <h1 style="margin:6px 0 28px;font-size:40px">GALA FASHION WEEK</h1>
      <p style="font:20px Arial;margin:0 0 20px">Scan to buy your ticket</p>
      <img src="${canvas.toDataURL("image/png")}" style="width:420px;height:420px" />
      <p style="font:16px Arial;margin-top:20px;word-break:break-all">${url}</p>
      <script>window.onload=()=>setTimeout(()=>window.print(),300)</script></body>`);
    w.document.close();
  };

  return (
    <div>
      <PageHeader
        title="Share & QR code"
        sub="A link and a QR code that take people straight to buying a ticket, so nobody has to hunt for it on the website."
      />
      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <Card className="p-6">
          <p className="mb-3 text-[13px] font-medium text-sand">
            Where should it open?
          </p>
          <div className="space-y-2">
            {links.map((l) => (
              <button
                key={l.key}
                type="button"
                onClick={() => setSel(l.key)}
                className={`block w-full cursor-pointer rounded-xl border p-4 text-left transition-colors ${sel === l.key ? "border-gold bg-gold/10" : "border-line hover:border-gold/50"}`}
              >
                <p className="text-sm font-medium text-ivory">{l.label}</p>
                <p className="mt-0.5 text-xs text-muted">{l.note}</p>
              </button>
            ))}
          </div>
          <p className="mb-2 mt-6 text-[13px] font-medium text-sand">Link</p>
          <div className="break-all rounded-xl border border-line bg-ink-3 p-3 font-mono text-sm text-gold">
            {url}
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button icon={Copy} onClick={copy}>
              Copy link
            </Button>
            <Button
              variant="outline"
              icon={ExternalLink}
              onClick={() => window.open(url, "_blank")}
            >
              Open it
            </Button>
          </div>
        </Card>

        <Card className="p-6 text-center">
          <div
            ref={canvasRef}
            className="mx-auto w-fit rounded-2xl bg-white p-4"
          >
            <QRCodeCanvas
              value={url}
              size={1024}
              level="H"
              marginSize={1}
              style={{ width: 240, height: 240 }}
            />
          </div>
          <p className="mt-4 text-xs text-muted">
            Scan with any phone camera. It always opens your live website.
          </p>
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            <Button icon={Download} onClick={download}>
              Download PNG
            </Button>
            <Button variant="outline" icon={Printer} onClick={print}>
              Print poster
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}
