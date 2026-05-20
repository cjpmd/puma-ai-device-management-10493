# RunPod PyTorch base includes CUDA 11.8 + cuDNN, matching torch cu118 wheels
FROM runpod/pytorch:2.1.0-py3.10-cuda11.8.0-devel

WORKDIR /app

# System dependencies — ffmpeg for audio sync and re-encode steps
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    libgl1-mesa-glx \
    libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

# Python dependencies — torch is already in the base image; install the rest
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Pre-download YOLOv8m weights at build time to avoid cold-start latency.
# yolov8m.pt (~52 MB) gives a better precision/speed tradeoff than yolov8n.pt
# for sports footage where players are small relative to frame size.
RUN python -c "from ultralytics import YOLO; YOLO('yolov8m.pt')"

COPY handler.py .

CMD ["python", "-u", "handler.py"]
