import { refractor as refractorAll } from 'refractor/lib/all.js'
import rehypePrismGenerator from './generator.js'

/**
 * Rehype prism plugin that highlights code blocks with refractor (prismjs)
 * This supports all the languages and should be used on the server side.
 *
 * Consider using rehypePrismCommon or rehypePrismGenerator to generate a plugin
 * that supports your required languages.
 */
const rehypePrismAll = rehypePrismGenerator(refractorAll)

export default rehypePrismAll
