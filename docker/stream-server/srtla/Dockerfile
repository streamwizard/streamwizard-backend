# Belabox SRTLA receiver (srtla_rec).
#
# srtla_rec terminates bonded SRTLA links and forwards the reconstructed SRT
# stream (streamid intact) to the ingest media plane's internal SRT listener.
# It is transparent to SRT, so the streamer's stream key in the SRT streamid
# flows straight through to our authorization logic.
#
# Usage: srtla_rec <SRTLA_LISTEN_PORT> <SRT_HOST> <SRT_PORT>

FROM debian:bookworm-slim AS build
RUN apt-get update && apt-get install -y --no-install-recommends \
        git build-essential ca-certificates \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /src
# Pin to a tag/commit in production for reproducible builds.
RUN git clone --depth 1 https://github.com/BELABOX/srtla.git . && make

FROM debian:bookworm-slim AS runner
COPY --from=build /src/srtla_rec /usr/local/bin/srtla_rec
EXPOSE 5000/udp
ENTRYPOINT ["srtla_rec"]
# Overridden by docker-compose command; forwards to the media plane by default.
CMD ["5000", "ingest-media", "8889"]
