import express, { type Express, type RequestHandler } from "express";
import cors from "cors";
import type { Options as PinoHttpOptions } from "pino-http";
import type { IncomingMessage, ServerResponse } from "http";
import router from "./routes";
import { logger } from "./lib/logger";

// pino-http@10 uses `export =` which is not callable as a default import under
// moduleResolution:"bundler". We load it through require (always available in our
// esbuild bundle via the banner shim) and cast to the correct type.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const pinoHttp: unknown = (globalThis as any).require("pino-http");

const app: Express = express();
app.set("trust proxy", 1);

app.use(
  (pinoHttp as unknown as (opts: PinoHttpOptions) => RequestHandler)({
    logger,
    serializers: {
      req(req: IncomingMessage & { id?: string | number }) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res: ServerResponse) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api", router);

export default app;
