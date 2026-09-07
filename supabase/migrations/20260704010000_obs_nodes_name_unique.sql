-- A node's name is now used verbatim as its Linux hostname (see
-- rest-api's /api/nodes/claim handler), so two nodes sharing a name would
-- mean two machines claiming the same hostname. Enforce uniqueness at the
-- database level rather than racily checking-then-inserting in app code.
ALTER TABLE public.obs_nodes
  ADD CONSTRAINT obs_nodes_name_key UNIQUE (name);
