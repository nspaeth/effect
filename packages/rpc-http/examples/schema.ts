import * as S from "@effect/schema/Schema"
import { pipe } from "effect/Function"
// @ts-ignore
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import type { Brand } from "effect/Brand"
// @ts-ignore
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import type { Chunk } from "effect/Chunk"

export const UserId = pipe(S.number, S.int(), S.brand("UserId"))
export type UserId = S.Schema.To<typeof UserId>

const User = S.struct({
  id: UserId,
  name: S.string
})

export class GetUserIds extends S.TaggedRequest<GetUserIds>()("GetUserIds", S.never, S.array(UserId), {}) {}
export class GetUser extends S.TaggedRequest<GetUser>()("GetUser", S.never, User, {
  id: UserId
}) {}
