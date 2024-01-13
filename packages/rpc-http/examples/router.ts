import { Runtime } from "@effect/platform-node"
import * as Http from "@effect/platform-node/HttpServer"
import { Router, Rpc } from "@effect/rpc"
import { HttpRouter } from "@effect/rpc-http"
import { Console, Effect, Layer } from "effect"
import { createServer } from "http"
import { GetUser, GetUserIds, UserId } from "./schema.js"

// Implement the RPC server router
const router = Router.make(
  Rpc.effect(GetUserIds, () => Effect.succeed([UserId(1), UserId(2), UserId(3)])),
  Rpc.effect(GetUser, ({ id }) => Effect.succeed({ id, name: "John Doe" }))
)

export type UserRouter = typeof router

const HttpLive = Http.router.empty.pipe(
  Http.router.post("/rpc", HttpRouter.toHttpApp(router)),
  Http.server.serve(Http.middleware.logger),
  Layer.provide(
    Http.server.layer(createServer, {
      port: 3000
    })
  )
)

// Create the HTTP, which can be served with the platform HTTP server.
Console.log("Listening on http://localhost:3000").pipe(
  Effect.zipRight(Layer.launch(HttpLive)),
  Runtime.runMain
)
