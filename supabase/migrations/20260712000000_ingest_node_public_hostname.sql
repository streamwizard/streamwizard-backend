-- Ingest nodes: an admin-set public DNS name (e.g. ingest-01.streamwizard.org)
-- that encoders point their SRT/SRTLA feed at, instead of the raw public IP.
-- A domain is more stable than an IP -- the box can be reprovisioned or moved
-- behind DNS without every user having to re-copy a new connection string.
--
-- Distinct from `hostname` (the machine's own Linux hostname, self-reported by
-- install.sh) and `public_ip` (also self-reported): public_hostname is not
-- something the box knows about itself, it's the A/AAAA record ops points at
-- it, so it's set by an admin in the panel, never at claim time. Host
-- resolution prefers public_hostname, falling back to public_ip when unset.
ALTER TABLE "public"."ingest_nodes"
    ADD COLUMN "public_hostname" text;

COMMENT ON COLUMN "public"."ingest_nodes"."public_hostname" IS
    'Admin-set public FQDN encoders connect to (e.g. ingest-01.streamwizard.org). Preferred over public_ip when building SRT/SRTLA connection strings.';
