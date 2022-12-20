import { pipe } from "@fp-ts/data/Function"
import * as RA from "@fp-ts/data/ReadonlyArray"
import type { NonEmptyReadonlyArray } from "@fp-ts/data/ReadonlyArray"
import * as T from "@fp-ts/data/These"
import * as A from "@fp-ts/schema/Arbitrary"
import type * as DE from "@fp-ts/schema/DecodeError"
import * as D from "@fp-ts/schema/Decoder"
import * as UE from "@fp-ts/schema/Encoder"
import * as G from "@fp-ts/schema/Guard"
import type { Schema } from "@fp-ts/schema/Schema"
import * as fc from "fast-check"

export const property = <A>(schema: Schema<A>) => {
  const arbitrary = A.arbitraryFor(schema)
  const guard = G.guardFor(schema)
  const decoder = D.decoderFor(schema)
  const encoder = UE.encoderFor(schema)
  fc.assert(fc.property(arbitrary.arbitrary(fc), (a) => {
    if (!guard.is(a)) {
      return false
    }
    const roundtrip = decoder.decode(encoder.encode(a))
    if (D.isFailure(roundtrip)) {
      return false
    }
    return guard.is(roundtrip.right)
  }))
}

export const expectSuccess = <I, A>(decoder: D.Decoder<I, A>, i: I) => {
  const t = decoder.decode(i)
  expect(T.isRight(t)).toEqual(true)
  expect(t).toEqual(T.right(i))
}

export const expectFailure = <I, A>(decoder: D.Decoder<I, A>, i: I, message: string) => {
  const t = pipe(decoder.decode(i), T.mapLeft(formatAll))
  expect(T.isLeft(t)).toEqual(true)
  expect(t).toEqual(T.left(message))
}

export const expectWarning = <I, A>(decoder: D.Decoder<I, A>, i: I, message: string, a: A) => {
  const t = pipe(decoder.decode(i), T.mapLeft(formatAll))
  expect(T.isBoth(t)).toEqual(true)
  expect(t).toEqual(T.both(message, a))
}

const formatAll = (errors: NonEmptyReadonlyArray<DE.DecodeError>): string => {
  return pipe(errors, RA.map(format), RA.join(", "))
}

const format = (e: DE.DecodeError): string => {
  switch (e._tag) {
    case "Custom":
      return `${JSON.stringify(e.actual)} ${JSON.stringify(e.config)}`
    case "LessThan":
      return `${JSON.stringify(e.actual)} did not satisfy LessThan(${e.max})`
    case "LessThanOrEqualTo":
      return `${JSON.stringify(e.actual)} did not satisfy LessThanOrEqualTo(${e.max})`
    case "GreaterThan":
      return `${JSON.stringify(e.actual)} did not satisfy GreaterThan(${e.min})`
    case "GreaterThanOrEqualTo":
      return `${JSON.stringify(e.actual)} did not satisfy GreaterThanOrEqualTo(${e.min})`
    case "MaxLength":
      return `${JSON.stringify(e.actual)} did not satisfy MaxLength(${e.maxLength})`
    case "MinLength":
      return `${JSON.stringify(e.actual)} did not satisfy MinLength(${e.minLength})`
    case "NaN":
      return `did not satisfy not(isNaN)`
    case "NotFinite":
      return `did not satisfy isFinite`
    case "NotType":
      return `${JSON.stringify(e.actual)} did not satisfy is(${e.expected})`
    case "NotEqual":
      return `${JSON.stringify(e.actual)} did not satisfy isEqual(${String(e.expected)})`
    case "NotEnums":
      return `${JSON.stringify(e.actual)} did not satisfy isEnum(${JSON.stringify(e.enums)})`
    case "Index":
      return `/${e.index} ${pipe(e.errors, RA.map(format), RA.join(", "))}`
    case "Key":
      return `/${String(e.key)} ${pipe(e.errors, RA.map(format), RA.join(", "))}`
    case "Missing":
      return `did not satisfy is(required)`
    case "UnexpectedKey":
      return `/${String(e.key)} key is unexpected`
    case "UnexpectedIndex":
      return `/${String(e.index)} index is unexpected`
    case "Member":
      return `member: ${pipe(e.errors, RA.map(format), RA.join(", "))}`
  }
}

type Forest<A> = Array<Tree<A>>

export interface Tree<A> {
  value: A
  forest: Forest<A>
}

function make<A>(value: A, forest: Forest<A> = []): Tree<A> {
  return {
    value,
    forest
  }
}

const draw = (indentation: string, forest: Forest<string>): string => {
  let r = ""
  const len = forest.length
  let tree: Tree<string>
  for (let i = 0; i < len; i++) {
    tree = forest[i]
    const isLast = i === len - 1
    r += indentation + (isLast ? "└" : "├") + "─ " + tree.value
    r += draw(indentation + (len > 1 && !isLast ? "│  " : "   "), tree.forest)
  }
  return r
}

function drawForest(forest: Forest<string>): string {
  return draw("\n", forest)
}

function drawTree(tree: Tree<string>): string {
  return tree.value + drawForest(tree.forest)
}

const toTree = (errors: NonEmptyReadonlyArray<DE.DecodeError>): Tree<string> => {
  return make(`${errors.length} error(s) found`, errors.map(go))
}

const go = (e: DE.DecodeError): Tree<string> => {
  switch (e._tag) {
    case "Custom":
      return make(`${JSON.stringify(e.actual)} ${JSON.stringify(e.config)}`)
    case "LessThan":
      return make(`${JSON.stringify(e.actual)} did not satisfy LessThan(${e.max})`)
    case "LessThanOrEqualTo":
      return make(`${JSON.stringify(e.actual)} did not satisfy LessThanOrEqualTo(${e.max})`)
    case "GreaterThan":
      return make(`${JSON.stringify(e.actual)} did not satisfy GreaterThan(${e.min})`)
    case "GreaterThanOrEqualTo":
      return make(`${JSON.stringify(e.actual)} did not satisfy GreaterThanOrEqualTo(${e.min})`)
    case "MaxLength":
      return make(`${JSON.stringify(e.actual)} did not satisfy MaxLength(${e.maxLength})`)
    case "MinLength":
      return make(`${JSON.stringify(e.actual)} did not satisfy MinLength(${e.minLength})`)
    case "NaN":
      return make(`did not satisfy not(isNaN)`)
    case "NotFinite":
      return make(`did not satisfy isFinite`)
    case "NotType":
      return make(`${JSON.stringify(e.actual)} did not satisfy is(${e.expected})`)
    case "NotEqual":
      return make(
        `${JSON.stringify(e.actual)} did not satisfy isEqual(${JSON.stringify(e.expected)})`
      )
    case "NotEnums":
      return make(`${JSON.stringify(e.actual)} did not satisfy isEnum(${JSON.stringify(e.enums)})`)
    case "Index":
      return make(`index ${e.index}`, e.errors.map(go))
    case "UnexpectedIndex":
      return make(`${String(e.index)} index is unexpected`)
    case "Key":
      return make(`key ${String(e.key)}`, e.errors.map(go))
    case "Missing":
      return make(`did not satisfy not(isNaN)`)
    case "UnexpectedKey":
      return make(`${String(e.key)} key is unexpected`)
    case "Member":
      return make(`union member`, e.errors.map(go))
  }
}

const formatTree = (errors: NonEmptyReadonlyArray<DE.DecodeError>): string => {
  return drawTree(toTree(errors))
}

export const expectFailureTree = <I, A>(decoder: D.Decoder<I, A>, i: I, message: string) => {
  const t = pipe(decoder.decode(i), T.mapLeft(formatTree))
  expect(T.isLeft(t)).toEqual(true)
  expect(t).toEqual(T.left(message))
}

export const expectWarningTree = <I, A>(decoder: D.Decoder<I, A>, i: I, message: string, a: A) => {
  const t = pipe(decoder.decode(i), T.mapLeft(formatTree))
  expect(T.isBoth(t)).toEqual(true)
  expect(t).toEqual(T.both(message, a))
}