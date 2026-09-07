alter table obs_instances
  add column obs_ws_password_ciphertext text,
  add column obs_ws_password_iv         text,
  add column obs_ws_password_tag        text;
