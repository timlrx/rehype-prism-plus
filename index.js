/**
 * @typedef {import('hast').Node & {properties: Object<any, any>}} Node
 * @typedef {import('hast').Parent & {properties: Object<any, any>}} Parent
 * @typedef {import('hast').Root} Root
 * @typedef {import('unist-util-visit').Visitor<Node>} Visitor
 * @typedef Options options
 *   Configuration.
 * @property {boolean} [showLineNumbers]
 *   Set `showLineNumbers` to `true` to always display line number
 * @property {boolean} [ignoreMissing]
 *   Set `ignoreMissing` to `true` to ignore unsupported languages and line highlighting when no language is specified
 */

import { visit } from 'unist-util-visit'
import { toString } from 'hast-util-to-string'
import { refractor } from 'refractor/lib/all.js'
import { toHtml } from 'hast-util-to-html'
import { filter } from 'unist-util-filter'
import { unified } from 'unified'
import parse from 'rehype-parse'
import rangeParser from 'parse-numeric-range'

/**
 * @param {Node} node
 * @return {string|null}
 */
const getLanguage = (node) => {
  const className = node.properties.className || []

  for (const classListItem of className) {
    if (classListItem.slice(0, 9) === 'language-') {
      return classListItem.slice(9).toLowerCase()
    }
  }
  return null
}

/**
 * Create a closure that determines if we have to highlight the given index
 *
 * @param {string} meta
 * @return { (index:number) => boolean }
 */
const calculateLinesToHighlight = (meta) => {
  const RE = /{([\d,-]+)}/
  // Remove space between {} e.g. {1, 3}
  const parsedMeta = meta
    .split(',')
    .map((str) => str.trim())
    .join()
  if (RE.test(parsedMeta)) {
    const strlineNumbers = RE.exec(parsedMeta)[1]
    const lineNumbers = rangeParser(strlineNumbers)
    return (index) => lineNumbers.includes(index + 1)
  } else {
    return () => false
  }
}

/**
 * Split line to div node with className `code-line`
 *
 * @param {string} text
 * @return {Node[]}
 */
const splitLine = (text) => {
  // Xdm Markdown parser every code line with \n
  const textArray = text.split(/\n/)

  // Remove last line \n which results in empty array
  if (textArray[textArray.length - 1].trim() === '') {
    textArray.pop()
  }

  // Empty array are actually line segments so we convert them back to newlines
  return textArray.map((line) => {
    return {
      type: 'element',
      tagName: 'span',
      properties: { className: ['code-line'] },
      children: [{ type: 'text', value: line }],
    }
  })
}

/**
 * Split line to div node with className `code-line`
 *
 * @param {import('refractor').RefractorRoot} ast
 * @return {Root}
 */
const getNodePosition = (ast) => {
  // @ts-ignore
  let html = toHtml(ast)
  const hast = unified().use(parse, { emitParseErrors: true, fragment: true }).parse(html)
  return hast
}

/**
 * Split multiline text nodes into individual nodes with positioning
 *
 * @param {Parent['children']} ast
 * @return {Parent['children']}
 */
const splitTextByLine = (ast) => {
  //@ts-ignore
  return ast.reduce((result, node) => {
    if (node.type === 'text') {
      if (node.value.indexOf('\n') === -1) {
        result.push(node)
        return result
      }

      const lines = node.value.split('\n')
      for (const [i, line] of lines.entries()) {
        result.push({
          type: 'text',
          value: i === lines.length - 1 ? line : line + '\n',
          position: {
            start: { line: node.position.start.line + i },
            end: { line: node.position.start.line + i },
          },
        })
      }

      return result
    }

    if (node.children) {
      // @ts-ignore
      node.children = splitTextByLine(node.children)
      result.push(node)
      return result
    }

    result.push(node)
    return result
  }, [])
}

/**
 * Rehype plugin that highlights code blocks with refractor (prismjs)
 *
 * @type {import('unified').Plugin<[Options?], Root>}
 */
const rehypePrism = (options = {}) => {
  return (tree) => {
    // @ts-ignore
    visit(tree, 'element', visitor)
  }

  /**
   * @param {Node} node
   * @param {number} index
   * @param {Parent} parent
   */
  function visitor(node, index, parent) {
    if (!parent || parent.tagName !== 'pre' || node.tagName !== 'code') {
      return
    }

    const lang = getLanguage(node)

    /** @type {string} */
    // @ts-ignore
    let meta = node.data && node.data.meta ? node.data.meta : ''
    node.properties.className = node.properties.className || []
    node.properties.className.push('code-highlight')

    let refractorRoot
    let langError = false

    // Syntax highlight
    if (lang) {
      try {
        // @ts-ignore
        refractorRoot = refractor.highlight(toString(node), lang)
      } catch (err) {
        if (options.ignoreMissing && /Unknown language/.test(err.message)) {
          langError = true
          refractorRoot = node.children
        } else {
          throw err
        }
      }
    } else {
      refractorRoot = node.children
    }

    // @ts-ignore
    refractorRoot = getNodePosition(refractorRoot)
    refractorRoot.children = splitTextByLine(refractorRoot.children)

    const shouldHighlightLine = calculateLinesToHighlight(meta)
    // @ts-ignore
    const codeLineArray = splitLine(toString(node))

    for (const [i, line] of codeLineArray.entries()) {
      // Code lines
      if (meta.toLowerCase().includes('showLineNumbers'.toLowerCase()) || options.showLineNumbers) {
        line.properties.line = [(i + 1).toString()]
        line.properties.className.push('line-number')
      }

      // Line highlight
      if (shouldHighlightLine(i)) {
        line.properties.className.push('highlight-line')
      }

      // Syntax highlight
      const treeExtract = filter(
        refractorRoot,
        (node) => node.position.start.line <= i + 1 && node.position.end.line >= i + 1
      )
      line.children = treeExtract.children
    }

    node.children = codeLineArray
  }
}

export default rehypePrism
