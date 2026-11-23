/* Classic worker (not type:module) for OpenCV.js compatibility.
 * Loads self-hosted /opencv/opencv.js, then the bundled centering-core bridge.
 */

let opencvReady = null;
let opencvLoaded = false;

function ensureOpenCv() {
  if (opencvReady) return opencvReady;
  opencvReady = new Promise(function (resolve, reject) {
    try {
      if (typeof self.cv !== "undefined" && self.cv.Mat) {
        opencvLoaded = true;
        resolve(self.cv);
        return;
      }
      var Module = {
        onRuntimeInitialized: function () {
          opencvLoaded = true;
          resolve(self.cv);
        },
      };
      self.Module = Module;
      importScripts("/opencv/opencv.js");
      if (typeof self.cv !== "undefined") {
        if (self.cv.Mat) {
          opencvLoaded = true;
          resolve(self.cv);
        } else if (typeof self.cv.then === "function") {
          self.cv.then(function (cv) {
            self.cv = cv;
            opencvLoaded = true;
            resolve(cv);
          }, reject);
        }
        // else wait for onRuntimeInitialized
      } else {
        reject(new Error("opencv_missing"));
      }
    } catch (err) {
      reject(err);
    }
  });
  return opencvReady;
}

try {
  importScripts("/workers/measure-core.js");
} catch (err) {
  self.__measureCoreError = err;
}

self.onmessage = async function (event) {
  var id = event.data && event.data.id;
  var type = event.data && event.data.type;
  var payload = (event.data && event.data.payload) || {};
  try {
    if (type === "ping") {
      self.postMessage({ id: id, ok: true, result: { pong: true, openCvLoaded: opencvLoaded } });
      return;
    }

    if (!self.MyntedMeasure) {
      self.postMessage({ id: id, ok: false, error: "measure_core_missing" });
      return;
    }

    if (type === "measureFromBorders") {
      var report = self.MyntedMeasure.measureFromBordersPayload(
        payload.face,
        payload.borders,
        payload.opts || {},
      );
      self.postMessage({ id: id, ok: true, result: report });
      return;
    }

    if (type === "measureImage") {
      if (!payload.bitmap && !(payload.imageData && payload.imageData.data)) {
        self.postMessage({ id: id, ok: false, error: "pixels_required" });
        return;
      }

      var cv;
      try {
        cv = await ensureOpenCv();
      } catch (e) {
        self.postMessage({ id: id, ok: false, error: "opencv_required" });
        return;
      }

      var imageData = payload.imageData;
      if (!imageData && payload.bitmap) {
        var canvas = new OffscreenCanvas(payload.bitmap.width, payload.bitmap.height);
        var ctx = canvas.getContext("2d");
        ctx.drawImage(payload.bitmap, 0, 0);
        imageData = ctx.getImageData(0, 0, payload.bitmap.width, payload.bitmap.height);
      }

      var measured = self.MyntedMeasure.measureImagePixels(cv, imageData, {
        face: payload.face,
        captureSource: payload.captureSource || "UPLOAD",
        framesUsed: payload.framesUsed || 1,
        openCvLoaded: true,
      });

      var rectified = measured.rectifiedRgba;
      if (rectified) {
        delete measured.rectifiedRgba;
        try {
          var rc = new OffscreenCanvas(rectified.width, rectified.height);
          var rctx = rc.getContext("2d");
          var idata = new ImageData(rectified.data, rectified.width, rectified.height);
          rctx.putImageData(idata, 0, 0);
          var blob = await rc.convertToBlob({ type: "image/jpeg", quality: 0.85 });
          measured.quality = measured.quality || {};
          measured.quality.hasRectified = true;
          self.postMessage({ id: id, ok: true, result: measured, rectifiedBlob: blob });
          return;
        } catch (_) {
          // overlay optional
        }
      }

      self.postMessage({ id: id, ok: true, result: measured });
      return;
    }

    self.postMessage({ id: id, ok: false, error: "unknown_type" });
  } catch (err) {
    var code =
      err && err.code
        ? err.code
        : err && err.message
          ? err.message
          : "worker_error";
    self.postMessage({ id: id, ok: false, error: code });
  }
};
