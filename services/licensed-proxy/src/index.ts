import { handle, type Env } from "./proxy";

export default {
  fetch: (request, env) => handle(request, env, { fetch: (url, init) => fetch(url, init) }),
} satisfies ExportedHandler<Env>;
