/// <reference types="vite/client" />

declare module "elkjs/lib/elk.bundled.js" {
  import type ELK from "elkjs";
  const Bundled: typeof ELK;
  export default Bundled;
}

declare module "sql.js/dist/sql-wasm.wasm?url" {
  const url: string;
  export default url;
}
