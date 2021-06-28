import { visit } from 'unist-util-visit'
import toString from 'hast-util-to-string'
import { refractor } from 'refractor'
import rangeParser from 'parse-numeric-range'

const getLanguage = (node) => {
  const className = node.properties.className || []

  for (const classListItem of className) {
    if (classListItem.slice(0, 9) === 'language-') {
      return classListItem.slice(9).toLowerCase()
    }
  }
  return null
}

// Create a closure that determines if we have to highlight the given index
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

const splitLine = (text) => {
  // Xdm Markdown parser every code line with \n
  const textArray = text.split(/\n/)

  // Remove last line \n which results in empty array
  if (textArray[textArray.length - 1].trim() === '') {
    textArray.pop()
  }

  return textArray.map((line) => {
    return {
      type: 'element',
      tagName: 'div',
      properties: { className: ['code-line'] },
      children: [{ type: 'text', value: line }],
    }
  })
}

const rehypePrism = (options) => {
  options = options || {}

  return (tree) => {
    visit(tree, 'element', visitor)
  }

  function visitor(node, index, parent) {
    if (!parent || parent.tagName !== 'pre' || node.tagName !== 'code') {
      return
    }

    const lang = getLanguage(node)
    const meta = node.data && node.data.meta ? node.data.meta : ''
    const shouldHighlightLine = calculateLinesToHighlight(meta)

    if (lang) {
      parent.properties.className = (parent.properties.className || []).concat('language-' + lang)
    }

    const codeLineArray = splitLine(toString(node))

    for (const [i, line] of codeLineArray.entries()) {
      // Code lines
      if (meta.includes('showLineNumbers') || options.showLineNumbers) {
        line.properties.line = [(i + 1).toString()]
        line.properties.className = [`${line.properties.className} line-number`]
      }

      // Line highlight
      if (shouldHighlightLine(i)) {
        line.properties.className = [`${line.properties.className} highlight-line`]
      }

      // Syntax highlight
      if (lang) {
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
