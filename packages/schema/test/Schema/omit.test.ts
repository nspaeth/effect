import * as S from "@effect/schema/Schema"
import * as Util from "@effect/schema/test/util"
import { describe, expect, it } from "vitest"

describe("Schema > omit", () => {
  it("struct", async () => {
    const a = Symbol.for("@effect/schema/test/a")
    const schema = S.struct({ [a]: S.string, b: S.NumberFromString, c: S.boolean }).pipe(
      S.omit("c")
    )
    await Util.expectDecodeUnknownSuccess(schema, { [a]: "a", b: "1" }, { [a]: "a", b: 1 })

    await Util.expectDecodeUnknownFailure(
      schema,
      null,
      "Expected { Symbol(@effect/schema/test/a): string; b: NumberFromString }, actual null"
    )
    await Util.expectDecodeUnknownFailure(
      schema,
      { [a]: "a" },
      `{ Symbol(@effect/schema/test/a): string; b: NumberFromString }
└─ ["b"]
   └─ is missing`
    )
    await Util.expectDecodeUnknownFailure(
      schema,
      { b: 1 },
      `{ Symbol(@effect/schema/test/a): string; b: NumberFromString }
└─ [Symbol(@effect/schema/test/a)]
   └─ is missing`
    )
  })

  it("struct with optionals", async () => {
    const schema = S.struct({
      a: S.optional(S.string, { exact: true }),
      b: S.NumberFromString,
      c: S.boolean
    })
      .pipe(
        S.omit("c")
      )
    await Util.expectDecodeUnknownSuccess(schema, { a: "a", b: "1" }, { a: "a", b: 1 })
    await Util.expectDecodeUnknownSuccess(schema, { b: "1" }, { b: 1 })

    await Util.expectDecodeUnknownFailure(
      schema,
      null,
      "Expected { a?: string; b: NumberFromString }, actual null"
    )
    await Util.expectDecodeUnknownFailure(
      schema,
      { a: "a" },
      `{ a?: string; b: NumberFromString }
└─ ["b"]
   └─ is missing`
    )
  })

  it("suspend", async () => {
    interface A {
      readonly a: string
      readonly as: ReadonlyArray<A>
    }
    const A: S.Schema<A> = S.suspend( // intended outer suspend
      () =>
        S.struct({
          a: S.string,
          as: S.array(A)
        })
    )
    const schema = A.pipe(S.omit("a"))
    await Util.expectDecodeUnknownSuccess(schema, { as: [] })
    await Util.expectDecodeUnknownSuccess(schema, { as: [{ a: "a", as: [] }] })

    await Util.expectDecodeUnknownFailure(
      schema,
      { as: [{ as: [] }] },
      `{ as: ReadonlyArray<<suspended schema>> }
└─ ["as"]
   └─ ReadonlyArray<<suspended schema>>
      └─ [0]
         └─ { a: string; as: ReadonlyArray<<suspended schema>> }
            └─ ["a"]
               └─ is missing`
    )
  })

  it("struct with property signature transformations", async () => {
    const schema = S.struct({
      a: S.optional(S.string, { exact: true, default: () => "" }),
      b: S.NumberFromString,
      c: S.boolean
    }).pipe(
      S.omit("c")
    )
    await Util.expectDecodeUnknownSuccess(schema, { a: "a", b: "1" }, { a: "a", b: 1 })
    await Util.expectDecodeUnknownSuccess(schema, { b: "1" }, { a: "", b: 1 })
  })

  it("typeSchema(Class)", () => {
    class A extends S.Class<A>("A")({ a: S.string, b: S.NumberFromString }) {}
    const schema = A.pipe(S.typeSchema, S.omit("a"))
    expect(schema.ast).toStrictEqual(S.struct({ b: S.number }).ast)
  })

  it("Class", () => {
    class A extends S.Class<A>("A")({ a: S.string, b: S.NumberFromString }) {}
    const schema = A.pipe(S.omit("a"))
    expect(schema.ast).toStrictEqual(S.struct({ b: S.NumberFromString }).ast)
  })

  it("struct with key rename", async () => {
    const schema = S.struct({
      a: S.string,
      b: S.propertySignature(S.number).pipe(S.fromKey("c"))
    }).pipe(S.omit("a"))
    await Util.expectDecodeUnknownSuccess(schema, { c: 1 }, { b: 1 })
  })

  it("rename", async () => {
    const schema = S.struct({
      a: S.string,
      c: S.number
    }).pipe(S.rename({ c: "b" }), S.omit("a"))
    await Util.expectDecodeUnknownSuccess(schema, { c: 1 }, { b: 1 })
  })
})
