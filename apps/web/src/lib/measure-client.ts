import type { BordersMm, FaceReport, FaceSide } from "@mynted/centering-core";

type WorkerResponse = {
  id: string;
  ok: boolean;
  result?: FaceReport;
  error?: string;
};

let worker: Worker | null = null;
let seq = 0;

function getWorker(): Worker {
  if (!worker) {
    worker = new Worker("/workers/measure-worker.js");
  }
  return worker;
}

function callWorker<T>(type: string, payload: unknown): Promise<T> {
  const id = `m-${++seq}`;
  const w = getWorker();
  return new Promise((resolve, reject) => {
    const onMessage = (event: MessageEvent<WorkerResponse>) => {
      if (event.data.id !== id) return;
      w.removeEventListener("message", onMessage);
      if (!event.data.ok) {
        reject(new Error(event.data.error || "measure_failed"));
        return;
      }
      resolve(event.data.result as T);
    };
    w.addEventListener("message", onMessage);
    w.postMessage({ id, type, payload });
  });
}

export function measureFromBorders(
  face: FaceSide,
  borders: BordersMm,
  opts?: Partial<FaceReport>,
): Promise<FaceReport> {
  return callWorker("measureFromBorders", { face, borders, opts });
}

export function measureImageMeta(
  face: FaceSide,
  width: number,
  height: number,
  captureSource: FaceReport["captureSource"],
): Promise<FaceReport> {
  return callWorker("measureImage", { face, width, height, captureSource });
}

export async function loadImageSize(file: File): Promise<{ width: number; height: number; url: string }> {
  const url = URL.createObjectURL(file);
  const img = new Image();
  img.src = url;
  await img.decode();
  return { width: img.naturalWidth, height: img.naturalHeight, url };
}