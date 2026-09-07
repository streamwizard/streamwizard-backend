-- Consumer NVIDIA drivers cap concurrent NVENC sessions (8 as of the 500+
-- driver series) independent of VRAM headroom; Quadro/RTX-A cards have no
-- such cap. obs-instance-manager's POST /instances now gates admission on
-- this alongside max_instances/total_vram_mb -- null means unlimited, for
-- pro-card nodes.
alter table obs_nodes
  add column max_encoder_sessions integer;

-- Backfill existing nodes with the consumer-GPU session cap (8, as of the
-- NVIDIA 500+ driver series) as a conservative default -- operators should
-- raise this to null (unlimited) for nodes running Quadro/RTX-A cards, which
-- have no such cap.
update obs_nodes set max_encoder_sessions = 8 where max_encoder_sessions is null;
