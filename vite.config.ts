import { defineConfig } from "vite";
import vinext from "vinext";
import { cloudflare } from "@cloudflare/vite-plugin";
import path from 'node:path';

process.env['CLOUDFLARE_WORKER'] = '1';
const root = import.meta.dirname;

export default defineConfig({
  plugins: [
    {
      name: 'megasena-worker-runtime',
      enforce: 'pre',
      async resolveId(source, importer) {
        if (this.environment.name === 'client' || !importer) return null;
        const resolved = await this.resolve(source, importer, { skipSelf: true });
        const replacements: Record<string, string> = {
          [path.join(root, 'lib/db.ts')]: 'lib/cloudflare/database.ts',
          [path.join(root, 'lib/api/runtime-api-transport.ts')]: 'cloudflare/api-transport.ts',
        };
        const replacement = resolved && replacements[resolved.id];
        return replacement ? path.join(root, replacement) : null;
      },
    },
    vinext(),
    cloudflare({
      viteEnvironment: {
        name: "rsc",
        childEnvironments: ["ssr"],
      },
    }),
  ],
});
