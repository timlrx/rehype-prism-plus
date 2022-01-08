import { refractor as refractorCommon } from 'refractor/lib/common.js'
import rehypePrismGenerator from './generator.js'

/**
 * Rehype prism plugin that highlights code blocks with refractor (prismjs)
 * Supported languages: https://github.com/wooorm/refractor#data
 *
 * Consider using rehypePrismGenerator to generate a plugin
 * that supports your required languages.
 */
const rehypePrismCommon = rehypePrismGenerator(refractorCommon)

export default rehypePrismCommon
