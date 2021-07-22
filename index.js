/**
 * @typedef {import('unist-util-visit').Node & {properties: Object<any, any>}} Node
 * @typedef {import('unist-util-visit').Parent & {properties: Object<any, any>}} Parent
 * @typedef {import('unist-util-visit').Visitor<Node>} Visitor
 */

import { visit } from 'unist-util-visit'
import toString from 'hast-util-to-string'
import { refractor } from 'refractor'
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
  if (RE.test(meta)) {
    const strlineNumbers = RE.exec(meta)[1]
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
      tagName: 'div',
      properties: { className: ['code-line'] },
      children: [{ type: 'text', value: line === '' ? '\n' : line }],
    }
  })
}

/**
 * Rehype plugin that highlights code blocks with refractor (prismjs)
 *
 * Set `showLineNumbers` to `true` to always display line number
 *
 * Set `ignoreMissing` to `true` to ignore unsupported languages and line highlighting when no language is specified
 *
 * @typedef {{ showLineNumbers?: boolean, ignoreMissing?: boolean }} RehypePrismOptions
 * @param {RehypePrismOptions} options
 * @return {Visitor}
 */
const rehypePrism = (options) => {
  options = options || {}

  return (tree) => {
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

    if (lang) {
      parent.properties.className = (parent.properties.className || []).concat('language-' + lang)
      // Add lang to meta to allow line highlighting even when no lang is specified
      meta = `${lang} ${meta}`
    }

    const shouldHighlightLine = calculateLinesToHighlight(meta)
    const codeLineArray = splitLine(toString(node))

    for (const [i, line] of codeLineArray.entries()) {
      // Code lines
      if (meta.toLowerCase().includes('showLineNumbers'.toLowerCase()) || options.showLineNumbers) {
        line.properties.line = [(i + 1).toString()]
        line.properties.className = [`${line.properties.className} line-number`]
      }

      // Line highlight
      if (shouldHighlightLine(i)) {
        line.properties.className = [`${line.properties.className} highlight-line`]
      }

      // Syntax highlight
      if (lang && line.children) {
        try {
          line.children = refractor.highlight(line.children[0].value, lang).children
        } catch (err) {
          // eslint-disable-next-line no-empty
          if (options.ignoreMissing && /Unknown language/.test(err.message)) {
          } else {
            throw err
          }
        }
      }
    }

    node.children = codeLineArray
  }
}

export default rehypePrism
