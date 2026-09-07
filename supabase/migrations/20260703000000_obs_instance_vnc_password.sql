-- Per-instance VNC password (see obs-instance-manager's
-- src/services/instance-lifecycle.ts / obs-cloud-container's entrypoint.sh).
-- Every instance shares obs-net with every other instance on the node, so
-- without auth any container could dial another instance's x11vnc directly
-- and get full control of a different tenant's OBS session -- this closes
-- that off. Same AES-256-GCM ciphertext/iv/tag shape as obs_ws_password_*,
-- but generated and encrypted by the backend itself (not the panel), since
-- the VNC password is purely an obs-net isolation measure the end user never
-- needs to see.
alter table obs_instances
  add column vnc_password_ciphertext text,
  add column vnc_password_iv         text,
  add column vnc_password_tag        text;
