"use strict";

const N3 = require('n3')

const NAMESPACES = {
  rdf: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#'
}

const expandNS = nsExpander(NAMESPACES)

const rdfNil = expandNS('rdf:nil')
    , rdfFirst = expandNS('rdf:first')
    , rdfRest = expandNS('rdf:rest')

async function parseToPromise(parser, rdfString) {
  const store = new N3.Store()
      , quads = []

  return new Promise((resolve, reject) => {
    parser.parse(rdfString, (err, quad, prefixes) => {
      if (err) {
        reject(err);
      } else if (quad) {
        quads.push(quad);
      } else {
        resolve({ quads, prefixes });
      }
    })
  })
}

function isType(store, type, uri) {
  return store.some(x => x, uri, expandNS('rdf:type'), type)
}

function getFirstObject(store, s, p) {
  const statement = findOne(store, s, p)

  return statement ? statement.object : null
}

function getFirstObjectLiteral(store, s, p) {
  const object = getFirstObject(store, s, p)

  if (!object || !N3.Util.isLiteral(object)) return null

  return object.value
}


function findOne(store, s, p, o) {
  let ret = null

  return store.some(statement => ret = statement, s, p, o), ret;
}

function rdfListToArray(store, headNode) {
  const arr = []

  let _headNode = headNode

  while (!rdfNil.equals(_headNode)) {
    const el = findOne(store, _headNode, rdfFirst)

    if (!el) {
      throw new Error(`No triple matching ${JSON.stringify(_headNode)} rdf:first ?`)
    }

    arr.push(el.object)

    _headNode = findOne(store, _headNode, rdfRest)

    if (!_headNode) {
      throw new Error(`No triple matching ${_headNode} rdf:rest ?`)
    }

    _headNode = _headNode.object
  }

  return arr;
}

function nsExpander(prefixes) {
  const n3fn = N3.Util.prefixes(prefixes)

  function expandNS(arg) {
    const colonPos = arg.indexOf(':')

    return colonPos > -1
      ? n3fn(arg.slice(0, colonPos))(arg.slice(colonPos + 1))
      : n3fn(arg)
  }

  return Object.assign(expandNS, {
    prefixes,
    withPrefixes(extra) {
      return nsExpander(Object.assign({}, prefixes, extra))
    }
  })
}

// Given a store and one or more nodes, return a new store that is a subset of
// the original. The new graph is constructed by starting with all the
// statements in the original graph where the given nodes are subjects. The
// original graph is then re-traversed to find all the statements where those
// objects are subjects, and so on, until all matching statements are exhausted.
function makeSubgraphFrom(store, nodes) {
  const newStore = new N3.Store()
      , subjs = [...[].concat(nodes)]

  while (subjs.length) {
    const subj = subjs.shift()

    store.getQuads(subj).forEach(quad => {
      const searchForObject = (
        newStore.addQuad(quad) && (
          N3.Util.isNamedNode(quad.object) ||
          N3.Util.isBlankNode(quad.object)
        )
      )

      if (searchForObject) {
        subjs.push(quad.object)
      }
    })
  }

  return newStore
}


module.exports = {
  parseToPromise,
  findOne,
  rdfListToArray,
  nsExpander,
  isType,
  getFirstObject,
  getFirstObjectLiteral,
  makeSubgraphFrom,
}
