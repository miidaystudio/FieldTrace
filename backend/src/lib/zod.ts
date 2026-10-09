import { extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi';
import { z } from 'zod';

// Adds `.openapi()` to every Zod schema. Import `z` from this module everywhere in `src/`
// so the extension is guaranteed to be applied before any schema is declared.
extendZodWithOpenApi(z);

export { z };
