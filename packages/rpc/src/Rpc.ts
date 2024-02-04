/**
 * @since 1.0.0
 */
import * as Schema from "@effect/schema/Schema"
import type * as Serializable from "@effect/schema/Serializable"
import * as Effect from "effect/Effect"
import * as Equal from "effect/Equal"
import * as FiberRef from "effect/FiberRef"
import { dual, pipe } from "effect/Function"
import { globalValue } from "effect/GlobalValue"
import * as Hash from "effect/Hash"
import { type Pipeable, pipeArguments } from "effect/Pipeable"
import * as Predicate from "effect/Predicate"
import type * as ReadonlyRecord from "effect/ReadonlyRecord"
import * as EffectRequest from "effect/Request"
import type * as RequestResolver from "effect/RequestResolver"
import type { Scope } from "effect/Scope"
import * as Stream from "effect/Stream"
import type * as Types from "effect/Types"
import * as Internal from "./internal/rpc.js"

/**
 * @since 1.0.0
 * @category type ids
 */
export const TypeId = Symbol.for("@effect/rpc/Rpc")

/**
 * @since 1.0.0
 * @category type ids
 */
export type TypeId = typeof TypeId

/**
 * @since 1.0.0
 * @category refinements
 */
export const isRpc = (u: unknown): u is Rpc<any, any> => Predicate.hasProperty(u, TypeId)

/**
 * @since 1.0.0
 * @category models
 */
export type Rpc<R, Req extends Schema.TaggedRequest.Any> = RpcEffect<R, Req> | RpcStream<R, Req>

/**
 * @since 1.0.0
 * @category models
 */
export interface RpcEffect<R, Req extends Schema.TaggedRequest.Any> extends Rpc.Proto<Req> {
  readonly _tag: "Effect"
  readonly handler: (
    request: Req
  ) => Effect.Effect<
    EffectRequest.Request.Success<Req>,
    EffectRequest.Request.Error<Req>,
    R
  >
}

/**
 * @since 1.0.0
 * @category models
 */
export interface RpcStream<R, Req extends Schema.TaggedRequest.Any> extends Rpc.Proto<Req> {
  readonly _tag: "Stream"
  readonly handler: (
    request: Req
  ) => Stream.Stream<
    R,
    Req extends Serializable.WithResult<infer _R, infer _IE, infer E, infer _IA, infer _A> ? E : never,
    Req extends Serializable.WithResult<infer _R, infer _IE, infer _E, infer _IA, infer A> ? A : never
  >
}

/**
 * @since 1.0.0
 * @category models
 */
export declare namespace Rpc {
  /**
   * @since 1.0.0
   * @category models
   */
  export interface Proto<Req extends Schema.TaggedRequest.Any> extends Pipeable {
    readonly [TypeId]: TypeId
    readonly _tag: string
    readonly schema: Schema.Schema<Req, unknown, any>
  }

  /**
   * @since 1.0.0
   * @category models
   */
  export type Context<A extends Rpc<any, any>> = A extends Rpc<infer R, infer Req>
    ? R | Serializable.SerializableWithResult.Context<Req>
    : never

  /**
   * @since 1.0.0
   * @category models
   */
  export type Request<A extends Rpc<any, any>> = Schema.Schema.To<A["schema"]>

  /**
   * @since 1.0.0
   * @category models
   */
  export type Result<A extends Schema.TaggedRequest.Any, R = never> = EffectRequest.Request.Success<A> extends
    Stream.Stream<infer _R, infer E, infer A> ? Stream.Stream<R, E, A>
    : Effect.Effect<EffectRequest.Request.Success<A>, EffectRequest.Request.Error<A>, R>
}

/**
 * @since 1.0.0
 * @category constructors
 */
export const effect = <Req extends Schema.TaggedRequest.Any, SR, I, R>(
  schema: Schema.Schema<Req, I, SR>,
  handler: (request: Req) => Effect.Effect<EffectRequest.Request.Success<Req>, EffectRequest.Request.Error<Req>, R>
): Rpc<R, Req> => ({
  [TypeId]: TypeId,
  _tag: "Effect",
  schema: schema as any,
  handler,
  pipe() {
    return pipeArguments(this, arguments)
  }
})

/**
 * @since 1.0.0
 * @category schemas
 */
export interface StreamRequest<Tag extends string, R, IS, S, RR, IE, E, IA, A>
  extends
    EffectRequest.Request<never, Stream.Stream<never, E, A>>,
    Serializable.SerializableWithResult<R, IS, S, RR, IE, E, IA, A>
{
  readonly _tag: Tag
}

/**
 * @since 1.0.0
 * @category schemas
 */
export declare namespace StreamRequest {
  /**
   * @since 1.0.0
   * @category schemas
   */
  export type Any =
    | StreamRequest<string, any, any, any, any, any, any, any, any>
    | StreamRequest<string, any, any, any, any, never, never, any, any>
}

/**
 * @since 1.0.0
 * @category schemas
 */
export interface StreamRequestConstructor<Tag extends string, Self, R, IS, S, RR, IE, E, IA, A>
  extends Schema.Schema<Self, Types.Simplify<IS & { readonly _tag: Tag }>, R>
{
  new(
    props: Types.Equals<S, {}> extends true ? void : S,
    disableValidation?: boolean
  ): StreamRequest<Tag, R, IS & { readonly _tag: Tag }, Self, RR, IE, E, IA, A> & S
}

/**
 * @since 1.0.0
 * @category schemas
 */
export const StreamRequest = <Self>() =>
<Tag extends string, E, IE, RE, A, IA, RA, Fields extends Schema.StructFields>(
  tag: Tag,
  failure: Schema.Schema<E, IE, RE>,
  success: Schema.Schema<A, IA, RA>,
  fields: Fields
): StreamRequestConstructor<
  Tag,
  Self,
  Schema.Schema.Context<Fields[keyof Fields]>,
  Types.Simplify<Schema.FromStruct<Fields>>,
  Types.Simplify<Schema.ToStruct<Fields>>,
  RE | RA,
  IE,
  E,
  IA,
  A
> => {
  return class extends (Schema.TaggedRequest<{}>()(tag, failure, success, fields) as any) {
    constructor(props: any, disableValidation?: boolean) {
      super(props, disableValidation)
      ;(this as any)[Internal.StreamRequestTypeId] = Internal.StreamRequestTypeId
    }
  } as any
}

/**
 * @since 1.0.0
 * @category constructors
 */
export const stream = <Req extends StreamRequest.Any, I, SR, R>(
  schema: Schema.Schema<Req, I, SR>,
  handler: (
    request: Req
  ) => Stream.Stream<
    R,
    Req extends Serializable.WithResult<infer _R, infer _IE, infer E, infer _IA, infer _A> ? E : never,
    Req extends Serializable.WithResult<infer _R, infer _IE, infer _E, infer _IA, infer A> ? A : never
  >
): Rpc<R, Req> => ({
  [TypeId]: TypeId,
  _tag: "Stream",
  schema: schema as any,
  handler,
  pipe() {
    return pipeArguments(this, arguments)
  }
})

/**
 * @since 1.0.0
 * @category models
 */
export interface Request<A extends (Schema.TaggedRequest.Any)> extends
  EffectRequest.Request<
    EffectRequest.Request.Error<A>,
    EffectRequest.Request.Success<A>
  >
{
  readonly request: A
  readonly traceId: string
  readonly spanId: string
  readonly sampled: boolean
  readonly headers: Record<string, string>
}

/**
 * @since 1.0.0
 * @category models
 */
export interface RequestFrom<A> {
  readonly request: A
  readonly traceId: string
  readonly spanId: string
  readonly sampled: boolean
  readonly headers: Record<string, string>
}

/**
 * @since 1.0.0
 * @category schemas
 */
export const RequestSchema = <A, I, R>(
  schema: Schema.Schema<A, I, R>
): Schema.Schema<RequestFrom<A>, RequestFrom<I>, R> =>
  Schema.struct({
    request: schema,
    traceId: Schema.string,
    spanId: Schema.string,
    sampled: Schema.boolean,
    headers: Schema.record(Schema.string, Schema.string)
  })

/**
 * @since 1.0.0
 * @category headers
 */
export interface Headers {
  readonly _: unique symbol
}

/**
 * @since 1.0.0
 * @category headers
 */
export const currentHeaders: FiberRef.FiberRef<ReadonlyRecord.ReadonlyRecord<string>> = globalValue(
  "@effect/rpc/Rpc/Headers",
  () => FiberRef.unsafeMake<ReadonlyRecord.ReadonlyRecord<string>>({})
)

/**
 * @since 1.0.0
 * @category headers
 */
export const annotateHeaders: {
  (headers: ReadonlyRecord.ReadonlyRecord<string>): <A, E, R>(self: Effect.Effect<A, E, R>) => Effect.Effect<A, E, R>
  <A, E, R>(self: Effect.Effect<A, E, R>, headers: ReadonlyRecord.ReadonlyRecord<string>): Effect.Effect<A, E, R>
} = dual<
  (headers: ReadonlyRecord.ReadonlyRecord<string>) => <A, E, R>(self: Effect.Effect<A, E, R>) => Effect.Effect<A, E, R>,
  <A, E, R>(self: Effect.Effect<A, E, R>, headers: ReadonlyRecord.ReadonlyRecord<string>) => Effect.Effect<A, E, R>
>(2, (self, headers) => Effect.locallyWith(self, currentHeaders, (prev) => ({ ...prev, ...headers })))

/**
 * @since 1.0.0
 * @category requests
 */
export const request = <A extends Schema.TaggedRequest.Any>(
  request: A
): Effect.Effect<Request<A>, never, Scope> =>
  pipe(
    Effect.makeSpanScoped(`Rpc.request ${request._tag}`),
    Effect.zip(FiberRef.get(currentHeaders)),
    Effect.map(([span, headers]) => ({
      request,
      traceId: span.traceId,
      spanId: span.spanId,
      sampled: span.sampled,
      headers,
      [EffectRequest.RequestTypeId]: undefined as any,
      [Equal.symbol](that: Request<A>) {
        return Equal.equals(request, that.request)
      },
      [Hash.symbol]() {
        return Hash.hash(request)
      }
    }))
  )

/**
 * @since 1.0.0
 * @category requests
 */
export const call = <A extends Schema.TaggedRequest.Any>(
  req: A,
  resolver: RequestResolver.RequestResolver<Request<A>>
): Rpc.Result<A> => {
  const isStream = Internal.StreamRequestTypeId in req
  const res = pipe(
    request(req),
    Effect.flatMap((_) => Effect.request(_, resolver))
  )
  return isStream ? Stream.unwrapScoped(res as any) : Effect.scoped(res) as any
}