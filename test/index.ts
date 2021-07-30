import test from 'blue-tape'
import * as N3 from 'n3'
import * as util from '../'

const { namedNode } = N3.DataFactory

test('N3 Utils', async t => {
  const parser = new N3.Parser()

  const prefixes = N3.Util.prefixes({
    ex: 'http://example.com/',
  })

  const { quads } = await util.parseToPromise(parser, `
    @prefix ex: <http://example.com/> .

    ex:a ex:b ex:c .

    ex:list ex:members (
      ex:d
      ex:e
      ex:f
    ) .
  `)

  t.equal(quads.length, 8, 'should parse an RDF string into an N3 Store')

  const store = new N3.Store()
  store.addQuads(quads)

  t.deepEqual(
    await util.findOne(store, prefixes('ex')('a')),
    N3.DataFactory.quad(
      namedNode('http://example.com/a'),
      namedNode('http://example.com/b'),
      namedNode('http://example.com/c')
    ),
    'should be able to find one triple in a store'
  )

  const listHeadNode = (await util.findOne(
    store,
    prefixes('ex')('list'),
    prefixes('ex')('members')
  ))?.object!

  t.deepEqual(
    await util.rdfListToArray(store, listHeadNode),
    [
      namedNode('http://example.com/d'),
      namedNode('http://example.com/e'),
      namedNode('http://example.com/f'),
    ],
    'should convert RDF lists to JS arrays'
  )
})
