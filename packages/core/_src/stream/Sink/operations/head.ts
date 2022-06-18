/**
 * Creates a sink containing the first value.
 *
 * @tsplus static ets/Sink/Ops head
 */
export function head<In>(
  __tsplusTrace?: string
): Sink<never, never, In, In, Maybe<In>> {
  return Sink.fold(
    Maybe.emptyOf<In>(),
    (option: Maybe<In>) => option.isNone(),
    (option: Maybe<In>, input) => (option.isSome() ? option : Maybe.some(input))
  )
}
