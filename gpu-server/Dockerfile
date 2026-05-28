FROM nvidia/cuda:11.8.0-cudnn8-runtime-ubuntu22.04

WORKDIR /app

RUN apt-get update && apt-get install -y \
    python3-pip \
    python3-dev \
    libgl1-mesa-glx \
    libglib2.0-0 \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

COPY gpu-server/requirements.txt .
RUN pip3 install --no-cache-dir torch==2.1.1 torchvision==0.16.1 --index-url https://download.pytorch.org/whl/cu118
RUN pip3 install --no-cache-dir -r requirements.txt

RUN python3 -c "from ultralytics import YOLO; YOLO('yolov8m.pt')"
RUN python3 -c "import easyocr; easyocr.Reader(['en'], gpu=False, verbose=False)"

COPY gpu-server/handler.py .
COPY gpu-server/requirements.txt .

CMD ["python3", "-u", "handler.py"]
