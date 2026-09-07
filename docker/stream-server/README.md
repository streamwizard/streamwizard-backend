# Stream-box ingest stack

Deploys the StreamWizard ingest server on a **dedicated stream box** (not Dokploy),
alongside the per-streamer OBS containers it provisions.

## Components

| Service | Image | Ports (host) | Role |
| --- | --- | --- | --- |
| `ingest-control` | `apps/ingest-control` (Bun) | internal `8090` | Validates stream keys against Supabase, provisions OBS, records sessions |
| `ingest-media` | `apps/ingest-media` (Python/GStreamer) | `8888/udp` (SRT), `1935/tcp` (RTMP) | Authorizes + passthrough-relays feeds to OBS |
| `srtla-receiver` | Belabox `srtla_rec` | `5000/udp` (SRTLA) | Bonds SRTLA links → internal SRT (`ingest-media:8889`) |
| `sw-obs-<user>` | `$INGEST_OBS_IMAGE` | — | One per active streamer, created at runtime by `ingest-control` |

The dynamically-created OBS containers join the `stream-server` network and listen
for SRT on `9000`; the media plane pushes each tenant's feed to `srt://sw-obs-<user>:9000`.

## Streamer ingest URLs

- **RTMP:** `rtmp://<box-host>/live/<stream-key>`
- **SRT:** `srt://<box-host>:8888?streamid=<stream-key>`
- **SRTLA:** host `<box-host>`, port `5000`, with the SRT `streamid` set to `<stream-key>`

## Run

```bash
cp .env.example .env   # fill in DOPPLER_TOKEN, INGEST_CONTROL_SECRET, INGEST_OBS_IMAGE
docker compose up --build -d
docker compose logs -f
```

## Notes

- The control plane mounts the host Docker socket to manage OBS containers — keep
  that container minimal and the box locked down.
- `INGEST_CONTROL_SECRET` must match across `ingest-control` and `ingest-media`
  (compose wires both from the same `.env` var).
- Pin the Belabox `srtla` revision in `srtla/Dockerfile` for reproducible builds.
- The OBS image (`$INGEST_OBS_IMAGE`) is provided separately; it must read
  `INPUT_URL` (an SRT listener URL) and forward to the streamer's destination.
