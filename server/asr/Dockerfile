FROM python:3.12-slim-bookworm AS build
RUN apt-get update && apt-get install -y --no-install-recommends build-essential cmake git ca-certificates && rm -rf /var/lib/apt/lists/*
# v1.9.5, pinned to its full release commit rather than the movable tag.
ARG WHISPER_COMMIT=d1be6fde11ac6e0407606b4e42fe72d34add8037
RUN git init /src && cd /src && git remote add origin https://github.com/ggml-org/whisper.cpp.git \
    && git fetch --depth 1 origin "${WHISPER_COMMIT}" && git checkout --detach FETCH_HEAD \
    && test "$(git rev-parse HEAD)" = "${WHISPER_COMMIT}" \
    && cmake -B build -DCMAKE_BUILD_TYPE=Release -DBUILD_SHARED_LIBS=OFF \
       -DGGML_NATIVE=OFF -DGGML_CPU_ARM_ARCH=armv8.2-a+fp16+dotprod \
       -DGGML_CUDA=OFF -DWHISPER_BUILD_IS_DEV=OFF \
       -DWHISPER_CURL=OFF -DWHISPER_COMMON_FFMPEG=OFF \
       -DWHISPER_BUILD_TESTS=OFF -DWHISPER_BUILD_EXAMPLES=ON -DWHISPER_BUILD_SERVER=ON \
    && cmake --build build --config Release -j 2 --target whisper-server

FROM python:3.12-slim-bookworm
RUN apt-get update && apt-get install -y --no-install-recommends libgomp1 libstdc++6 && rm -rf /var/lib/apt/lists/*
COPY --from=build /src/build/bin/whisper-server /usr/local/bin/whisper-server
ENV PYTHONDONTWRITEBYTECODE=1 OMP_NUM_THREADS=2
USER 65532:65532
EXPOSE 8080
HEALTHCHECK --interval=15s --timeout=3s --start-period=90s --retries=5 \
  CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8080/health',timeout=2)"
ENTRYPOINT ["/usr/local/bin/whisper-server"]
# The server has no --no-prints flag. Its realtime/progress transcript callbacks
# are disabled by default. Do not enable them, --debug-mode or --convert:
# direct WAV uploads are decoded from memory and never written to a temp file.
CMD ["--model", "/models/ggml-small.en-q5_1.bin", "--host", "0.0.0.0", "--port", "8080", "--threads", "2", "--processors", "1", "--language", "en", "--no-gpu", "--no-timestamps"]
