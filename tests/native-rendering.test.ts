import {test} from 'node:test';
import * as assert from 'node:assert/strict';
import {renderMessage} from '../src/common/render-message';
import {renderMarkdown} from '../src/common/markdown';
import {posix} from 'node:path';
test('Markdown escapes literal punctuation and preserves inline code, emphasis and strikeout', () => {
 assert.equal(renderMarkdown('**bold** *italic* _italic_ ~~old~~ `a.b_*` !'), '*bold* _italic_ _italic_ ~old~ `a.b_*` \\!');
 assert.equal(renderMarkdown('a.b! [unclosed'), 'a\\.b\\! \\[unclosed');
});
test('links with balanced parentheses have escaped destinations', () => {
 assert.equal(renderMarkdown('[a.b](https://example.org/a(b))'), '[a\\.b](https://example.org/a(b\\))');
 assert.equal(renderMarkdown('[bad](javascript:evil)'), '\\[bad\\]\\(javascript:evil\\)');
});
test('code fences preserve literal content with Telegram code escaping', () => {
 assert.equal(renderMarkdown('```js\na.b_*\\x\n```'), '```js\na.b_*\\\\x\n```');
});
test('unrecognized syntax remains escaped literal text', () => {
 assert.equal(renderMarkdown('| a | b |'), '\\| a \\| b \\|');
 assert.equal(renderMarkdown('> quote'), '\\> quote');
});
test('unsupported template expressions fail; substitutions are not re-evaluated', () => {
 for (const message of ['{{ a | safe }}', '${a + 1}', '{% for a in b %}', '<%= a %>', '{{ constructor }}']) {
  assert.throws(() => renderMessage({message, format: 'html'}, {a: 'hello'}));
 }
 assert.equal(renderMessage({message: '${title}', format: 'html'}, {title: '${secret}'}).message, '${secret}');
 assert.equal(renderMessage({message: '{{ absent }}', format: 'html'}).message, '');
 // @ts-expect-error Deliberately invalid callback result checks the runtime guard.
 assert.throws(() => renderMessage({message: () => 123}), /must return a string/);
});
test('native branch patterns handle stars, recursive stars, braces and extglobs', () => {
 for (const [branch, glob, match] of [
  ['release/1.x','release/*.x',true], ['release/a/1.x','release/*.x',false],
  ['release/a/1.x','release/**',true], ['main','{main,beta}',true],
  ['beta','@(main|beta)',true], ['other','{main,beta}',false],
 ] as const) assert.equal(posix.matchesGlob(branch, glob), match);
});
