import type { BordersMm, FaceReport, FaceSide } from "@mynted/centering-core";

type WorkerResponse = {
  id: string;
  ok: boolean;
  result?: FaceReport;
  error?: string;
  rectifiedBlob?: Blob;
};

let worker: Worker | null = null;
let seq = 0;

function getWorker(): Worker {
  if (!worker) {
    worker = new Worker("/workers/measure-worker.js");
  }
  return worker;
}

function callWorker<T>(
  type: string,
  payload: unknown,
  transfer?: Transferable[],
): Promise<T> {
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
      const result = event.data.result as FaceReport & { rectifiedUrl?: string };
      if (event.data.rectifiedBlob) {
        result.quality = {
          ...(result.quality ?? {}),
          rectifiedUrl: URL.createObjectURL(event.data.rectifiedBlob),
        };
      }
      resolve(result as T);
    };
    w.addEventListener("message", onMessage);
    w.postMessage({ id, type, payload }, transfer ?? []);
  });
}

export function measureFromBorders(
  face: FaceSide,
  borders: BordersMm,
  opts?: Partial<FaceReport>,
): Promise<FaceReport> {
  return callWorker("measureFromBorders", { face, borders, opts });
}

/** @deprecated Prefer measureImageBitmap — width/height alone cannot measure. */
export function measureImageMeta(
  _face: FaceSide,
  _width: number,
  _height: number,
  _captureSource: FaceReport["captureSource"],
): Promise<FaceReport> {
  return Promise.reject(new Error("pixels_required"));
}

export async function measureImageBitmap(
  face: FaceSide,
  bitmap: ImageBitmap,
  captureSource: FaceReport["captureSource"],
  framesUsed = 1,
): Promise<FaceReport> {
  return callWorker<FaceReport>(
    "measureImage",
    {
      face,
      bitmap,
      width: bitmap.width,
      height: bitmap.height,
      captureSource,
      framesUsed,
    },
    [bitmap],
  );
}

export async function loadImageBitmap(
  source: File | Blob | ImageBitmap,
): Promise<{ bitmap: ImageBitmap; url: string; width: number; height: number }> {
  if (typeof ImageBitmap !== "undefined" && source instanceof ImageBitmap) {
    return {
      bitmap: source,
      url: "",
      width: source.width,
      height: source.height,
    };
  }
  const blob = source as Blob;
  const url = URL.createObjectURL(blob);
  const bitmap = await createImageBitmap(blob);
  return { bitmap, url, width: bitmap.width, height: bitmap.height };
}

/** @deprecated use loadImageBitmap */
export async function loadImageSize(
  file: File,
): Promise<{ width: number; height: number; url: string }> {
  const { width, height, url } = await loadImageBitmap(file);
  return { width, height, url };
}
