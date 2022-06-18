/**
 * Switches to the provided stream in case this one fails with the `None`
 * value.
 *
 * See also `Stream.catchAll`.
 *
 * @tsplus fluent ets/Stream orElseOptional
 */
export function orElseOptional_<R, E, A, R2, E2, A2>(
  self: Stream<R, Maybe<E>, A>,
  that: LazyArg<Stream<R2, Maybe<E2>, A2>>,
  __tsplusTrace?: string
): Stream<R | R2, Maybe<E | E2>, A | A2> {
  return self.catchAll((option) => option.fold(that, (e) => Stream.fail(Maybe.some<E | E2>(e))))
}

/**
 * Switches to the provided stream in case this one fails with the `None`
 * value.
 *
 * See also `Stream.catchAll`.
 *
 * @tsplus static ets/Stream/Aspects orElseOptional
 */
export const orElseOptional = Pipeable(orElseOptional_)
