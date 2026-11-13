import {test} from 'node:test';
import {deepEqual, equal, match, throws, doesNotThrow} from 'node:assert/strict';
import type {Context, TGBotConfig} from '../index';
import {verifyConditions} from '../index';
import {packageLabel} from '../src/common/configuration';
import {composeNotification} from '../src/common/compose-notification';

const settings: TGBotConfig = {notifications: []};
const runtime = (env: Context['env']): Context => ({env, logger: {log: () => undefined}});

for (const [title, variables, code] of [
    ['absent credential', {}, 'ENOTELEGRAMTOKEN'],
    ['blank credential', {TELEGRAM_BOT_TOKEN: '  '}, 'ENOTELEGRAMTOKEN'],
    ['absent label', {TELEGRAM_BOT_TOKEN: 'credential'}, 'ENOPACKAGENAME'],
    ['blank label', {TELEGRAM_BOT_TOKEN: 'credential', SEMANTIC_RELEASE_PACKAGE: '\t'}, 'ENOPACKAGENAME'],
] as const) {
    test(`configuration diagnosis: ${title}`, () => {
        const messages: string[] = [];
        throws(() => verifyConditions(settings, {...runtime(variables), logger: {log: value => messages.push(value)}}),
            issue => issue instanceof Error && 'code' in issue && issue.code === code &&
                'semanticRelease' in issue && issue.semanticRelease === true &&
                'details' in issue && typeof issue.details === 'string' && issue.details.length > 0);
        equal(messages.length, 1);
    });
}

test('package label priority uses options, explicit environment, then package-manager environment', () => {
    const variables = {SEMANTIC_RELEASE_PACKAGE: 'env-label', npm_package_name: 'manifest-label'};
    equal(packageLabel({...settings, packageName: 'option-label'}, variables), 'option-label');
    equal(packageLabel(settings, variables), 'env-label');
    equal(packageLabel(settings, {...variables, SEMANTIC_RELEASE_PACKAGE: ''}), 'manifest-label');
    doesNotThrow(() => verifyConditions({...settings, packageName: 'option-label'}, runtime({TELEGRAM_BOT_TOKEN: 'credential'})));
});

test('a successful default notification carries the version and release notes', () => {
    const message = composeNotification('success', '@scope/clock', {nextRelease: {version: '4.8.2', notes: '## Improvements\nFaster startup'}});
    deepEqual(message, {format: 'markdown', message: '# Release completed\n\nPackage: @scope/clock\n\nVersion: 4.8.2\n\n## Improvements\nFaster startup'});
    equal(composeNotification('success', 'clock', {}), undefined);
});

test('failure composition survives an early release failure and errors without a stack', () => {
    const issue = new Error('registry unavailable');
    issue.stack = undefined;
    const result = composeNotification('fail', undefined, {errors: [issue]});
    match(String(result?.message), /^# Release failed\n\nPackage: unnamed package/);
    match(String(result?.message), /Error: registry unavailable$/);
    match(String(composeNotification('fail', 'clock', {})?.message), /Package: clock/);
});
