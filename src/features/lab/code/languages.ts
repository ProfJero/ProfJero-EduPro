export type LabFile = { name: string; content: string };
export type LangId = 'python' | 'javascript' | 'typescript' | 'web' | 'sql' | 'c' | 'cpp' | 'java' | 'csharp' | 'go' | 'rust' | 'php' | 'ruby' | 'kotlin';
export type LangConfig = { id: LangId; name: string; monaco: string; ext: string; runtime: 'browser' | 'server'; files: LabFile[]; main: string };

const f = (name: string, content: string): LabFile => ({ name, content });

export const LANGS: Record<LangId, LangConfig> = {
  python: { id: 'python', name: 'Python', monaco: 'python', ext: 'py', runtime: 'browser', main: 'main.py', files: [f('main.py', `# Welcome to the ProfJero Edu Code Lab 🐍
# Press Ctrl+Enter (or ⌘+Enter) to run. Type "def", "for", "if"… and press Tab for snippets.

def greet(name):
    return f"Akwaaba, {name}! Keep learning."

name = input("What is your name? ")
print(greet(name))

scores = [72, 85, 64, 90]
print("Average:", sum(scores) / len(scores))
`)] },
  javascript: { id: 'javascript', name: 'JavaScript', monaco: 'javascript', ext: 'js', runtime: 'browser', main: 'main.js', files: [f('main.js', `// Press Ctrl+Enter to run. Try typing "log" then Tab.
const scores = [72, 85, 64, 90];
const average = scores.reduce((a, b) => a + b, 0) / scores.length;
console.log('Average score:', average);

function greet(name) {
  return \`Akwaaba, \${name}!\`;
}
console.log(greet('ProfJero learner'));
`)] },
  typescript: { id: 'typescript', name: 'TypeScript', monaco: 'typescript', ext: 'ts', runtime: 'browser', main: 'main.ts', files: [f('main.ts', `type Student = { name: string; score: number };

const students: Student[] = [
  { name: 'Ama', score: 88 },
  { name: 'Kofi', score: 74 },
];

const best = students.reduce((a, b) => (a.score > b.score ? a : b));
console.log(\`Top student: \${best.name} (\${best.score})\`);
`)] },
  web: { id: 'web', name: 'HTML/CSS/JS', monaco: 'html', ext: 'html', runtime: 'browser', main: 'index.html', files: [
    f('index.html', `<!-- Tip: type  ul>li*3  then press Tab (Emmet) -->
<main class="card">
  <h1>Hello, ProfJero Edu!</h1>
  <p>Edit the HTML, CSS and JavaScript — the preview updates as you type.</p>
  <button id="btn">Click me</button>
</main>
`),
    f('style.css', `body { font-family: system-ui, sans-serif; display: grid; place-items: center; min-height: 100vh; margin: 0; background: #eef4ff; }
.card { background: white; padding: 2rem; border-radius: 1rem; box-shadow: 0 10px 30px -12px rgb(0 0 0 / .25); text-align: center; }
button { background: #1554d6; color: white; border: 0; padding: .6rem 1.2rem; border-radius: .6rem; font-weight: 600; cursor: pointer; }
`),
    f('script.js', `document.getElementById('btn').addEventListener('click', () => {
  console.log('Button clicked at', new Date().toLocaleTimeString());
  alert('Well done! 🎉');
});
`)] },
  sql: { id: 'sql', name: 'SQL', monaco: 'sql', ext: 'sql', runtime: 'browser', main: 'query.sql', files: [f('query.sql', `-- A sample database is loaded: students, subjects, results.
-- Press Ctrl+Enter to run. Each statement's results are shown.

SELECT s.name, sub.title AS subject, r.score
FROM results r
JOIN students s ON s.id = r.student_id
JOIN subjects sub ON sub.id = r.subject_id
WHERE r.score >= 70
ORDER BY r.score DESC;

SELECT sub.title, ROUND(AVG(r.score), 1) AS average
FROM results r JOIN subjects sub ON sub.id = r.subject_id
GROUP BY sub.title;
`)] },
  c: { id: 'c', name: 'C', monaco: 'c', ext: 'c', runtime: 'server', main: 'main.c', files: [f('main.c', `#include <stdio.h>

int main(void) {
    char name[50];
    printf("Enter your name: ");
    scanf("%49s", name);
    printf("Akwaaba, %s!\\n", name);
    return 0;
}
`)] },
  cpp: { id: 'cpp', name: 'C++', monaco: 'cpp', ext: 'cpp', runtime: 'server', main: 'main.cpp', files: [f('main.cpp', `#include <iostream>
#include <vector>
using namespace std;

int main() {
    vector<int> scores = {72, 85, 64, 90};
    int total = 0;
    for (int s : scores) total += s;
    cout << "Average: " << (double) total / scores.size() << endl;
    return 0;
}
`)] },
  java: { id: 'java', name: 'Java', monaco: 'java', ext: 'java', runtime: 'server', main: 'Main.java', files: [f('Main.java', `import java.util.Scanner;

public class Main {
    public static void main(String[] args) {
        Scanner in = new Scanner(System.in);
        System.out.print("Enter your name: ");
        String name = in.nextLine();
        System.out.println("Akwaaba, " + name + "!");
    }
}
`)] },
  csharp: { id: 'csharp', name: 'C#', monaco: 'csharp', ext: 'cs', runtime: 'server', main: 'Program.cs', files: [f('Program.cs', `using System;

class Program {
    static void Main() {
        Console.WriteLine("Akwaaba from C#!");
    }
}
`)] },
  go: { id: 'go', name: 'Go', monaco: 'go', ext: 'go', runtime: 'server', main: 'main.go', files: [f('main.go', `package main

import "fmt"

func main() {
    fmt.Println("Akwaaba from Go!")
}
`)] },
  rust: { id: 'rust', name: 'Rust', monaco: 'rust', ext: 'rs', runtime: 'server', main: 'main.rs', files: [f('main.rs', `fn main() {
    println!("Akwaaba from Rust!");
}
`)] },
  php: { id: 'php', name: 'PHP', monaco: 'php', ext: 'php', runtime: 'server', main: 'index.php', files: [f('index.php', `<?php
echo "Akwaaba from PHP!\\n";
`)] },
  ruby: { id: 'ruby', name: 'Ruby', monaco: 'ruby', ext: 'rb', runtime: 'server', main: 'main.rb', files: [f('main.rb', `puts "Akwaaba from Ruby!"
`)] },
  kotlin: { id: 'kotlin', name: 'Kotlin', monaco: 'kotlin', ext: 'kt', runtime: 'server', main: 'Main.kt', files: [f('Main.kt', `fun main() {
    println("Akwaaba from Kotlin!")
}
`)] },
};

export function monacoLanguageFor(file: string): string {
  const ext = file.split('.').pop()?.toLowerCase();
  return ({ py: 'python', js: 'javascript', mjs: 'javascript', ts: 'typescript', html: 'html', htm: 'html', css: 'css', json: 'json', sql: 'sql', c: 'c', h: 'c', cpp: 'cpp', hpp: 'cpp', java: 'java', cs: 'csharp', go: 'go', rs: 'rust', php: 'php', rb: 'ruby', kt: 'kotlin', md: 'markdown', txt: 'plaintext' } as Record<string, string>)[ext ?? ''] ?? 'plaintext';
}

export const SAMPLE_SQL_DB = `
CREATE TABLE students (id INTEGER PRIMARY KEY, name TEXT NOT NULL, class TEXT, age INTEGER);
CREATE TABLE subjects (id INTEGER PRIMARY KEY, title TEXT NOT NULL);
CREATE TABLE results (id INTEGER PRIMARY KEY, student_id INTEGER REFERENCES students(id), subject_id INTEGER REFERENCES subjects(id), score INTEGER);
INSERT INTO students (name, class, age) VALUES ('Ama Mensah','SHS 2A',16),('Kofi Appiah','SHS 2A',17),('Efua Boateng','SHS 2B',16),('Yaw Asante','SHS 2B',17),('Akosua Darko','SHS 2A',16),('Kwame Owusu','SHS 2B',18);
INSERT INTO subjects (title) VALUES ('Mathematics'),('Computing'),('Science'),('English');
INSERT INTO results (student_id, subject_id, score) VALUES (1,1,82),(1,2,91),(1,3,77),(1,4,69),(2,1,64),(2,2,73),(2,3,58),(2,4,80),(3,1,90),(3,2,88),(3,3,85),(3,4,92),(4,1,55),(4,2,67),(4,3,71),(4,4,63),(5,1,78),(5,2,95),(5,3,69),(5,4,74),(6,1,70),(6,2,60),(6,3,88),(6,4,81);
`;
