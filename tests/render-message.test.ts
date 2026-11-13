import {describe, it} from 'node:test';
import * as assert from 'node:assert/strict';
import {renderMessage} from '../src/common/render-message';

describe('Render message', () => {
	describe('Markdown', () => {
		it('Message should render correctly', async () => {
			const renderedMessage = renderMessage({message: '**Title**\nContent'});

			assert.equal(renderedMessage.message, '*Title*\nContent');
			assert.equal(renderedMessage.format, 'markdown');
		});

		it('Message should render context correctly', async () => {
			const renderedMessage = renderMessage({message: '**${title}**\n${content}'}, {title: 'Title', content: 'Content'});

			assert.equal(renderedMessage.message, '*Title*\nContent');
			assert.equal(renderedMessage.format, 'markdown');
		});

		it('Message should preserve a release link and section heading after an unsupported small tag', async () => {
			const renderedMessage = renderMessage({
				message: [
					'<small>[3.7.6](https://gitlab.example/repository/-/releases/v3.7.6) (2026-08-20)</small>',
					'',
					'### ♻️ Рефакторинг:',
					'',
					'* refactor: update dependencies ([726a6a2](https://gitlab.example/repository/-/commit/726a6a2))'
				].join('\n')
			});

			assert.equal(renderedMessage.message, [
				'[3\\.7\\.6](https://gitlab.example/repository/-/releases/v3.7.6) \\(2026\\-08\\-20\\)',
				'',
				'*♻️ Рефакторинг:*',
				'',
				'•   refactor: update dependencies \\([726a6a2](https://gitlab.example/repository/-/commit/726a6a2)\\)'
			].join('\n'));
			assert.equal(renderedMessage.format, 'markdown');
		});
	})

	describe('HTML', () => {
		it('Message should render correctly', async () => {
			const renderedMessage = renderMessage({message: '<b>Title</b>\nContent', format: 'html'});

			assert.equal(renderedMessage.message, '<b>Title</b>\nContent');
			assert.equal(renderedMessage.format, 'html');
		});

		it('Message should render context correctly', async () => {
			const renderedMessage = renderMessage({message: '<b>${title}</b>\n${content}', format: 'html'}, {title: 'Title', content: 'Content'});

			assert.equal(renderedMessage.message, '<b>Title</b>\nContent');
			assert.equal(renderedMessage.format, 'html');
		});

		it('Message should not convert HTML links as Markdown', async () => {
			const renderedMessage = renderMessage({message: '<a href="https://example.com?a=1&b=2">Link</a>', format: 'html'});

			assert.equal(renderedMessage.message, '<a href="https://example.com?a=1&b=2">Link</a>');
			assert.equal(renderedMessage.format, 'html');
		});
	})
});

describe('Render template message', () => {
	describe('Markdown', () => {
		it('Message should render correctly', async () => {
			const renderedMessage = renderMessage({path: './tests/common/message.md'});

			assert.equal(renderedMessage.message.replace(/\s+/g, ""), '_Title_Content');
			assert.equal(renderedMessage.format, 'markdown');
		});

		it('Message should render context correctly', async () => {
			const renderedMessage = renderMessage({path: './tests/common/message-context.md'}, {title: 'Title', content: 'Content'});

			assert.equal(renderedMessage.message.replace(/\s+/g, ""), '_Title_Content');
			assert.equal(renderedMessage.format, 'markdown');
		});
	})

	describe('HTML', () => {
		it('Message should render correctly', async () => {
			const renderedMessage = renderMessage({path: './tests/common/message.html'});

			assert.equal(renderedMessage.message.replace(/\s+/g, ""), '<b>Title</b>Content');
			assert.equal(renderedMessage.format, 'html');
		});

		it('Message should render context correctly', async () => {
			const renderedMessage = renderMessage({path: './tests/common/message-context.html'}, {title: 'Title', content: 'Content'});

			assert.equal(renderedMessage.message.replace(/\s+/g, ""), '<b>Title</b>Content');
			assert.equal(renderedMessage.format, 'html');
		});
	})
});
