describe.concurrent("Sink", () => {
  describe.concurrent("take", () => {
    it("should take the specified number of elements", () =>
      Do(($) => {
        const n = 4
        const chunks = Chunk(Chunk(1, 2, 3), Chunk(4, 5), Chunk(6, 7, 8, 9))
        const sink = Sink.take<number>(n)
        const stream = Stream.fromChunks(...chunks).peel(sink).flatMap((
          { tuple: [chunk, stream] }
        ) => stream.runCollect.map((leftover) => Tuple(chunk, leftover)))
        const result = $(Effect.scoped(stream))
        const { tuple: [chunk, leftover] } = result
        assert.isTrue(chunk == chunks.flatten.take(n))
        assert.isTrue(leftover == chunks.flatten.drop(n))
      }).unsafeRunPromise())
  })
})