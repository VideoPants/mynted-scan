from __future__ import annotations

import numpy as np
import cv2
from fastapi import FastAPI, File, Form, UploadFile
from fastapi.responses import JSONResponse

from app.measure import measure

app = FastAPI(title="MyntedScan measure-py", version="0.1.0")


@app.get("/health")
def health() -> dict:
    return {"ok": True, "service": "measure-py"}


@app.post("/measure")
async def measure_endpoint(
    file: UploadFile = File(...),
    face: str = Form("FRONT"),
) -> JSONResponse:
    data = await file.read()
    arr = np.frombuffer(data, dtype=np.uint8)
    image = cv2.imdecode(arr, cv2.IMREAD_COLOR)
    if image is None:
        return JSONResponse({"error": "decode_failed"}, status_code=400)
    result = measure(image, face=face if face in ("FRONT", "BACK") else "FRONT")
    return JSONResponse(result)