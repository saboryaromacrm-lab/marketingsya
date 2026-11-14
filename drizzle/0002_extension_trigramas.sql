-- Búsqueda tolerante a errores de tipeo («aseite» → «aceite»).
-- pg_trgm viene incluida en PostgreSQL y es «trusted»: la puede activar el dueño de la base.
CREATE EXTENSION IF NOT EXISTS pg_trgm;
