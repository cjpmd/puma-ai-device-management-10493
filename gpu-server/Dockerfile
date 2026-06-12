FROM nvidia/cuda:12.8.1-cudnn-runtime-ubuntu22.04

WORKDIR /app

RUN apt-get update && apt-get install -y \
    python3-pip \
    python3-dev \
    libgl1-mesa-glx \
    libglib2.0-0 \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

COPY gpu-server/requirements.txt .

RUN pip3 install --no-cache-dir "numpy<2.0"
RUN pip3 install --no-cache-dir torch torchvision --index-url https://download.pytorch.org/whl/cu128
RUN pip3 install --no-cache-dir -r requirements.txt

# BoT-SORT + OSNet re-ID + camera-motion compensation (Pain point 1).
# Tolerant install: the worker falls back to tuned ByteTrack if missing.
# numpy is re-pinned afterwards because boxmot's dependency tree may bump it.
RUN (pip3 install --no-cache-dir "boxmot>=11,<14" && pip3 install --no-cache-dir "numpy<2.0") || true

RUN python3 -c "from ultralytics import YOLO; YOLO('yolov8m.pt')"
RUN python3 -c "import easyocr; easyocr.Reader(['en'], gpu=False, verbose=False)"

RUN pip3 install --no-cache-dir SoccerNet || true

# Model-weight cache: OSNet re-ID weights and the fine-tuned jersey digit
# classifier are fetched at container startup (handler.py prefetch) and
# cached here — they are NOT bundled into the image.
ENV MODEL_WEIGHTS_DIR=/app/weights
RUN mkdir -p /app/weights

COPY gpu-server/*.py .

CMD ["python3", "-u", "handler.py"]
