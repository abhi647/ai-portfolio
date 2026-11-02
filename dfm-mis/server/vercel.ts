/**
 * Entry for the Vercel serverless functions. `npm run build:api` bundles this (and the data /
 * semantic layer it imports) into api/_lib/ask.mjs, so Vercel runs plain JavaScript.
 */
import type { IncomingMessage, ServerResponse } from "node:http";
import { handleHttp, handleStatus } from "./ask";

export default async function ask(req: IncomingMessage, res: ServerResponse) {
  await handleHttp(req, res);
}
export function status(req: IncomingMessage, res: ServerResponse) {
  handleStatus(req, res);
}
