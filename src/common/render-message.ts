import type {TGBotMessage, TGBotMessageTemplate, TemplateContext, TGBotMessageFormat} from '../interfaces/config';
import {readFileSync} from 'node:fs';
import {extname, resolve} from 'node:path';
import {renderMarkdown} from './markdown';

const lookup = (context: TemplateContext, expression: string): string => {
 const path = expression.trim();
 if (!/^[A-Za-z_$][\w$]*(?:\.(?:[A-Za-z_$][\w$]*|\d+))*$/.test(path)) {
  throw new Error(`Unsupported template expression: ${path}. Use dotted paths or a message function.`);
 }
 let value: unknown = context;
 for (const key of path.split('.')) {
  if (['__proto__', 'prototype', 'constructor'].includes(key)) throw new Error('Unsafe template path.');
  if (value == null || !Object.hasOwn(Object(value), key)) return '';
  value = (value as Record<string, unknown>)[key];
 }
 return value == null ? '' : String(value);
};
const interpolate = (source: string, context: TemplateContext): string => {
 if (/{%|{#|<%/.test(source)) throw new Error('Template control tags are unsupported. Use a message function in a JavaScript configuration.');
 return source.replace(/\$\{([^{}]+)\}|{{\s*([^{}]+?)\s*}}/g, (_, dollar, braces) => lookup(context, dollar ?? braces));
};
const renderMessage = (message: TGBotMessage | TGBotMessageTemplate, context: TemplateContext = {}): {message: string; format: TGBotMessageFormat} => {
 const data = {...context, ...message.customData};
 if ('message' in message) {
  const text = typeof message.message === 'function' ? message.message(data) : interpolate(message.message, data);
  if (typeof text !== 'string') throw new TypeError('A message function must return a string.');
  const format = message.format ?? 'markdown';
  return {message: format === 'html' ? text.trim() : renderMarkdown(text), format};
 }
 // File templates already contain Telegram HTML or MarkdownV2 and are not converted.
 return {
  message: interpolate(readFileSync(resolve(message.path), 'utf8'), data).trim(),
  format: extname(message.path).toLowerCase() === '.html' ? 'html' : 'markdown',
 };
};
export {renderMessage};
