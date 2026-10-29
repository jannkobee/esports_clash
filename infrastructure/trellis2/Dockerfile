FROM python:3.12-slim

RUN pip install --no-cache-dir google-colab-cli==0.7.5 Pillow==11.3.0

WORKDIR /app
EXPOSE 8096

CMD ["python3", "cloud_bridge.py", "8096"]
