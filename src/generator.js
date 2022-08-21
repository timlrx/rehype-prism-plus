/**
 * @typedef {import('hast').Element} Element
 * @typedef {import('hast').Root} Root
 * @typedef Options options
 *   Configuration.
 * @property {boolean} [showLineNumbers]
 *   Set `showLineNumbers` to `true` to always display line number
 * @property {boolean} [ignoreMissing]
 *   Set `ignoreMissing` to `true` to ignore unsupported languages and line highlighting when no language is specified
 */

import { visit } from 'unist-util-visit'
import { toString } from 'hast-util-to-string'
import { filter } from 'unist-util-filter'
import rangeParser from 'parse-numeric-range'

/**
 * @param {Element} node
 * @return {string|null}
 */
const getLanguage = (node) => {
  const className = node.properties.className
  //@ts-ignore
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
 * Check if we want to start the line numbering from a given number or 1
 * showLineNumbers=5, will start the numbering from 5
 * @param {string} meta
 * @returns {number}
 */
const calculateStartingLine = (meta) => {
  const RE = /showLineNumbers=(?<lines>\d+)/i
  // pick the line number after = using a named capturing group
  if (RE.test(meta)) {
    const {
      groups: { lines },
    } = RE.exec(meta)
    return Number(lines)
  }
  return 1
}

/**
 * Create container AST for node lines
 *
 * @param {number} number
 * @return {Element[]}
 */
const createLineNodes = (number) => {
  const a = new Array(number)
  for (let i = 0; i < number; i++) {
    a[i] = {
      type: 'element',
      tagName: 'span',
      properties: { className: [] },
      children: [],
    }
  }
  return a
}

/**
 * Split multiline text nodes into individual nodes with positioning
 * Add a node start and end line position information for each text node
 *
 * @return { (ast:Element['children']) => Element['children'] }
 *
 */
const addNodePositionClosure = () => {
  let startLineNum = 1
  /**
   * @param {Element['children']} ast
   * @return {Element['children']}
   */
  const addNodePosition = (ast) => {
    return ast.reduce((result, node) => {
      if (node.type === 'text') {
        const value = /** @type {string} */ (node.value)
        const numLines = (value.match(/\n/g) || '').length
        if (numLines === 0) {
          node.position = {
            // column: 1 is needed to avoid error with @next/mdx
            // https://github.com/timlrx/rehype-prism-plus/issues/44
            start: { line: startLineNum, column: 1 },
            end: { line: startLineNum, column: 1 },
          }
          result.push(node)
        } else {
          const lines = value.split('\n')
          for (const [i, line] of lines.entries()) {
            result.push({
              type: 'text',
              value: i === lines.length - 1 ? line : line + '\n',
              position: {
                start: { line: startLineNum + i, column: 1 },
                end: { line: startLineNum + i, column: 1 },
              },
            })
          }
        }
        startLineNum = startLineNum + numLines

        return result
      }

      if (Object.prototype.hasOwnProperty.call(node, 'children')) {
        const initialLineNum = startLineNum
        // @ts-ignore
        node.children = addNodePosition(node.children, startLineNum)
        result.push(node)
        node.position = {
          start: { line: initialLineNum, column: 1 },
          end: { line: startLineNum, column: 1 },
        }
        return result
      }

      result.push(node)
      return result
    }, [])
  }
  return addNodePosition
}

/**
 * Rehype prism plugin generator that highlights code blocks with refractor (prismjs)
 *
 * Pass in your own refractor object with the required languages registered:
 * https://github.com/wooorm/refractor#refractorregistersyntax
 *
 * @param {import('refractor/lib/core').Refractor} refractor
 * @return {import('unified').Plugin<[Options?], Root>}
 */
const rehypePrismGenerator = (refractor) => {
  return (options = {}) => {
    return (tree) => {
      visit(tree, 'element', visitor)
    }

    /**
     * @param {Element} node
     * @param {number} index
     * @param {Element} parent
     */
    function visitor(node, index, parent) {
      if (!parent || parent.tagName !== 'pre' || node.tagName !== 'code') {
        return
      }

      let meta = node.data && node.data.meta ? /** @type {string} */ (node.data.meta) : ''
      // Coerce className to array
      if (node.properties.className) {
        if (typeof node.properties.className === 'boolean') {
          node.properties.className = []
        } else if (!Array.isArray(node.properties.className)) {
          node.properties.className = [node.properties.className]
        }
      } else {
        node.properties.className = []
      }
      node.properties.className.push('code-highlight')
      const lang = getLanguage(node)

      /** @type {Element} */
      let refractorRoot

      // Syntax highlight
      if (lang) {
        try {
          let rootLang
          if (lang?.includes('diff-')){
            rootLang=lang.split('-')[1]
          } else{
            rootLang=lang
          }
          // @ts-ignore
          refractorRoot = refractor.highlight(toString(node), rootLang)
          // @ts-ignore className is already an array
          parent.properties.className = (parent.properties.className || []).concat(
            'language-' + rootLang
          )
        } catch (err) {
          if (options.ignoreMissing && /Unknown language/.test(err.message)) {
            refractorRoot = node
          } else {
            throw err
          }
        }
      } else {
        refractorRoot = node
      }

      refractorRoot.children = addNodePositionClosure()(refractorRoot.children)

      // Add position info to root
      if (refractorRoot.children.length > 0) {
        refractorRoot.position = {
          start: { line: refractorRoot.children[0].position.start.line, column: 0 },
          end: {
            line: refractorRoot.children[refractorRoot.children.length - 1].position.end.line,
            column: 0,
          },
        }
      } else {
        refractorRoot.position = {
          start: { line: 0, column: 0 },
          end: { line: 0, column: 0 },
        }
      }

      const shouldHighlightLine = calculateLinesToHighlight(meta)
      const startingLineNumber = calculateStartingLine(meta)
      const codeLineArray = createLineNodes(refractorRoot.position.end.line)

      const falseShowLineNumbersStr = [
        'showlinenumbers=false',
        'showlinenumbers="false"',
        'showlinenumbers={false}',
      ]
      for (const [i, line] of codeLineArray.entries()) {
        // Default class name for each line
        line.properties.className = ['code-line']

        // Syntax highlight
        const treeExtract = filter(
          refractorRoot,
          (node) => node.position.start.line <= i + 1 && node.position.end.line >= i + 1
        )
        line.children = treeExtract.children

        // Line number
        if (
          (meta.toLowerCase().includes('showLineNumbers'.toLowerCase()) ||
            options.showLineNumbers) &&
          !falseShowLineNumbersStr.some((str) => meta.toLowerCase().includes(str))
        ) {
          line.properties.line = [(i + startingLineNumber).toString()]
          line.properties.className.push('line-number')
        }

        // Line highlight
        if (shouldHighlightLine(i)) {
          line.properties.className.push('highlight-line')
        }

        // Diff classes
        if ((lang === 'diff' || lang?.includes('diff-')) && toString(line).substring(0, 1) === '-') {
          line.properties.className.push('deleted')
        } else if ((lang === 'diff' || lang?.includes('diff-')) && toString(line).substring(0, 1) === '+') {
          line.properties.className.push('inserted')
        }
      }

      // Remove possible trailing line when splitting by \n which results in empty array
      if (
        codeLineArray.length > 0 &&
        toString(codeLineArray[codeLineArray.length - 1]).trim() === ''
      ) {
        codeLineArray.pop()
      }

      node.children = codeLineArray
    }
  }
}

export default rehypePrismGenerator
