import { concreteStream, StreamInternal } from "@effect/core/stream/Stream/operations/_internal/StreamInternal"

/**
 * Zips each element with the next element if present.
 *
 * @tsplus fluent ets/Stream zipWithNext
 */
export function zipWithNext<R, E, A>(
  self: Stream<R, E, A>,
  __tsplusTrace?: string
): Stream<R, E, Tuple<[A, Maybe<A>]>> {
  concreteStream(self)
  return new StreamInternal(self.channel >> process<E, A>(Maybe.none))
}

function process<E, A>(
  last: Maybe<A>,
  __tsplusTrace?: string
): Channel<never, E, Chunk<A>, unknown, E, Chunk<Tuple<[A, Maybe<A>]>>, void> {
  return Channel.readWith(
    (input: Chunk<A>) => {
      const {
        tuple: [newLast, chunk]
      } = input.mapAccum(last, (prev, curr) =>
        Tuple(
          Maybe.some(curr),
          prev.map((a) => Tuple(a, curr))
        ))
      const out = chunk.collect((option) =>
        option.isSome()
          ? Maybe.some(Tuple(option.value.get(0), Maybe.some(option.value.get(1))))
          : Maybe.none
      )
      return Channel.write(out) > process<E, A>(newLast)
    },
    (err: E) => Channel.fail(err),
    () =>
      last.fold(
        Channel.unit,
        (a) => Channel.write(Chunk.single(Tuple(a, Maybe.none))) > Channel.unit
      )
  )
}
