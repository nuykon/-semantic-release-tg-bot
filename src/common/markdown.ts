
const escape = (text: string): string => text.replace(/[_*\[\]()~`>#+\-=|{}.!\\]/g, '\\$&');
const codeEscape = (text: string): string => text.replace(/[`\\]/g, '\\$&');

// A deliberately small release-note dialect, not a CommonMark implementation.
const inline = (text: string, depth = 0): string => {
 if (depth > 16) return escape(text);
 let result = '';
 for (let i = 0; i < text.length;) {
  if (text[i] === '\\' && i + 1 < text.length) {
   result += escape(text[i + 1]); i += 2; continue;
  }
  if (text[i] === '`') {
   const end = text.indexOf('`', i + 1);
   if (end > i + 1) {
    result += '`' + codeEscape(text.slice(i + 1, end)) + '`'; i = end + 1; continue;
   }
  }
  if (text[i] === '[') {
   const labelEnd = text.indexOf('](', i + 1);
   if (labelEnd !== -1) {
    let end = labelEnd + 2, balance = 1;
    for (; end < text.length; end++) {
     if (text[end] === '\\') { end++; continue; }
     if (text[end] === '(') balance++;
     if (text[end] === ')' && --balance === 0) break;
    }
    if (balance === 0) {
     const url = text.slice(labelEnd + 2, end);
     if (/^(https?:\/\/|tg:\/\/|mailto:)[^\s]+$/i.test(url)) {
      result += '[' + inline(text.slice(i + 1, labelEnd), depth + 1) + '](' + url.replace(/[)\\]/g, '\\$&') + ')';
      i = end + 1; continue;
     }
    }
   }
  }
  const delimiter = ['**', '__', '~~', '*', '_'].find(d => text.startsWith(d, i));
  if (delimiter) {
   const end = text.indexOf(delimiter, i + delimiter.length);
   if (end > i + delimiter.length) {
    const marker = delimiter === '**' || delimiter === '__' ? '*' : delimiter === '~~' ? '~' : '_';
    result += marker + inline(text.slice(i + delimiter.length, end), depth + 1) + marker;
    i = end + delimiter.length; continue;
   }
  }
  result += escape(text[i]); i++;
 }
 return result;
};

const renderMarkdown = (source: string): string => {
 const lines = source.replace(/<\/?small\s*>/gi, '').replace(/\r\n?/g, '\n').split('\n');
 const output = [];
 for (let i = 0; i < lines.length; i++) {
  const fence = /^\s*```([\w+-]*)\s*$/.exec(lines[i]);
  if (fence) {
   const code = [];
   while (++i < lines.length && !/^\s*```\s*$/.test(lines[i])) code.push(lines[i]);
   output.push('```' + fence[1] + '\n' + codeEscape(code.join('\n')) + '\n```');
   continue;
  }
  const heading = /^#{1,6}\s+(.+?)\s*#*\s*$/.exec(lines[i]);
  if (heading) output.push('*' + inline(heading[1]) + '*');
  else output.push(inline(lines[i].replace(/^\s*[-+*]\s+/, '•   ')));
 }
 return output.join('\n').trim();
};

export {renderMarkdown};
