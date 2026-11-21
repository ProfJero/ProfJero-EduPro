/* VS Code-style editing helpers for Monaco: Emmet, snippets and Python
   completion (Monaco ships IntelliSense for JS/TS/HTML/CSS/JSON already). */
import type * as Monaco from 'monaco-editor';

let done = false;

type Snip = { label: string; insert: string; doc: string };
const PY_SNIPPETS: Snip[] = [
  { label: 'def', insert: 'def ${1:name}(${2:params}):\n\t${3:pass}', doc: 'Function definition' },
  { label: 'for', insert: 'for ${1:item} in ${2:items}:\n\t${3:pass}', doc: 'for loop' },
  { label: 'forr', insert: 'for ${1:i} in range(${2:10}):\n\t${3:pass}', doc: 'for … in range()' },
  { label: 'while', insert: 'while ${1:condition}:\n\t${2:pass}', doc: 'while loop' },
  { label: 'if', insert: 'if ${1:condition}:\n\t${2:pass}', doc: 'if statement' },
  { label: 'ifelse', insert: 'if ${1:condition}:\n\t${2:pass}\nelse:\n\t${3:pass}', doc: 'if / else' },
  { label: 'elif', insert: 'elif ${1:condition}:\n\t${2:pass}', doc: 'elif branch' },
  { label: 'class', insert: 'class ${1:Name}:\n\tdef __init__(self${2:, value}):\n\t\t${3:self.value = value}', doc: 'Class with constructor' },
  { label: 'try', insert: 'try:\n\t${1:pass}\nexcept ${2:Exception} as ${3:e}:\n\t${4:print(e)}', doc: 'try / except' },
  { label: 'with', insert: "with open(${1:'file.txt'}) as ${2:f}:\n\t${3:data = f.read()}", doc: 'with open()' },
  { label: 'main', insert: "if __name__ == '__main__':\n\t${1:main()}", doc: 'Main guard' },
  { label: 'lc', insert: '[${1:x} for ${1:x} in ${2:items}${3: if ${4:condition}}]', doc: 'List comprehension' },
  { label: 'pr', insert: 'print(${1})', doc: 'print()' },
  { label: 'inp', insert: "${1:value} = input(${2:'Enter a value: '})", doc: 'input()' },
  { label: 'fstr', insert: 'f"${1:text} {${2:value}}"', doc: 'f-string' },
];
const PY_KEYWORDS = ['False', 'None', 'True', 'and', 'as', 'assert', 'async', 'await', 'break', 'class', 'continue', 'def', 'del', 'elif', 'else', 'except', 'finally', 'for', 'from', 'global', 'if', 'import', 'in', 'is', 'lambda', 'nonlocal', 'not', 'or', 'pass', 'raise', 'return', 'try', 'while', 'with', 'yield'];
const PY_BUILTINS: [string, string][] = [
  ['print', 'print(*values, sep=" ", end="\\n")'], ['input', 'input(prompt) -> str'], ['len', 'len(obj) -> int'], ['range', 'range(start, stop, step)'], ['int', 'int(x) -> int'],
  ['float', 'float(x) -> float'], ['str', 'str(x) -> str'], ['list', 'list(iterable)'], ['dict', 'dict(**kwargs)'], ['set', 'set(iterable)'], ['tuple', 'tuple(iterable)'],
  ['sum', 'sum(iterable, start=0)'], ['min', 'min(iterable)'], ['max', 'max(iterable)'], ['abs', 'abs(x)'], ['round', 'round(number, ndigits)'], ['sorted', 'sorted(iterable, key=None, reverse=False)'],
  ['enumerate', 'enumerate(iterable, start=0)'], ['zip', 'zip(*iterables)'], ['map', 'map(function, iterable)'], ['filter', 'filter(function, iterable)'], ['open', 'open(file, mode="r")'],
  ['type', 'type(obj)'], ['isinstance', 'isinstance(obj, class)'], ['bool', 'bool(x)'], ['any', 'any(iterable)'], ['all', 'all(iterable)'], ['reversed', 'reversed(seq)'], ['divmod', 'divmod(a, b)'], ['pow', 'pow(base, exp)'],
];
const PY_METHODS = ['append', 'extend', 'insert', 'pop', 'remove', 'sort', 'reverse', 'count', 'index', 'keys', 'values', 'items', 'get', 'update', 'split', 'join', 'strip', 'lower', 'upper', 'replace', 'startswith', 'endswith', 'format', 'find', 'title', 'isdigit'];
const JS_SNIPPETS: Snip[] = [
  { label: 'log', insert: 'console.log(${1});', doc: 'console.log()' },
  { label: 'fn', insert: 'function ${1:name}(${2:params}) {\n\t${3}\n}', doc: 'Function' },
  { label: 'afn', insert: 'const ${1:name} = (${2:params}) => {\n\t${3}\n};', doc: 'Arrow function' },
  { label: 'for', insert: 'for (let ${1:i} = 0; ${1:i} < ${2:array}.length; ${1:i}++) {\n\t${3}\n}', doc: 'for loop' },
  { label: 'forof', insert: 'for (const ${1:item} of ${2:items}) {\n\t${3}\n}', doc: 'for…of' },
  { label: 'ife', insert: 'if (${1:condition}) {\n\t${2}\n} else {\n\t${3}\n}', doc: 'if / else' },
  { label: 'trycatch', insert: 'try {\n\t${1}\n} catch (${2:error}) {\n\t${3:console.error(error);}\n}', doc: 'try / catch' },
  { label: 'qs', insert: "document.querySelector('${1:selector}')", doc: 'querySelector' },
  { label: 'ael', insert: "${1:element}.addEventListener('${2:click}', (${3:event}) => {\n\t${4}\n});", doc: 'addEventListener' },
  { label: 'map', insert: '${1:array}.map((${2:item}) => ${3:item})', doc: 'Array.map' },
];
const C_LIKE: Record<string, Snip[]> = {
  c: [{ label: 'main', insert: '#include <stdio.h>\n\nint main(void) {\n\t${1}\n\treturn 0;\n}', doc: 'main()' }, { label: 'for', insert: 'for (int ${1:i} = 0; ${1:i} < ${2:n}; ${1:i}++) {\n\t${3}\n}', doc: 'for loop' }, { label: 'pf', insert: 'printf("${1:%d}\\n", ${2});', doc: 'printf' }],
  cpp: [{ label: 'main', insert: '#include <iostream>\nusing namespace std;\n\nint main() {\n\t${1}\n\treturn 0;\n}', doc: 'main()' }, { label: 'for', insert: 'for (int ${1:i} = 0; ${1:i} < ${2:n}; ${1:i}++) {\n\t${3}\n}', doc: 'for loop' }, { label: 'cout', insert: 'cout << ${1} << endl;', doc: 'cout' }],
  java: [{ label: 'main', insert: 'public static void main(String[] args) {\n\t${1}\n}', doc: 'main method' }, { label: 'sout', insert: 'System.out.println(${1});', doc: 'println' }, { label: 'fori', insert: 'for (int ${1:i} = 0; ${1:i} < ${2:n}; ${1:i}++) {\n\t${3}\n}', doc: 'for loop' }],
  csharp: [{ label: 'cw', insert: 'Console.WriteLine(${1});', doc: 'Console.WriteLine' }],
  go: [{ label: 'fp', insert: 'fmt.Println(${1})', doc: 'fmt.Println' }],
};

export function setupMonaco(monaco: typeof Monaco, emmet: { emmetHTML: (m: typeof Monaco, langs?: string[]) => unknown; emmetCSS: (m: typeof Monaco, langs?: string[]) => unknown; emmetJSX: (m: typeof Monaco, langs?: string[]) => unknown }) {
  if (done) return;
  done = true;
  emmet.emmetHTML(monaco, ['html', 'php']);
  emmet.emmetCSS(monaco, ['css', 'scss', 'less']);
  emmet.emmetJSX(monaco, ['javascript', 'typescript']);

  const snippetItems = (snips: Snip[], range: Monaco.IRange) => snips.map((s) => ({
    label: s.label, kind: monaco.languages.CompletionItemKind.Snippet, insertText: s.insert,
    insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet, documentation: s.doc, detail: s.doc, range, sortText: `0${s.label}`,
  }));
  const wordRange = (model: Monaco.editor.ITextModel, position: Monaco.Position): Monaco.IRange => {
    const w = model.getWordUntilPosition(position);
    return { startLineNumber: position.lineNumber, endLineNumber: position.lineNumber, startColumn: w.startColumn, endColumn: w.endColumn };
  };

  monaco.languages.registerCompletionItemProvider('python', {
    triggerCharacters: ['.'],
    provideCompletionItems(model, position) {
      const range = wordRange(model, position);
      const before = model.getLineContent(position.lineNumber).slice(0, position.column - 1);
      if (/\.\w*$/.test(before)) {
        return { suggestions: PY_METHODS.map((m) => ({ label: m, kind: monaco.languages.CompletionItemKind.Method, insertText: `${m}(\${1})`, insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet, range })) };
      }
      const words = new Set((model.getValue().match(/[A-Za-z_][A-Za-z0-9_]{2,}/g) ?? []));
      PY_KEYWORDS.forEach((k) => words.delete(k));
      PY_BUILTINS.forEach(([b]) => words.delete(b));
      return {
        suggestions: [
          ...snippetItems(PY_SNIPPETS, range),
          ...PY_KEYWORDS.map((k) => ({ label: k, kind: monaco.languages.CompletionItemKind.Keyword, insertText: k, range })),
          ...PY_BUILTINS.map(([b, sig]) => ({ label: b, kind: monaco.languages.CompletionItemKind.Function, insertText: `${b}(\${1})`, insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet, detail: sig, documentation: sig, range })),
          ...[...words].map((w) => ({ label: w, kind: monaco.languages.CompletionItemKind.Variable, insertText: w, range, sortText: `9${w}` })),
        ],
      };
    },
  });
  monaco.languages.registerCompletionItemProvider('javascript', { provideCompletionItems: (m, p) => ({ suggestions: snippetItems(JS_SNIPPETS, wordRange(m, p)) }) });
  monaco.languages.registerCompletionItemProvider('typescript', { provideCompletionItems: (m, p) => ({ suggestions: snippetItems(JS_SNIPPETS, wordRange(m, p)) }) });
  for (const [lang, snips] of Object.entries(C_LIKE)) {
    monaco.languages.registerCompletionItemProvider(lang, { provideCompletionItems: (m, p) => ({ suggestions: snippetItems(snips, wordRange(m, p)) }) });
  }
  // Python auto-indent after a colon, VS Code style.
  monaco.languages.setLanguageConfiguration('python', {
    onEnterRules: [{ beforeText: /:\s*(#.*)?$/, action: { indentAction: monaco.languages.IndentAction.Indent } }],
    brackets: [['(', ')'], ['[', ']'], ['{', '}']],
    autoClosingPairs: [{ open: '(', close: ')' }, { open: '[', close: ']' }, { open: '{', close: '}' }, { open: '"', close: '"', notIn: ['string'] }, { open: "'", close: "'", notIn: ['string', 'comment'] }],
    comments: { lineComment: '#' },
  });
  monaco.editor.defineTheme('profjero-dark', { base: 'vs-dark', inherit: true, rules: [], colors: { 'editor.background': '#0b1222', 'editorGutter.background': '#0b1222' } });
  monaco.editor.defineTheme('profjero-light', { base: 'vs', inherit: true, rules: [], colors: { 'editor.background': '#ffffff' } });
}
