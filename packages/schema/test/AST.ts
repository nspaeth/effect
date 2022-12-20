import * as O from "@fp-ts/data/Option"
import * as AST from "@fp-ts/schema/AST"
import * as DataChunk from "@fp-ts/schema/data/Chunk"
import * as DataOption from "@fp-ts/schema/data/Option"
import * as S from "@fp-ts/schema/Schema"

const stringKeyword = AST.stringKeyword([])
const numberKeyword = AST.numberKeyword([])
const booleanKeyword = AST.booleanKeyword([])
const undefinedKeyword = AST.undefinedKeyword([])
const neverKeyword = AST.neverKeyword([])

describe.concurrent("AST", () => {
  describe.concurrent("partial", () => {
    describe.concurrent("tuple", () => {
      it("elements only", () => {
        // type A = [string]
        // type B = Partial<A>
        const tuple = AST.tuple([AST.element(stringKeyword, false, [])], O.none, true, [])
        expect(AST.partial(tuple, [])).toEqual(
          AST.tuple([AST.element(stringKeyword, true, [])], O.none, true, [])
        )
      })

      it("elements and rest", () => {
        // type A = readonly [string, ...Array<number>]
        // type B = Partial<A>
        const tuple = AST.tuple(
          [AST.element(stringKeyword, false, [])],
          O.some([numberKeyword]),
          true,
          []
        )
        expect(AST.partial(tuple, [])).toEqual(
          AST.tuple(
            [AST.element(stringKeyword, true, [])],
            O.some([AST.union([numberKeyword, undefinedKeyword], [])]),
            true,
            []
          )
        )
      })

      it("elements and rest elements", () => {
        const tuple = AST.tuple(
          [AST.element(stringKeyword, false, [])],
          O.some([numberKeyword, booleanKeyword]),
          true,
          []
        )
        expect(AST.partial(tuple, [])).toEqual(
          AST.tuple(
            [AST.element(stringKeyword, true, [])],
            O.some([AST.union([numberKeyword, booleanKeyword, undefinedKeyword], [])]),
            true,
            []
          )
        )
      })
    })
  })

  describe.concurrent("appendRestElement", () => {
    /*
    type Rest<A extends ReadonlyArray<any>, R> = readonly [...A, ...Array<R>]
    type Test1 = Rest<readonly [string], number>
    type Test2 = Rest<Test1, boolean>
    type Test3 = Rest<readonly [string, ...Array<number>, string], boolean>
    type Test4 = Rest<readonly [string, ...Array<number>, boolean], bigint>
    */

    it("non existing rest element", () => {
      const tuple = AST.tuple([AST.element(stringKeyword, false, [])], O.none, true, [])
      const actual = AST.appendRestElement(tuple, numberKeyword, [])
      expect(actual).toEqual(
        AST.tuple([AST.element(stringKeyword, false, [])], O.some([numberKeyword]), true, [])
      )
    })

    it("multiple `rest` calls must result in a union", () => {
      const tuple = AST.tuple([AST.element(stringKeyword, false, [])], O.none, true, [])
      const actual1 = AST.appendRestElement(tuple, numberKeyword, [])
      const actual2 = AST.appendRestElement(actual1, booleanKeyword, [])
      expect(actual2).toEqual(
        AST.tuple(
          [AST.element(stringKeyword, false, [])],
          O.some([AST.union([numberKeyword, booleanKeyword], [])]),
          true,
          []
        )
      )
    })
  })

  describe.concurrent("appendElement", () => {
    it("non existing rest element", () => {
      const tuple = AST.tuple([AST.element(stringKeyword, false, [])], O.none, true, [])
      expect(AST.appendElement(tuple, AST.element(numberKeyword, false, []), [])).toEqual(
        AST.tuple(
          [AST.element(stringKeyword, false, []), AST.element(numberKeyword, false, [])],
          O.none,
          true,
          []
        )
      )
    })

    it("existing rest element", () => {
      const tuple = AST.tuple(
        [AST.element(stringKeyword, false, [])],
        O.some([numberKeyword]),
        true,
        []
      )
      expect(AST.appendElement(tuple, AST.element(booleanKeyword, false, []), [])).toEqual(
        AST.tuple(
          [AST.element(stringKeyword, false, [])],
          O.some([numberKeyword, booleanKeyword]),
          true,
          []
        )
      )
    })

    it("A required element cannot follow an optional element", () => {
      const tuple = AST.tuple([AST.element(stringKeyword, true, [])], O.none, true, [])
      expect(() => AST.appendElement(tuple, AST.element(numberKeyword, false, []), []))
        .toThrowError(
          new Error("A required element cannot follow an optional element. ts(1257)")
        )
    })

    it("An optional element cannot follow a rest element", () => {
      const tuple = AST.tuple([], O.some([stringKeyword]), true, [])
      expect(() => AST.appendElement(tuple, AST.element(numberKeyword, true, []), [])).toThrowError(
        new Error("An optional element cannot follow a rest element. ts(1266)")
      )
    })
  })

  describe.concurrent("struct", () => {
    describe.concurrent("should give precedence to fields / index signatures containing less inhabitants", () => {
      it("literal vs string", () => {
        const schema = S.struct({ a: S.string, b: S.literal("b") })
        expect(schema.ast).toEqual({
          _tag: "Struct",
          fields: [
            AST.field("b", AST.literalType("b", []), false, true, []),
            AST.field("a", stringKeyword, false, true, [])
          ],
          indexSignatures: [],
          annotations: []
        })
      })

      it("undefined vs string", () => {
        const schema = S.struct({ a: S.string, b: S.undefined })
        expect(schema.ast).toEqual({
          _tag: "Struct",
          fields: [
            AST.field("b", undefinedKeyword, false, true, []),
            AST.field("a", stringKeyword, false, true, [])
          ],
          indexSignatures: [],
          annotations: []
        })
      })

      it("boolean vs string", () => {
        const schema = S.struct({ a: S.string, b: S.boolean })
        expect(schema.ast).toEqual({
          _tag: "Struct",
          fields: [
            AST.field("b", booleanKeyword, false, true, []),
            AST.field("a", stringKeyword, false, true, [])
          ],
          indexSignatures: [],
          annotations: []
        })
      })

      it("literal vs boolean", () => {
        const schema = S.struct({ a: S.boolean, b: S.literal(null) })
        expect(schema.ast).toEqual({
          _tag: "Struct",
          fields: [
            AST.field("b", AST.literalType(null, []), false, true, []),
            AST.field("a", booleanKeyword, false, true, [])
          ],
          indexSignatures: [],
          annotations: []
        })
      })
    })
  })

  describe.concurrent("union", () => {
    describe.concurrent("should give precedence to schemas containing more infos", () => {
      it("1 required vs 2 required", () => {
        const a = S.struct({ a: S.string })
        const ab = S.struct({ a: S.string, b: S.number })
        const schema = S.union(a, ab)
        expect(schema.ast).toEqual({
          _tag: "Union",
          members: [ab.ast, a.ast],
          annotations: []
        })
      })

      it("1 required vs 2 optional", () => {
        const a = S.struct({ a: S.string })
        const ab = S.struct({ a: S.optional(S.string), b: S.optional(S.number) })
        const schema = S.union(a, ab)
        expect(schema.ast).toEqual({
          _tag: "Union",
          members: [ab.ast, a.ast],
          annotations: []
        })
      })
    })

    describe.concurrent("should remove duplicated ASTs", () => {
      it("plain", () => {
        const a = S.literal("a")
        const schema = S.union(a, a)
        expect(schema.ast).toEqual(a.ast)
      })

      it("nested", () => {
        const a = S.literal("a")
        const b = S.literal("b")
        const schema = S.union(a, b, S.union(a, b))
        expect(schema.ast).toEqual(S.union(a, b).ast)
      })
    })
  })

  describe.concurrent("keyof", () => {
    it("TypeAliasDeclaration", () => {
      // type Test = keyof Chunk<number> // id
      expect(AST.keyof(DataChunk.schema(S.number).ast)).toEqual(["_id"])
    })

    it("TypeAliasDeclaration", () => {
      // type Test = keyof O.Option<number> // "_tag"
      expect(AST.keyof(DataOption.schema(S.number).ast)).toEqual(["_tag"])
    })

    it("tuple", () => {
      // type Test = keyof [] // never
      expect(AST.keyof(S.tuple().ast)).toEqual([])
      // type Test = keyof [string, number] // '0' | '1'
      expect(AST.keyof(S.tuple(S.string, S.number).ast)).toEqual(["0", "1"])
    })

    it("struct", () => {
      // type Test = keyof {} // never
      expect(AST.keyof(S.struct({}).ast)).toEqual([])
      // type Test = keyof { a: string, b: number } // 'a' | 'b'
      expect(AST.keyof(S.struct({ a: S.string, b: S.number }).ast)).toEqual(["a", "b"])

      const a = Symbol.for("@fp-ts/schema/test/a")
      // type Test = keyof { [a]: string } // typeof A
      expect(AST.keyof(S.struct({ [a]: S.string }).ast)).toEqual([a])
    })

    describe.concurrent("union", () => {
      it("empty union", () => {
        const schema = S.union()
        expect(AST.keyof(schema.ast)).toEqual(AST.keyof(neverKeyword))
      })

      it("discriminated unions", () => {
        const schema = S.union(
          S.struct({ _tag: S.literal("A"), a: S.string }),
          S.struct({ _tag: S.literal("B"), b: S.number })
        )
        expect(AST.keyof(schema.ast)).toEqual(["_tag"])
      })
    })

    it("lazy", () => {
      // type Test = keyof A // 'a' | 'as'
      interface A {
        readonly a: string
        readonly as: ReadonlyArray<A>
      }
      const schema: S.Schema<A> = S.lazy<A>(() =>
        S.struct({
          a: S.string,
          as: S.array(schema)
        })
      )
      expect(AST.keyof(schema.ast)).toEqual(["a", "as"])
    })
  })

  describe.concurrent("getFields", () => {
    it("type alias", () => {
      const schema = DataOption.schema(S.number)
      expect(AST.getFields(schema.ast)).toEqual([
        AST.field("_tag", S.union(S.literal("Some"), S.literal("None")).ast, false, true, [])
      ])
    })

    it("tuple", () => {
      const schema = S.tuple(S.string, S.number)
      expect(AST.getFields(schema.ast)).toEqual([
        AST.field(0, S.string.ast, false, true, []),
        AST.field(1, S.number.ast, false, true, [])
      ])
    })

    describe.concurrent("struct", () => {
      it("string keys", () => {
        const schema = S.struct({ a: S.string, b: S.number })
        expect(AST.getFields(schema.ast)).toEqual([
          AST.field("a", S.string.ast, false, true, []),
          AST.field("b", S.number.ast, false, true, [])
        ])
      })

      it("symbol keys", () => {
        const a = Symbol.for("@fp-ts/schema/test/a")
        const b = Symbol.for("@fp-ts/schema/test/b")
        const schema = S.struct({ [a]: S.string, [b]: S.number })
        expect(AST.getFields(schema.ast)).toEqual([
          AST.field(a, S.string.ast, false, true, []),
          AST.field(b, S.number.ast, false, true, [])
        ])
      })
    })

    describe.concurrent("union", () => {
      it("required fields", () => {
        const schema = S.union(
          S.struct({ a: S.string, b: S.number }),
          S.struct({ a: S.boolean, c: S.boolean })
        )
        expect(AST.getFields(schema.ast)).toEqual([
          AST.field("a", AST.union([S.string.ast, S.boolean.ast], []), false, true, [])
        ])
      })

      it("optional fields", () => {
        const schema = S.union(
          S.struct({ a: S.string, b: S.number }),
          S.struct({ c: S.boolean, a: S.optional(S.boolean) })
        )
        expect(AST.getFields(schema.ast)).toEqual([
          AST.field("a", AST.union([S.string.ast, S.boolean.ast], []), true, true, [])
        ])
      })
    })

    it("lazy", () => {
      interface Category {
        readonly name: string
        readonly categories: ReadonlyArray<Category>
      }
      const Category: S.Schema<Category> = S.lazy<Category>(
        () =>
          S.struct({
            name: S.string,
            categories: S.array(Category)
          })
      )
      expect(AST.getFields(Category.ast)).toEqual([
        AST.field("name", S.string.ast, false, true, []),
        AST.field("categories", AST.tuple([], O.some([Category.ast]), true, []), false, true, [])
      ])
    })
  })
})