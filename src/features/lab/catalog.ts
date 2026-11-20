export type LabKind = 'code' | 'science' | 'math';
export type LabTool = { id: string; lab: LabKind; name: string; description: string; subject: string; level: string };

export const LAB_TOOLS: LabTool[] = [
  { id: 'python', lab: 'code', name: 'Python', description: 'Run Python 3 in your browser — works offline once loaded.', subject: 'Computing', level: 'JHS–University' },
  { id: 'web', lab: 'code', name: 'HTML, CSS & JavaScript', description: 'Build web pages with live preview and Emmet.', subject: 'Computing', level: 'JHS–University' },
  { id: 'javascript', lab: 'code', name: 'JavaScript', description: 'Modern JavaScript with a console.', subject: 'Computing', level: 'SHS–University' },
  { id: 'typescript', lab: 'code', name: 'TypeScript', description: 'Typed JavaScript with IntelliSense.', subject: 'Computing', level: 'University' },
  { id: 'sql', lab: 'code', name: 'SQL (SQLite)', description: 'Query a sample school database.', subject: 'Computing', level: 'SHS–University' },
  { id: 'c', lab: 'code', name: 'C', description: 'Compiled on the server.', subject: 'Computing', level: 'University' },
  { id: 'cpp', lab: 'code', name: 'C++', description: 'Compiled on the server.', subject: 'Computing', level: 'University' },
  { id: 'java', lab: 'code', name: 'Java', description: 'Compiled on the server.', subject: 'Computing', level: 'SHS–University' },
  { id: 'csharp', lab: 'code', name: 'C#', description: 'Compiled on the server.', subject: 'Computing', level: 'University' },
  { id: 'go', lab: 'code', name: 'Go', description: 'Compiled on the server.', subject: 'Computing', level: 'University' },
  { id: 'rust', lab: 'code', name: 'Rust', description: 'Compiled on the server.', subject: 'Computing', level: 'University' },
  { id: 'php', lab: 'code', name: 'PHP', description: 'Runs on the server.', subject: 'Computing', level: 'University' },
  { id: 'ruby', lab: 'code', name: 'Ruby', description: 'Runs on the server.', subject: 'Computing', level: 'University' },
  { id: 'kotlin', lab: 'code', name: 'Kotlin', description: 'Compiled on the server.', subject: 'Computing', level: 'University' },
  { id: 'circuit', lab: 'science', name: 'Electric Circuits & Ohm’s Law', description: 'Build series and parallel circuits, measure current and voltage.', subject: 'Science / Physics', level: 'JHS–SHS' },
  { id: 'projectile', lab: 'science', name: 'Projectile Motion', description: 'Launch objects on Earth, the Moon or Mars.', subject: 'Physics', level: 'SHS' },
  { id: 'pendulum', lab: 'science', name: 'Simple Pendulum', description: 'Explore how length and gravity change the period.', subject: 'Physics', level: 'SHS' },
  { id: 'titration', lab: 'science', name: 'Acids, Bases & pH', description: 'Neutralise an acid with a base and watch the indicator.', subject: 'Chemistry', level: 'JHS–SHS' },
  { id: 'elements', lab: 'science', name: 'Periodic Table Explorer', description: 'The first 20 elements with electron shells.', subject: 'Chemistry', level: 'JHS–SHS' },
  { id: 'buoyancy', lab: 'science', name: 'Density & Floating', description: 'Will it float? Compare densities of materials.', subject: 'Science', level: 'JHS' },
  { id: 'grapher', lab: 'math', name: 'Function Grapher', description: 'Plot functions with sliders and a table of values.', subject: 'Mathematics', level: 'JHS–University' },
  { id: 'solver', lab: 'math', name: 'Equation Solver', description: 'Linear and quadratic equations with step-by-step working.', subject: 'Mathematics', level: 'JHS–SHS' },
  { id: 'statistics', lab: 'math', name: 'Statistics Workbench', description: 'Mean, median, mode, spread and charts from your data.', subject: 'Mathematics', level: 'JHS–SHS' },
  { id: 'triangle', lab: 'math', name: 'Triangle & Angle Explorer', description: 'Drag the corners; watch angles, area and Pythagoras.', subject: 'Mathematics', level: 'JHS' },
  { id: 'fractions', lab: 'math', name: 'Fraction Bars', description: 'See fractions add, subtract and simplify.', subject: 'Mathematics', level: 'Basic–JHS' },
  { id: 'probability', lab: 'math', name: 'Probability Simulator', description: 'Flip coins and roll dice thousands of times.', subject: 'Mathematics', level: 'JHS–SHS' },
];

export const CURATED_PHET = [
  { title: 'Circuit Construction Kit: DC', url: 'https://phet.colorado.edu/sims/html/circuit-construction-kit-dc/latest/circuit-construction-kit-dc_en.html', subject: 'Physics' },
  { title: 'States of Matter', url: 'https://phet.colorado.edu/sims/html/states-of-matter/latest/states-of-matter_en.html', subject: 'Chemistry' },
  { title: 'pH Scale', url: 'https://phet.colorado.edu/sims/html/ph-scale/latest/ph-scale_en.html', subject: 'Chemistry' },
  { title: 'Forces and Motion: Basics', url: 'https://phet.colorado.edu/sims/html/forces-and-motion-basics/latest/forces-and-motion-basics_en.html', subject: 'Physics' },
  { title: 'Build an Atom', url: 'https://phet.colorado.edu/sims/html/build-an-atom/latest/build-an-atom_en.html', subject: 'Chemistry' },
  { title: 'Area Builder', url: 'https://phet.colorado.edu/sims/html/area-builder/latest/area-builder_en.html', subject: 'Mathematics' },
];
