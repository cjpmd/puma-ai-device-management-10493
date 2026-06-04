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

RUN python3 -c "from ultralytics import YOLO; YOLO('yolov8m.pt')"
RUN python3 -c "import easyocr; easyocr.Reader(['en'], gpu=False, verbose=False)"

RUN pip3 install --no-cache-dir SoccerNet>=0.1.50 || pip3 install --no-cache-dir SoccerNet

# Verify key imports and check BoT-SORT availability
RUN python3 -c "
import cv2, numpy as np
import supervision as sv
print('supervision version:', sv.__version__)
has_botsort = hasattr(sv, 'BotSort') or hasattr(sv, 'BoTSORT')
print('BotSort available:', has_botsort)
print('All imports OK')
"

COPY gpu-server/*.py .

CMD ["python3", "-u", "handler.py"]
