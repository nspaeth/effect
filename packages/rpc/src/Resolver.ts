/**
 * @since 1.0.0
 */
import type { ParseError } from "@effect/schema/ParseResult"
import * as Schema from "@effect/schema/Schema"
import * as Serializable from "@effect/schema/Serializable"
import * as Cause from "effect/Cause"
import * as Channel from "effect/Channel"
import * as Chunk from "effect/Chunk"
import * as Effect from "effect/Effect"
import * as Exit from "effect/Exit"
import { pipe } from "effect/Function"
import * as Queue from "effect/Queue"
import * as Request from "effect/Request"
import * as RequestResolver from "effect/RequestResolver"
import * as Stream from "effect/Stream"
import { withRequestTag } from "./internal/rpc.js"
import type * as Router from "./Router.js"
import * as Rpc from "./Rpc.js"

/**
 * @since 1.0.0
 * @category constructors
 */
export const make = <HR, E>(
  handler: (u: ReadonlyArray<unknown>) => Stream.Stream<HR, E, unknown>
) =>
<R extends Router.Router<any, any>>(): RequestResolver.RequestResolver<
  Rpc.Request<Router.Router.Request<R>>,
  Serializable.SerializableWithResult.Context<Router.Router.Request<R>> | HR
> => {
  const getDecode = withRequestTag((req) => Schema.decodeUnknown(Serializable.exitSchema(req)))
  const getDecodeChunk = withRequestTag((req) => Schema.decodeUnknown(Schema.chunk(Serializable.exitSchema(req))))

  return RequestResolver.makeBatched((requests: Array<Rpc.Request<Schema.TaggedRequest.Any>>) => {
    const completed = new Set<number>()
    const queues = new Map<number, Queue.Queue<Chunk.Chunk<Exit.Exit<any, any>>>>()

    return pipe(
      Effect.forEach(requests, (_) =>
        Effect.map(
          Serializable.serialize(_.request),
          (request) => ({ ..._, request })
        )),
      Effect.flatMap((payload) =>
        Stream.runForEach(
          Stream.filter(
            handler(payload),
            (_): _ is Router.Router.Response => Array.isArray(_) && _.length === 2
          ),
          ([index, response]): Effect.Effect<void, ParseError, any> => {
            const request = requests[index]

            if (Array.isArray(response) === false) {
              completed.add(index)
              return Effect.matchCauseEffect(getDecode(request.request)(response), {
                onFailure: (cause) => Request.failCause(request, cause as any),
                onSuccess: (exit) => Request.complete(request, exit as any)
              })
            }

            return pipe(
              Effect.suspend(() => {
                let queue = queues.get(index)

                if (queue === undefined) {
                  queue = Effect.runSync(Queue.unbounded<Chunk.Chunk<Exit.Exit<any, any>>>())
                  queues.set(index, queue)

                  const loop: Channel.Channel<never, unknown, unknown, unknown, any, Chunk.Chunk<any>, void> = Channel
                    .flatMap(
                      Queue.take(queue),
                      (chunk) => {
                        const last = Chunk.unsafeLast(chunk)
                        return Exit.match(last, {
                          onFailure: (cause) => {
                            completed.add(index)
                            return Cause.isEmptyType(cause) ? Channel.unit : Channel.failCause(cause)
                          },
                          onSuccess: () =>
                            Channel.zipRight(
                              Channel.write(Chunk.map(
                                chunk as Chunk.Chunk<Exit.Success<any, any>>,
                                (_) => _.value
                              )),
                              loop
                            )
                        })
                      }
                    )

                  return Effect.as(
                    Request.succeed(request, Stream.fromChannel(loop) as any),
                    queue
                  )
                }

                return Effect.succeed(queue)
              }),
              Effect.zip(getDecodeChunk(request.request)(response)),
              Effect.flatMap(([queue, chunk]) => Queue.offer(queue, chunk))
            )
          }
        )
      ),
      Effect.catchAll(Effect.die),
      Effect.matchCauseEffect({
        onSuccess: () => {
          if (completed.size === requests.length) {
            return Effect.unit
          }
          return Effect.fiberIdWith((fiberId) =>
            Effect.forEach(
              requests.filter((_, index) => !completed.has(index)),
              (request) => Request.complete(request, Exit.interrupt(fiberId)),
              { discard: true }
            )
          )
        },
        onFailure: (cause) =>
          Effect.forEach(
            requests,
            (request, index) => {
              if (completed.has(index)) {
                return Effect.unit
              } else if (queues.has(index)) {
                return Queue.offer(
                  queues.get(index)!,
                  Chunk.of(Exit.failCause(cause))
                )
              }
              return Request.failCause(request, cause)
            },
            { discard: true }
          )
      }),
      Effect.uninterruptible
    )
  }) as any
}

/**
 * @since 1.0.0
 * @category combinators
 */
export const toClient = <RReq extends Schema.TaggedRequest.Any>(
  resolver: RequestResolver.RequestResolver<Rpc.Request<RReq>, never>
): <Req extends RReq>(request: Req) => Rpc.Rpc.Result<Req> =>
(request) => Rpc.call(request, resolver)
