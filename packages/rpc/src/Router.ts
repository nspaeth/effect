/**
 * @since 1.0.0
 */
import type { ParseError } from "@effect/schema/ParseResult"
import * as Schema from "@effect/schema/Schema"
import * as Serializable from "@effect/schema/Serializable"
import * as Cause from "effect/Cause"
import * as Channel from "effect/Channel"
import * as Chunk from "effect/Chunk"
import * as Context from "effect/Context"
import * as Effect from "effect/Effect"
import * as Exit from "effect/Exit"
import { pipe } from "effect/Function"
import { type Pipeable, pipeArguments } from "effect/Pipeable"
import * as Predicate from "effect/Predicate"
import * as Queue from "effect/Queue"
import * as Stream from "effect/Stream"
import { StreamRequestTypeId, withRequestTag } from "./internal/rpc.js"
import * as Rpc from "./Rpc.js"

/**
 * @since 1.0.0
 * @category type ids
 */
export const TypeId = Symbol.for("@effect/rpc/Rpc/Router")

/**
 * @since 1.0.0
 * @category type ids
 */
export type TypeId = typeof TypeId

/**
 * @since 1.0.0
 * @category refinements
 */
export const isRouter = (u: unknown): u is Router<any, any> => Predicate.hasProperty(u, TypeId)

/**
 * @since 1.0.0
 * @category models
 */
export interface Router<R, Reqs extends Schema.TaggedRequest.Any> extends Pipeable {
  readonly [TypeId]: TypeId
  readonly rpcs: ReadonlySet<Rpc.Rpc<R, Reqs>>
}

/**
 * @since 1.0.0
 * @category models
 */
export declare namespace Router {
  /**
   * @since 1.0.0
   * @category models
   */
  export type Context<A extends Router<any, any>> = A extends Router<infer R, infer Req>
    ? R | Serializable.WithResult.Context<Req>
    : never

  /**
   * @since 1.0.0
   * @category models
   */
  export type ContextRaw<A extends Router<any, any>> = A extends Router<infer _R, infer Req>
    ? Serializable.Serializable.Context<Req>
    : never

  /**
   * @since 1.0.0
   * @category models
   */
  export type Request<A extends Router<any, any>> = A extends Router<infer _R, infer Req> ? Req
    : never

  /**
   * @since 1.0.0
   * @category models
   */
  export type Response = [index: number, response: Schema.ExitFrom<any, any> | ReadonlyArray<Schema.ExitFrom<any, any>>]
}

/**
 * @since 1.0.0
 * @category constructors
 */
export const make = <Rpcs extends ReadonlyArray<Rpc.Rpc<any, any> | Router<any, any>>>(
  ...rpcs: Rpcs
): Router<
  | Rpc.Rpc.Context<
    Extract<Rpcs[number], { readonly [Rpc.TypeId]: Rpc.TypeId }>
  >
  | Router.Context<
    Extract<Rpcs[number], { readonly [TypeId]: TypeId }>
  >,
  | Rpc.Rpc.Request<
    Extract<Rpcs[number], { readonly [Rpc.TypeId]: Rpc.TypeId }>
  >
  | Router.Request<
    Extract<Rpcs[number], { readonly [TypeId]: TypeId }>
  >
> => {
  const rpcSet = new Set<Rpc.Rpc<any, any>>()
  rpcs.forEach((rpc) => {
    if (isRouter(rpc)) {
      rpc.rpcs.forEach((rpc) => rpcSet.add(rpc))
    } else {
      rpcSet.add(rpc)
    }
  })
  return ({
    [TypeId]: TypeId,
    rpcs: rpcSet,
    pipe() {
      return pipeArguments(this, arguments)
    }
  })
}

const EOF = Symbol.for("@effect/rpc/Rpc/Router/EOF")

const channelFromQueue = <A>(queue: Queue.Queue<A | typeof EOF>) => {
  const loop: Channel.Channel<never, unknown, unknown, unknown, never, Chunk.Chunk<A>, void> = Channel.flatMap(
    Queue.take(queue),
    (elem) =>
      elem === EOF
        ? Channel.unit
        : Channel.zipRight(Channel.write(Chunk.of(elem)), loop)
  )
  return loop
}

const emptyExit = Schema.encodeSync(Schema.exit(Schema.never, Schema.never))(Exit.failCause(Cause.empty))

/**
 * @since 1.0.0
 * @category combinators
 */
export const toHandler = <R extends Router<any, any>>(router: R) => {
  const schema: Schema.Schema<any, unknown, readonly [Schema.TaggedRequest.Any, Rpc.Rpc<any, any>]> = Schema
    .union(
      ...[...router.rpcs].map((rpc) =>
        Schema.transform(
          rpc.schema,
          Schema.to(Schema.tuple(rpc.schema, Schema.any)),
          (request) => [request, rpc] as const,
          ([request]) => request
        )
      )
    )
  const schemaArray = Schema.array(Rpc.RequestSchema(schema))
  const decode = Schema.decodeUnknown(schemaArray)
  const getEncode = withRequestTag((req) => Schema.encode(Serializable.exitSchema(req)))
  const getEncodeChunk = withRequestTag((req) => Schema.encode(Schema.chunk(Serializable.exitSchema(req))))

  return (u: unknown): Stream.Stream<Router.Context<R>, ParseError, Router.Response> =>
    pipe(
      decode(u),
      Effect.zip(Queue.bounded<Router.Response | typeof EOF>(16)),
      Effect.tap(([requests, queue]) =>
        pipe(
          Effect.forEach(requests, (req, index) => {
            const [request, rpc] = req.request
            if (rpc._tag === "Effect") {
              const encode = getEncode(request)
              return pipe(
                Effect.exit(rpc.handler(request)),
                Effect.flatMap(encode),
                Effect.orDie,
                Effect.matchCauseEffect({
                  onSuccess: (response) => Queue.offer(queue, [index, response]),
                  onFailure: (cause) =>
                    Effect.flatMap(
                      encode(Exit.failCause(cause)),
                      (response) => Queue.offer(queue, [index, response])
                    )
                }),
                Effect.locally(Rpc.currentHeaders, req.headers),
                Effect.withSpan(`Rpc.router ${request._tag}`, {
                  parent: {
                    _tag: "ExternalSpan",
                    traceId: req.traceId,
                    spanId: req.spanId,
                    sampled: req.sampled,
                    context: Context.empty()
                  }
                })
              )
            }
            const encode = getEncodeChunk(request)
            return pipe(
              rpc.handler(request),
              Stream.toChannel,
              Channel.mapOutEffect((chunk) =>
                Effect.flatMap(
                  encode(Chunk.map(chunk, Exit.succeed)),
                  (response) => Queue.offer(queue, [index, response])
                )
              ),
              Channel.runDrain,
              Effect.matchCauseEffect({
                onSuccess: () => Queue.offer(queue, [index, [emptyExit]]),
                onFailure: (cause) =>
                  Effect.flatMap(
                    encode(Chunk.of(Exit.failCause(cause))),
                    (response) => Queue.offer(queue, [index, response])
                  )
              }),
              Effect.locally(Rpc.currentHeaders, req.headers),
              Effect.withSpan(`Rpc.router ${request._tag}`, {
                parent: {
                  _tag: "ExternalSpan",
                  traceId: req.traceId,
                  spanId: req.spanId,
                  sampled: req.sampled,
                  context: Context.empty()
                }
              })
            )
          }, { concurrency: "unbounded", discard: true }),
          Effect.ensuring(Queue.offer(queue, EOF)),
          Effect.fork
        )
      ),
      Effect.map(([_, queue]) => Stream.fromChannel(channelFromQueue(queue))),
      Stream.unwrap
    )
}

/**
 * @since 1.0.0
 * @category combinators
 */
export const toHandlerRaw = <R extends Router<any, any>>(router: R) => {
  const schema: Schema.Schema<
    readonly [Schema.TaggedRequest.Any, Rpc.Rpc<any, any>],
    unknown,
    Router.ContextRaw<R>
  > = Schema.union(...[...router.rpcs].map((rpc) =>
    Schema.transform(
      Schema.to(rpc.schema),
      Schema.to(Schema.tuple(rpc.schema, Schema.any)),
      (request) => [request, rpc] as const,
      ([request]) => request
    )
  ))
  const parse = Schema.decode(schema)

  return <Req extends Router.Request<R>>(request: Req): Rpc.Rpc.Result<Req, Router.ContextRaw<R>> => {
    const isStream = StreamRequestTypeId in request
    const withHandler = parse(request)
    if (isStream) {
      return Stream.unwrap(Effect.map(
        withHandler,
        ([request, rpc]) => rpc.handler(request)
      )) as any
    }
    return Effect.flatMap(
      withHandler,
      ([request, rpc]) => rpc.handler(request) as any
    ) as any
  }
}
