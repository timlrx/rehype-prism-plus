import { test } from 'uvu'
import * as assert from 'uvu/assert'
import { visit } from 'unist-util-visit'
import { rehype } from 'rehype'
import { unified } from 'unified'
import remarkParse from 'remark-parse'
import remarkRehype from 'remark-rehype'
import rehypeStringify from 'rehype-stringify'
import dedent from 'dedent'
import rehypePrism from './src/index.js'

/**
 * Mock meta in code block
 */
const addMeta = (metastring) => {
  if (!metastring) return
  return (tree) => {
    visit(tree, 'element', (node, index, parent) => {
      if (node.tagName === 'code') {
        node.data = { meta: metastring }
      }
    })
  }
}

const processHtml = (html, options, metastring) => {
  return rehype()
    .data('settings', { fragment: true })
    .use(addMeta, metastring)
    .use(rehypePrism, options)
    .processSync(html)
    .toString()
}

const processHtmlUnified = (html, options, metastring) => {
  return unified()
    .use(remarkParse)
    .use(remarkRehype, {})
    .use(addMeta, metastring)
    .use(rehypePrism, options)
    .use(rehypeStringify)
    .processSync(html)
    .toString()
}

test('adds a code-highlight class to the code and pre tag', () => {
  const result = processHtml(dedent`
    <pre><code class="language-py"></code></pre>
  `)
  const expected = dedent`<pre class="language-py"><code class="language-py code-highlight"></code></pre>`
  assert.is(result, expected)
})

test('add span with class code line for each line', () => {
  const result = processHtml(
    dedent`
    <pre><code>x = 6</code></pre>
  `
  )
  const expected = dedent`<pre><code class="code-highlight"><span class="code-line">x = 6</span></code></pre>`
  assert.is(result, expected)
})

test('finds code and highlights', () => {
  const result = processHtml(dedent`
    <div>
      <p>foo</p>
      <pre><code class="language-py">x = 6</code></pre>
    </div>
    `).trim()
  const expected = dedent`
    <div>
      <p>foo</p>
      <pre class="language-py"><code class="language-py code-highlight"><span class="code-line">x <span class="token operator">=</span> <span class="token number">6</span></span></code></pre>
    </div>
    `
  assert.is(result, expected)
})

test('respects line spacing', () => {
  const result = processHtml(dedent`
<div>
  <pre><code class="language-py">x

y
</code></pre>
</div>
`).trim()
  const expected = dedent`
  <div>
  <pre class="language-py"><code class="language-py code-highlight"><span class="code-line">x
  </span><span class="code-line">
  </span><span class="code-line">y
  </span></code></pre>
  </div>
    `
  assert.is(result, expected)
})

test('handles uppercase correctly', () => {
  const result = processHtml(dedent`
    <div>
      <p>foo</p>
      <pre><code class="language-PY">x = 6</code></pre>
    </div>
    `).trim()
  const expected = dedent`
    <div>
      <p>foo</p>
      <pre class="language-py"><code class="language-PY code-highlight"><span class="code-line">x <span class="token operator">=</span> <span class="token number">6</span></span></code></pre>
    </div>
    `
  assert.is(result, expected)
})

test('each line of code should be a separate div', async () => {
  const result = processHtml(dedent`
    <div>
      <p>foo</p>
      <pre class="language-py">
      <code class="language-py code-highlight">x = 6
      y = 7
      </code>
      </pre>
    </div>
    `).trim()
  const codeLineCount = (result.match(/<span class="code-line">/g) || []).length
  assert.is(codeLineCount, 2)
})

test('should highlight line', async () => {
  const meta = '{1}'
  const result = processHtml(
    dedent`
    <div>
      <pre>
      <code class="language-py code-highlight">x = 6
      y = 7
      </code>
      </pre>
    </div>
    `,
    {},
    meta
  ).trim()
  const codeHighlightCount = (result.match(/<span class="code-line highlight-line">/g) || []).length
  assert.is(codeHighlightCount, 1)
})

test('should highlight comma separated lines', async () => {
  const meta = '{1,3}'
  const result = processHtml(
    dedent`
    <div>
      <pre>
      <code class="language-py code-highlight">x = 6
      y = 7
      z = 10
      </code>
      </pre>
    </div>
    `,
    {},
    meta
  ).trim()
  const codeHighlightCount = (result.match(/<span class="code-line highlight-line">/g) || []).length
  assert.is(codeHighlightCount, 2)
})

test('should should parse ranges with a space in between', async () => {
  const meta = '{1, 3}'
  const result = processHtml(
    dedent`
    <div>
      <pre>
      <code class="language-py code-highlight">x = 6
      y = 7
      z = 10
      </code>
      </pre>
    </div>
    `,
    {},
    meta
  ).trim()
  const codeHighlightCount = (result.match(/<span class="code-line highlight-line">/g) || []).length
  assert.is(codeHighlightCount, 2)
})

test('should highlight range separated lines', async () => {
  const meta = '{1-3}'
  const result = processHtml(
    dedent`
    <div>
      <pre>
      <code class="language-py code-highlight">x = 6
      y = 7
      z = 10
      </code>
      </pre>
    </div>
    `,
    {},
    meta
  ).trim()
  const codeHighlightCount = (result.match(/<span class="code-line highlight-line">/g) || []).length
  assert.is(codeHighlightCount, 3)
})

test('showLineNumbers option add line numbers', async () => {
  const result = processHtml(
    dedent`
    <div>
      <pre>
      <code class="language-py code-highlight">x = 6
      y = 7
      </code>
      </pre>
    </div>
    `,
    { showLineNumbers: true }
  ).trim()
  assert.ok(result.match(/line="1"/g))
  assert.ok(result.match(/line="2"/g))
  assert.not(result.match(/line="3"/g))
})

test('not show line number when showLineNumbers=false', async () => {
  const meta = 'showLineNumbers=false'
  const result = processHtml(
    dedent`
    <div>
      <pre>
      <code class="language-py code-highlight">x = 6
      y = 7
      </code>
      </pre>
    </div>
    `,
    { showLineNumbers: true },
    meta
  ).trim()
  assert.not(result.match(/line="1"/g))
  assert.not(result.match(/line="2"/g))
})

test('not show line number when showLineNumbers={false}', async () => {
  const meta = 'showLineNumbers={false}'
  const result = processHtml(
    dedent`
    <div>
      <pre>
      <code class="language-py code-highlight">x = 6
      y = 7
      </code>
      </pre>
    </div>
    `,
    { showLineNumbers: true },
    meta
  ).trim()
  assert.not(result.match(/line="1"/g))
  assert.not(result.match(/line="2"/g))
})

test('showLineNumbers property works in meta field', async () => {
  const meta = 'showLineNumbers'
  const result = processHtml(
    dedent`
    <div>
      <pre>
      <code class="language-py code-highlight">x = 6
      y = 7
      </code>
      </pre>
    </div>
    `,
    {},
    meta
  ).trim()
  assert.ok(result.match(/line="1"/g))
  assert.ok(result.match(/line="2"/g))
  assert.not(result.match(/line="3"/g))
})

test('showLineNumbers property with custom index works in meta field', async () => {
  const meta = 'showLineNumbers=5'
  const result = processHtml(
    dedent`
    <div>
      <pre>
      <code class="language-py code-highlight">x = 6
      y = 7
      </code>
      </pre>
    </div>
    `,
    {},
    meta
  ).trim()
  assert.ok(result.match(/line="5"/g))
  assert.ok(result.match(/line="6"/g))
  assert.not(result.match(/line="7"/g))
})

test('should support both highlighting and add line number', async () => {
  const meta = '{1} showLineNumbers'
  const result = processHtml(
    dedent`
    <div>
      <pre>
      <code class="language-py">x = 6
      y = 7
      z = 10
      </code>
      </pre>
    </div>
    `,
    {},
    meta
  ).trim()
  const codeHighlightCount = (result.match(/highlight-line/g) || []).length
  assert.is(codeHighlightCount, 1)
  assert.ok(result.match(/line="1"/g))
  assert.ok(result.match(/line="2"/g))
})

test('throw error with fake language- class', () => {
  assert.throws(
    () =>
      processHtml(dedent`
  <pre><code class="language-thisisnotalanguage">x = 6</code></pre>
`),
    /Unknown language/
  )
})

test('with options.ignoreMissing, does nothing to code block with fake language- class', () => {
  const result = processHtml(
    dedent`
    <pre><code class="language-thisisnotalanguage">x = 6</code></pre>
  `,
    { ignoreMissing: true }
  )
  const expected = dedent`<pre><code class="language-thisisnotalanguage code-highlight"><span class="code-line">x = 6</span></code></pre>`
  assert.is(result, expected)
})

test('with options.defaultLanguage, it adds the correct language class tag', () => {
  const result = processHtml(
    dedent`
    <pre><code>x = 6</code></pre>
  `,
    { defaultLanguage: 'py' }
  )
  const expected = dedent`<pre class="language-py"><code class="language-py code-highlight"><span class="code-line">x <span class="token operator">=</span> <span class="token number">6</span></span></code></pre>`
  assert.is(result, expected)
})

test('defaultLanguage should produce the same syntax tree as if manually specified', () => {
  const resultDefaultLanguage = processHtml(
    dedent`
    <pre><code>x = 6</code></pre>
  `,
    { defaultLanguage: 'py' }
  )
  const resultManuallySpecified = processHtml(
    dedent`
    <pre><code class="language-py">x = 6</code></pre>
  `
  )
  assert.is(resultDefaultLanguage, resultManuallySpecified)
})

test('throws error if options.defaultLanguage is not registered with refractor', () => {
  assert.throws(
    () =>
      processHtml(
        dedent`
    <pre><code>x = 6</code></pre>
  `,
        { defaultLanguage: 'pyzqt' }
      ),
    /"pyzqt" is not registered with refractor/
  )
})

test('should work with multiline code / comments', () => {
  const result = processHtml(
    dedent`
    <pre><code class="language-js">
    /**
     * My comment
     */
    </code></pre>
  `,
    { ignoreMissing: true }
  )
  const expected = dedent`<pre class="language-js"><code class="language-js code-highlight"><span class="code-line">
        </span><span class="code-line"><span class="token doc-comment comment">/**
        </span></span><span class="code-line"><span class="token doc-comment comment"> * My comment
        </span></span><span class="code-line"><span class="token doc-comment comment"> */</span>
        </span></code></pre>`
  assert.is(result, expected)
})

test('adds inserted or deleted to code-line if lang=diff', async () => {
  const result = processHtml(
    dedent`
    <div>
      <pre>
      <code class="language-diff">+ x = 6
- y = 7
z = 10
      </code>
      </pre>
    </div>
    `
  ).trim()
  assert.ok(result.includes(`<span class="code-line inserted">`))
  assert.ok(result.includes(`<span class="code-line deleted">`))
  assert.ok(result.includes(`<span class="code-line">`))
})

test('works as a remarkjs / unifiedjs plugin', () => {
  const result = processHtmlUnified(
    dedent`
    ~~~jsx
    <Component/>
    ~~~
  `,
    { ignoreMissing: true }
  )
  const expected = dedent`<pre class="language-jsx"><code class="language-jsx code-highlight"><span class="code-line"><span class="token tag"><span class="token tag"><span class="token punctuation">&#x3C;</span><span class="token class-name">Component</span></span><span class="token punctuation">/></span></span>
  </span></code></pre>`
  assert.is(result, expected)
})

test('diff and code highlighting should work together', () => {
  const result = processHtml(
    dedent`
    <pre><code class="language-diff-css">
    .hello{
    - background:url('./urel.png');
    + background-image:url('./urel.png');
    }
    </code></pre>
  `,
    { ignoreMissing: true }
  )
  assert.ok(result.includes(`<pre class="language-css">`))
  assert.ok(result.includes(`<span class="code-line inserted">`))
  assert.ok(result.includes(`<span class="code-line deleted">`))
  assert.ok(result.includes(`<span class="code-line">`))
})

test.run()
