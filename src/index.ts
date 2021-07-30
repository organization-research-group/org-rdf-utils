import * as N3 from 'n3'

const NAMESPACES = {
  rdf: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#',
}

const expandNS = nsExpander(NAMESPACES)

const rdfNil = expandNS('rdf:nil')
    , rdfFirst = expandNS('rdf:first')
    , rdfRest = expandNS('rdf:rest')
    , rdfType = expandNS('rdf:type')

type BlankOrNamedNode = N3.BlankNode | N3.NamedNode

function isBlankOrNamedNode(value: N3.Term | null): value is BlankOrNamedNode {
  return (
    N3.Util.isBlankNode(value) ||
    N3.Util.isNamedNode(value))
}

function isLiteral(value: N3.Term | null): value is N3.Literal {
  return N3.Util.isLiteral(value)
}

export async function parseToPromise(parser: N3.Parser, rdfString: string) {
  const quads: N3.Quad[] = []

  return new Promise<{ quads: N3.Quad[], prefixes: N3.Prefixes }>((resolve, reject) => {
    parser.parse(rdfString, (err, quad, prefixes) => {
      if (err) {
        reject(err);
      } else if (quad) {
        quads.push(quad);
      } else {
        resolve({ quads, prefixes })
      }
    })
  })
}

export function isType(store: N3.Store, type: N3.NamedNode, node: N3.NamedNode) {
  return store.some(() => true, node, rdfType, type, null)
}

export function getFirstObject(store: N3.Store, s: N3.OTerm, p: N3.OTerm) {
  const statement = findOne(store, s, p)

  return statement ? statement.object : null
}

export function getFirstObjectLiteral( store: N3.Store, s: N3.OTerm, p: N3.OTerm) {
  const object = getFirstObject(store, s, p)

  if (!isLiteral(object)) return null

  return object.value
}


export function findOne(
  store: N3.Store,
  s: N3.OTerm=null,
  p: N3.OTerm=null,
  o: N3.OTerm=null,
  g: N3.OTerm=null
) {
  let ret: null | N3.Quad = null

  store.some(statement => {
    ret = statement
    return true
  }, s, p, o, g)

  return ret as null | N3.Quad
}

export function rdfListToArray(store: N3.Store, headNode: N3.Term) {
  const arr: N3.Quad_Object[] = []

  if (!isBlankOrNamedNode(headNode)) {
    throw new Error(`Head node ${headNode} is not a blank node or named node`)
  }

  let _headNode = headNode

  while (!rdfNil.equals(_headNode)) {
    const listFirst = findOne(store, _headNode, rdfFirst)

    if (!listFirst) {
      throw new Error(`No triple matching ${JSON.stringify(_headNode)} rdf:first ?`)
    }

    arr.push(listFirst.object)

    const nextQuad = findOne(store, _headNode, rdfRest)

    if (!nextQuad) {
      throw new Error(`No triple matching ${_headNode} rdf:rest ?`)
    }

    const nextNode = nextQuad.object

    if (!isBlankOrNamedNode(nextNode)) {
      throw new Error(`The object in the triple ${_headNode} rdf:rest ? is not a blank or named node.`)
    }

    _headNode = nextNode
  }

  return arr;
}

export function nsExpander(prefixes: N3.Prefixes<string>) {
  const n3fn = N3.Util.prefixes(prefixes)

  function expandNS(arg: `${string}:${string}`): ReturnType<ReturnType<typeof n3fn>>  ;
  function expandNS(arg: string): ReturnType<typeof n3fn> ;
  function expandNS(arg: string): ReturnType<typeof n3fn> | ReturnType<ReturnType<typeof n3fn>> {
    const colonPos = arg.indexOf(':')

    return colonPos > -1
      ? n3fn(arg.slice(0, colonPos))(arg.slice(colonPos + 1))
      : n3fn(arg)
  }

  return Object.assign(expandNS, {
    prefixes,
    withPrefixes(extra: N3.Prefixes<string>) {
      return nsExpander({ ...prefixes, ...extra })
    },
  })
}

// Given a store and one or more nodes, return a new store that is a subset of
// the original. The new graph is constructed by starting with all the
// statements in the original graph where the given nodes are subjects. The
// original graph is then re-traversed to find all the statements where those
// objects are subjects, and so on, until all matching statements are exhausted.
export function makeSubgraphFrom(store: N3.Store, nodes: N3.Quad_Subject[]) {
  const newStore = new N3.Store()
      , subjs = [...nodes]

  while (subjs.length) {
    const subj = subjs.shift()!

    store.getQuads(subj, null, null, null).forEach(quad => {
      const { object } = quad

      newStore.addQuad(quad)

      if (isBlankOrNamedNode(object)) {
        subjs.push(object)
      }
    })
  }

  return newStore
}
