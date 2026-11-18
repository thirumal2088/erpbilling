import { useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

import { supabase } from "@/integrations/supabase/client";

export async function uploadBillFile(file: Blob, name: string) {
  const path = `${crypto.randomUUID()}-${name.replace(/[^\w.-]/g, "_")}`;
  const { error } = await supabase.storage.from("bill-files").upload(path, file);
  if (error) throw error;
  return path;
}

export async function openBillFile(path: string) {
  const { data, error } = await supabase.storage.from("bill-files").createSignedUrl(path, 3600);
  if (error) {
    toast.error(error.message);
    return;
  }
  window.open(data.signedUrl, "_blank");
}

/** Record a voice note in the browser. Calls onDone with the recorded audio. */
export function VoiceRecorder({
  value,
  onChange,
}: {
  value: Blob | null;
  onChange: (b: Blob | null) => void;
}) {
  const [recording, setRecording] = useState(false);
  const rec = useRef<MediaRecorder | null>(null);
  const url = value ? URL.createObjectURL(value) : null;

  const start = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const r = new MediaRecorder(stream);
      const chunks: Blob[] = [];
      r.ondataavailable = (e) => chunks.push(e.data);
      r.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        onChange(new Blob(chunks, { type: r.mimeType || "audio/webm" }));
      };
      r.start();
      rec.current = r;
      setRecording(true);
    } catch {
      toast.error("Microphone not available");
    }
  };
  const stop = () => {
    rec.current?.stop();
    setRecording(false);
  };

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <Button variant="unstyled" size="unstyled"
        type="button"
        onClick={recording ? stop : start}
        className={`w-fit rounded-lg px-3 py-1.5 font-mono text-xs uppercase ring-1 ring-border ${
          recording ? "animate-pulse bg-tomato text-paper" : "bg-plum text-paper"
        }`}
      >
        {recording ? "■ Stop" : value ? "● Re-record" : "● Record voice note"}
      </Button>
      {url && !recording ? (
        <>
          <audio src={url} controls className="h-8 min-w-0 flex-1" />
          <Button variant="unstyled" size="unstyled"
            type="button"
            onClick={() => onChange(null)}
            aria-label="Remove voice note" className="size-8 rounded-lg font-mono text-xs text-tomato"
          >
            ✕
          </Button>
        </>
      ) : null}
    </div>
  );
}

export type ExcelRow = {
  customer?: string | undefined;
  phone?: string | undefined;
  item?: string | undefined;
  pieces?: number | undefined;
  rate?: number | undefined;
  details?: string | undefined;
};

/** Reads the first data row of an Excel/CSV sheet, matching common column names. */
export async function readExcelFirstRow(file: File): Promise<ExcelRow> {
  const XLSX = await import("xlsx");
  const wb = XLSX.read(await file.arrayBuffer());
  const sheet = wb.Sheets[wb.SheetNames[0] ?? ""];
   if (!sheet) throw new Error("No worksheet found");
   const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet);
  const row = rows[0] ?? {};
  const get = (...keys: string[]) => {
    for (const [k, v] of Object.entries(row)) {
      const n = k.toLowerCase().replace(/[^a-z]/g, "");
      if (keys.some((key) => n.includes(key))) return v;
    }
    return undefined;
  };
  const str = (v: unknown) => (v == null ? undefined : String(v).trim());
  const numv = (v: unknown) => (v == null || v === "" ? undefined : Number(v));
  return {
    customer: str(get("customer", "party", "name")),
    phone: str(get("phone", "mobile")),
    item: str(get("item", "product", "design")),
    pieces: numv(get("pieces", "qty", "quantity", "pcs")),
    rate: numv(get("rate", "price")),
    details: str(get("detail", "note", "remark", "size")),
  };
}
