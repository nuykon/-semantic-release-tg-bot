import {test} from 'node:test';
import {equal, deepEqual, throws, match} from 'node:assert/strict';
import {mkdtempSync, writeFileSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {renderMessage} from '../src/common/render-message';
import {renderMarkdown} from '../src/common/markdown';

const render = (source: string): string => renderMessage({format: 'html', message: source}, {
    project: {name: 'Орбита'}, builds: [{id: 17}], empty: null, inert: '${notEvaluated}',
}).message;

test('inline lookup reads nested and numeric paths without interpreting substituted values', () => {
    equal(render('${project.name} / {{ builds.0.id }} / ${missing} / ${empty}'), 'Орбита / 17 /  /');
    equal(render('${inert}'), '${notEvaluated}');
    equal(renderMessage({message: '${project}', customData: {project: 'custom'}, format: 'html'}, {project: 'context'}).message, 'custom');
});

test('template inputs cannot read prototypes or evaluate expressions', () => {
    for (const invalid of ['${project.constructor}', '{{ __proto__ }}', '${project.name.toUpperCase()}', '{{ project | safe }}', '{% include "x" %}', '<% process.exit() %>']) {
        throws(() => render(invalid));
    }
});

test('message callbacks receive the merged context once and must produce text', () => {
    let calls = 0;
    const result = renderMessage({format: 'html', customData: {amount: 6}, message: values => {
        calls += 1;
        return `<i>${Number(values.amount) * Number(values.multiplier)}</i>`;
    }}, {amount: 1, multiplier: 7});
    deepEqual(result, {format: 'html', message: '<i>42</i>'});
    equal(calls, 1);
    // @ts-expect-error Exercise the runtime contract for untyped consumers.
    throws(() => renderMessage({message: () => false}), TypeError);
});

test('temporary file templates preserve authored Telegram syntax and resolve their own data', t => {
    const directory = mkdtempSync(join(tmpdir(), 'tg-content-'));
    t.after(() => rmSync(directory, {recursive: true, force: true}));
    for (const [filename, authored, expected, format] of [
        ['summary.HTML', ' <code>{{ build.id }}</code> ', '<code>81</code>', 'html'],
        ['summary.md', ' *Build ${build.id}*\\! ', '*Build 81*\\!', 'markdown'],
    ] as const) {
        const path = join(directory, filename);
        writeFileSync(path, authored);
        deepEqual(renderMessage({path, customData: {build: {id: 81}}}), {message: expected, format});
    }
    throws(() => renderMessage({path: join(directory, 'absent.md')}), /ENOENT/);
});

for (const [source, output] of [
    ['## Shipping\n- **Ready**', '*Shipping*\n•   *Ready*'],
    ['_quiet_ ~~retired~~', '_quiet_ ~retired~'],
    ['v4.8.2 (RC)!', 'v4\\.8\\.2 \\(RC\\)\\!'],
    ['`read(a_b)`', '`read(a_b)`'],
    ['[API](https://docs.invalid/ref(v4))', '[API](https://docs.invalid/ref(v4\\))'],
    ['[profile](tg://user?id=765)', '[profile](tg://user?id=765)'],
    ['[unsafe](file:///secret)', '\\[unsafe\\]\\(file:///secret\\)'],
    ['> literal | row', '\\> literal \\| row'],
    ['unclosed [reference', 'unclosed \\[reference'],
    ['```ts\nlet n = 4;\n```', '```ts\nlet n = 4;\n```'],
    ['<small>[v4](https://docs.invalid/v4)</small>', '[v4](https://docs.invalid/v4)'],
] as const) {
    test(`Telegram Markdown representation: ${JSON.stringify(source)}`, () => equal(renderMarkdown(source), output));
}

test('raw HTML remains intact while plain Markdown punctuation is escaped', () => {
    const html = '<a href="https://docs.invalid/?p=2&v=3">Документы</a>';
    equal(renderMessage({message: html, format: 'html'}).message, html);
    match(renderMessage({message: 'version 0.9!'}).message, /0\\\.9\\!/);
});
