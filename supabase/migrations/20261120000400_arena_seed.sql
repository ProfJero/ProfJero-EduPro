-- =============================================================================
-- 0015 Challenge Arena seed content (original questions, puzzles and passages)
-- =============================================================================

insert into public.arena_challenges (slug, game, track, title, description, subject, level, difficulty, time_limit_seconds, xp_reward, config) values
  ('math-sprint-1', 'math_sprint', 'math-sprint', 'Math Sprint · Level 1', 'Solve 15 + problems as fast as you can.', 'Mathematics', 1, 'easy', 90, 40, '{"ops": ["+"], "min": 1, "max": 10, "count": 15}'::jsonb),
  ('math-sprint-2', 'math_sprint', 'math-sprint', 'Math Sprint · Level 2', 'Solve 15 + - problems as fast as you can.', 'Mathematics', 2, 'easy', 90, 50, '{"ops": ["+", "-"], "min": 1, "max": 20, "count": 15}'::jsonb),
  ('math-sprint-3', 'math_sprint', 'math-sprint', 'Math Sprint · Level 3', 'Solve 15 × problems as fast as you can.', 'Mathematics', 3, 'easy', 90, 60, '{"ops": ["×"], "min": 2, "max": 10, "count": 15}'::jsonb),
  ('math-sprint-4', 'math_sprint', 'math-sprint', 'Math Sprint · Level 4', 'Solve 15 + - problems as fast as you can.', 'Mathematics', 4, 'medium', 120, 70, '{"ops": ["+", "-"], "min": 10, "max": 99, "count": 15}'::jsonb),
  ('math-sprint-5', 'math_sprint', 'math-sprint', 'Math Sprint · Level 5', 'Solve 15 × ÷ problems as fast as you can.', 'Mathematics', 5, 'medium', 120, 80, '{"ops": ["×", "÷"], "min": 2, "max": 12, "count": 15}'::jsonb),
  ('math-sprint-6', 'math_sprint', 'math-sprint', 'Math Sprint · Level 6', 'Solve 20 + - × problems as fast as you can.', 'Mathematics', 6, 'medium', 120, 90, '{"ops": ["+", "-", "×"], "min": 1, "max": 30, "count": 20}'::jsonb),
  ('math-sprint-7', 'math_sprint', 'math-sprint', 'Math Sprint · Level 7', 'Solve 15 × problems as fast as you can.', 'Mathematics', 7, 'medium', 120, 100, '{"ops": ["×"], "min": 2, "max": 20, "count": 15}'::jsonb),
  ('math-sprint-8', 'math_sprint', 'math-sprint', 'Math Sprint · Level 8', 'Solve 20 + - × ÷ problems as fast as you can.', 'Mathematics', 8, 'hard', 120, 110, '{"ops": ["+", "-", "×", "÷"], "min": 2, "max": 15, "count": 20}'::jsonb),
  ('math-sprint-9', 'math_sprint', 'math-sprint', 'Math Sprint · Level 9', 'Solve 15 + - problems as fast as you can.', 'Mathematics', 9, 'hard', 150, 120, '{"ops": ["+", "-"], "min": 100, "max": 999, "count": 15}'::jsonb),
  ('math-sprint-10', 'math_sprint', 'math-sprint', 'Math Sprint · Level 10', 'Solve 20 + - × ÷ problems as fast as you can.', 'Mathematics', 10, 'hard', 150, 130, '{"ops": ["+", "-", "×", "÷"], "min": 5, "max": 50, "count": 20}'::jsonb),
  ('typing-race-1', 'typing_race', 'typing-race', 'Typing Race · Level 1', 'Type the passage accurately. Speed is measured on the server.', 'Computing', 1, 'easy', 75, 40, '{"passage": "Learning is a journey. Every lesson you complete brings you one step closer to your goals. Keep going, stay curious and ask questions."}'::jsonb),
  ('typing-race-2', 'typing_race', 'typing-race', 'Typing Race · Level 2', 'Type the passage accurately. Speed is measured on the server.', 'Computing', 2, 'easy', 90, 50, '{"passage": "Ghana is a land of warm people, rich culture and bright young minds. With practice and patience, every learner can unveil something extraordinary."}'::jsonb),
  ('typing-race-3', 'typing_race', 'typing-race', 'Typing Race · Level 3', 'Type the passage accurately. Speed is measured on the server.', 'Computing', 3, 'medium', 105, 60, '{"passage": "A good programmer reads the problem carefully, plans the steps, writes clean code and tests it. Mistakes are not failures; they are clues."}'::jsonb),
  ('typing-race-4', 'typing_race', 'typing-race', 'Typing Race · Level 4', 'Type the passage accurately. Speed is measured on the server.', 'Computing', 4, 'medium', 120, 70, '{"passage": "Science helps us understand the world. We observe, ask questions, form hypotheses, run experiments and share what we discover with others."}'::jsonb),
  ('typing-race-5', 'typing_race', 'typing-race', 'Typing Race · Level 5', 'Type the passage accurately. Speed is measured on the server.', 'Computing', 5, 'medium', 135, 80, '{"passage": "Typing quickly is useful, but typing accurately is better. Keep your fingers on the home row, look at the screen and let your rhythm grow steadily."}'::jsonb),
  ('quiz-computing-1', 'quiz_rush', 'quiz-computing', 'Quiz Rush: Computing · Level 1', '10 quick questions. Beat the clock!', 'Computing', 1, 'easy', 150, 55, '{"count": 10}'::jsonb),
  ('quiz-computing-2', 'quiz_rush', 'quiz-computing', 'Quiz Rush: Computing · Level 2', '10 quick questions. Beat the clock!', 'Computing', 2, 'medium', 180, 70, '{"count": 10}'::jsonb),
  ('quiz-computing-3', 'quiz_rush', 'quiz-computing', 'Quiz Rush: Computing · Level 3', '10 quick questions. Beat the clock!', 'Computing', 3, 'hard', 210, 85, '{"count": 10}'::jsonb),
  ('quiz-science-1', 'quiz_rush', 'quiz-science', 'Quiz Rush: Science · Level 1', '10 quick questions. Beat the clock!', 'Science', 1, 'easy', 150, 55, '{"count": 10}'::jsonb),
  ('quiz-science-2', 'quiz_rush', 'quiz-science', 'Quiz Rush: Science · Level 2', '10 quick questions. Beat the clock!', 'Science', 2, 'medium', 180, 70, '{"count": 10}'::jsonb),
  ('quiz-science-3', 'quiz_rush', 'quiz-science', 'Quiz Rush: Science · Level 3', '10 quick questions. Beat the clock!', 'Science', 3, 'hard', 210, 85, '{"count": 10}'::jsonb),
  ('quiz-math-1', 'quiz_rush', 'quiz-math', 'Quiz Rush: Mathematics · Level 1', '10 quick questions. Beat the clock!', 'Mathematics', 1, 'easy', 150, 55, '{"count": 10}'::jsonb),
  ('quiz-math-2', 'quiz_rush', 'quiz-math', 'Quiz Rush: Mathematics · Level 2', '10 quick questions. Beat the clock!', 'Mathematics', 2, 'medium', 180, 70, '{"count": 10}'::jsonb),
  ('quiz-general-1', 'quiz_rush', 'quiz-general', 'Quiz Rush: Ghana & World · Level 1', '10 quick questions. Beat the clock!', 'General knowledge', 1, 'easy', 150, 55, '{"count": 10}'::jsonb),
  ('word-builder-1', 'word_builder', 'word-builder', 'Word Builder · Level 1', 'Unscramble the letters using the clue.', 'English Language', 1, 'easy', 105, 40, '{"count": 8}'::jsonb),
  ('word-builder-2', 'word_builder', 'word-builder', 'Word Builder · Level 2', 'Unscramble the letters using the clue.', 'English Language', 2, 'easy', 120, 50, '{"count": 8}'::jsonb),
  ('word-builder-3', 'word_builder', 'word-builder', 'Word Builder · Level 3', 'Unscramble the letters using the clue.', 'English Language', 3, 'medium', 135, 60, '{"count": 8}'::jsonb),
  ('word-builder-4', 'word_builder', 'word-builder', 'Word Builder · Level 4', 'Unscramble the letters using the clue.', 'English Language', 4, 'medium', 150, 70, '{"count": 8}'::jsonb),
  ('word-builder-5', 'word_builder', 'word-builder', 'Word Builder · Level 5', 'Unscramble the letters using the clue.', 'English Language', 5, 'hard', 165, 80, '{"count": 8}'::jsonb),
  ('code-python-1', 'code_quest', 'code-python', 'Code Quest: Python · Level 1', 'Return the sum of two numbers a and b.', 'Computing', 1, 'easy', 600, 60, '{"language": "python", "function": "add", "prompt": "Return the sum of two numbers a and b.", "starter": "def add(a, b):\n    # your code here\n    pass\n", "tests": [{"args": [2, 3], "expected": 5}, {"args": [-1, 1], "expected": 0}, {"args": [10, 15], "expected": 25}]}'::jsonb),
  ('code-python-2', 'code_quest', 'code-python', 'Code Quest: Python · Level 2', 'Return the larger of two numbers a and b.', 'Computing', 2, 'easy', 600, 70, '{"language": "python", "function": "largest", "prompt": "Return the larger of two numbers a and b.", "starter": "def largest(a, b):\n    # your code here\n    pass\n", "tests": [{"args": [3, 9], "expected": 9}, {"args": [12, 4], "expected": 12}, {"args": [-5, -2], "expected": -2}]}'::jsonb),
  ('code-python-3', 'code_quest', 'code-python', 'Code Quest: Python · Level 3', 'Return how many vowels (a, e, i, o, u — any case) are in the string s.', 'Computing', 3, 'medium', 600, 80, '{"language": "python", "function": "count_vowels", "prompt": "Return how many vowels (a, e, i, o, u — any case) are in the string s.", "starter": "def count_vowels(s):\n    # your code here\n    pass\n", "tests": [{"args": ["Ghana"], "expected": 2}, {"args": ["PROFJERO"], "expected": 3}, {"args": ["rhythm"], "expected": 0}]}'::jsonb),
  ('code-python-4', 'code_quest', 'code-python', 'Code Quest: Python · Level 4', 'Return the string s reversed.', 'Computing', 4, 'medium', 600, 90, '{"language": "python", "function": "reverse", "prompt": "Return the string s reversed.", "starter": "def reverse(s):\n    # your code here\n    pass\n", "tests": [{"args": ["abc"], "expected": "cba"}, {"args": ["Accra"], "expected": "arccA"}, {"args": [""], "expected": ""}]}'::jsonb),
  ('code-python-5', 'code_quest', 'code-python', 'Code Quest: Python · Level 5', 'Return True if n is a prime number, otherwise False.', 'Computing', 5, 'medium', 600, 100, '{"language": "python", "function": "is_prime", "prompt": "Return True if n is a prime number, otherwise False.", "starter": "def is_prime(n):\n    # your code here\n    pass\n", "tests": [{"args": [2], "expected": true}, {"args": [15], "expected": false}, {"args": [17], "expected": true}, {"args": [1], "expected": false}]}'::jsonb),
  ('code-python-6', 'code_quest', 'code-python', 'Code Quest: Python · Level 6', 'Return "Fizz" if n is divisible by 3, "Buzz" if by 5, "FizzBuzz" if by both, otherwise n as a string.', 'Computing', 6, 'medium', 600, 110, '{"language": "python", "function": "fizzbuzz", "prompt": "Return \"Fizz\" if n is divisible by 3, \"Buzz\" if by 5, \"FizzBuzz\" if by both, otherwise n as a string.", "starter": "def fizzbuzz(n):\n    # your code here\n    pass\n", "tests": [{"args": [3], "expected": "Fizz"}, {"args": [5], "expected": "Buzz"}, {"args": [15], "expected": "FizzBuzz"}, {"args": [7], "expected": "7"}]}'::jsonb),
  ('code-javascript-1', 'code_quest', 'code-javascript', 'Code Quest: JavaScript · Level 1', 'Return the sum of two numbers a and b.', 'Computing', 1, 'easy', 600, 60, '{"language": "javascript", "function": "add", "prompt": "Return the sum of two numbers a and b.", "starter": "function add(a, b) {\n  // your code here\n}\n", "tests": [{"args": [2, 3], "expected": 5}, {"args": [-1, 1], "expected": 0}, {"args": [10, 15], "expected": 25}]}'::jsonb),
  ('code-javascript-2', 'code_quest', 'code-javascript', 'Code Quest: JavaScript · Level 2', 'Return the larger of two numbers a and b.', 'Computing', 2, 'easy', 600, 70, '{"language": "javascript", "function": "largest", "prompt": "Return the larger of two numbers a and b.", "starter": "function largest(a, b) {\n  // your code here\n}\n", "tests": [{"args": [3, 9], "expected": 9}, {"args": [12, 4], "expected": 12}, {"args": [-5, -2], "expected": -2}]}'::jsonb),
  ('code-javascript-3', 'code_quest', 'code-javascript', 'Code Quest: JavaScript · Level 3', 'Return how many vowels (a, e, i, o, u — any case) are in the string s.', 'Computing', 3, 'medium', 600, 80, '{"language": "javascript", "function": "countVowels", "prompt": "Return how many vowels (a, e, i, o, u — any case) are in the string s.", "starter": "function countVowels(s) {\n  // your code here\n}\n", "tests": [{"args": ["Ghana"], "expected": 2}, {"args": ["PROFJERO"], "expected": 3}, {"args": ["rhythm"], "expected": 0}]}'::jsonb),
  ('code-javascript-4', 'code_quest', 'code-javascript', 'Code Quest: JavaScript · Level 4', 'Return the string s reversed.', 'Computing', 4, 'medium', 600, 90, '{"language": "javascript", "function": "reverse", "prompt": "Return the string s reversed.", "starter": "function reverse(s) {\n  // your code here\n}\n", "tests": [{"args": ["abc"], "expected": "cba"}, {"args": ["Accra"], "expected": "arccA"}, {"args": [""], "expected": ""}]}'::jsonb)
on conflict (slug) do nothing;

insert into public.arena_questions (challenge_id, prompt, options, answer, position)
select c.id, v.prompt, v.options, v.answer, v.pos from public.arena_challenges c, (values
  ('CPU stands for…', '["Central Processing Unit", "Computer Personal Unit", "Central Program Utility", "Control Processing Unit"]'::jsonb, 'Central Processing Unit', 0),
  ('Which of these is an input device?', '["Keyboard", "Monitor", "Printer", "Speaker"]'::jsonb, 'Keyboard', 1),
  ('How many bits make one byte?', '["8", "4", "16", "1024"]'::jsonb, '8', 2),
  ('Which memory loses its contents when power is switched off?', '["RAM", "ROM", "Hard disk", "Flash drive"]'::jsonb, 'RAM', 3),
  ('Which of these is an operating system?', '["Windows", "Microsoft Word", "Google Chrome", "Excel"]'::jsonb, 'Windows', 4),
  ('Which keyboard shortcut copies selected text in Windows?', '["Ctrl + C", "Ctrl + V", "Ctrl + X", "Ctrl + Z"]'::jsonb, 'Ctrl + C', 5),
  ('URL stands for…', '["Uniform Resource Locator", "Universal Resource Link", "Uniform Region Locator", "United Resource Link"]'::jsonb, 'Uniform Resource Locator', 6),
  ('The binary number 101 equals which decimal number?', '["5", "3", "6", "101"]'::jsonb, '5', 7),
  ('Which of these is a web browser?', '["Mozilla Firefox", "Linux", "Python", "PowerPoint"]'::jsonb, 'Mozilla Firefox', 8),
  ('Which device displays output on a screen?', '["Monitor", "Mouse", "Scanner", "Microphone"]'::jsonb, 'Monitor', 9)
) as v(prompt, options, answer, pos) where c.slug = 'quiz-computing-1'
  and not exists (select 1 from public.arena_questions x where x.challenge_id = c.id);

insert into public.arena_questions (challenge_id, prompt, options, answer, position)
select c.id, v.prompt, v.options, v.answer, v.pos from public.arena_challenges c, (values
  ('Which Python keyword defines a function?', '["def", "func", "function", "define"]'::jsonb, 'def', 0),
  ('HTML stands for…', '["HyperText Markup Language", "High Text Machine Language", "Hyperlink and Text Markup Language", "Home Tool Markup Language"]'::jsonb, 'HyperText Markup Language', 1),
  ('Which data type stores only True or False?', '["Boolean", "Integer", "String", "Float"]'::jsonb, 'Boolean', 2),
  ('A step-by-step procedure for solving a problem is called…', '["An algorithm", "A compiler", "A variable", "A browser"]'::jsonb, 'An algorithm', 3),
  ('The decimal number 10 in binary is…', '["1010", "1100", "1001", "1110"]'::jsonb, '1010', 4),
  ('Which symbol starts a comment in Python?', '["#", "//", "<!--", "%"]'::jsonb, '#', 5),
  ('LAN stands for…', '["Local Area Network", "Large Access Network", "Linked Area Node", "Local Access Number"]'::jsonb, 'Local Area Network', 6),
  ('Which loop keeps repeating while a condition is true?', '["A while loop", "An if statement", "A function", "A comment"]'::jsonb, 'A while loop', 7),
  ('What is the result of 7 // 2 in Python?', '["3", "3.5", "4", "1"]'::jsonb, '3', 8),
  ('Websites that show a padlock use which protocol?', '["HTTPS", "FTP", "HTTP", "SMTP"]'::jsonb, 'HTTPS', 9)
) as v(prompt, options, answer, pos) where c.slug = 'quiz-computing-2'
  and not exists (select 1 from public.arena_questions x where x.challenge_id = c.id);

insert into public.arena_questions (challenge_id, prompt, options, answer, position)
select c.id, v.prompt, v.options, v.answer, v.pos from public.arena_challenges c, (values
  ('What is the time complexity of binary search?', '["O(log n)", "O(n)", "O(n²)", "O(1)"]'::jsonb, 'O(log n)', 0),
  ('Which data structure is First-In, First-Out?', '["Queue", "Stack", "Tree", "Set"]'::jsonb, 'Queue', 1),
  ('What is 2 to the power of 10?', '["1024", "1000", "512", "2048"]'::jsonb, '1024', 2),
  ('Which SQL command retrieves data from a table?', '["SELECT", "INSERT", "UPDATE", "DELETE"]'::jsonb, 'SELECT', 3),
  ('What does CSS mainly control on a web page?', '["Presentation and styling", "Database queries", "Server security", "Network speed"]'::jsonb, 'Presentation and styling', 4),
  ('Hexadecimal F equals which decimal number?', '["15", "16", "14", "10"]'::jsonb, '15', 5),
  ('Which of these is a markup language rather than a programming language?', '["HTML", "Python", "Java", "C++"]'::jsonb, 'HTML', 6),
  ('What does len("Ghana") return in Python?', '["5", "4", "6", "1"]'::jsonb, '5', 7),
  ('Which logic gate outputs 1 only when both inputs are 1?', '["AND", "OR", "NOT", "XOR"]'::jsonb, 'AND', 8),
  ('What does an IP address identify?', '["A device on a network", "A file type", "A programming language", "A web page title"]'::jsonb, 'A device on a network', 9)
) as v(prompt, options, answer, pos) where c.slug = 'quiz-computing-3'
  and not exists (select 1 from public.arena_questions x where x.challenge_id = c.id);

insert into public.arena_questions (challenge_id, prompt, options, answer, position)
select c.id, v.prompt, v.options, v.answer, v.pos from public.arena_challenges c, (values
  ('What is the chemical formula for water?', '["H₂O", "CO₂", "O₂", "NaCl"]'::jsonb, 'H₂O', 0),
  ('Which force pulls objects towards the Earth?', '["Gravity", "Friction", "Magnetism", "Tension"]'::jsonb, 'Gravity', 1),
  ('Green plants make their own food by…', '["Photosynthesis", "Respiration", "Digestion", "Evaporation"]'::jsonb, 'Photosynthesis', 2),
  ('At sea level, pure water boils at…', '["100 °C", "0 °C", "50 °C", "212 °C"]'::jsonb, '100 °C', 3),
  ('The centre of an atom, containing protons and neutrons, is the…', '["Nucleus", "Electron", "Shell", "Cell"]'::jsonb, 'Nucleus', 4),
  ('Which organ pumps blood around the body?', '["Heart", "Lungs", "Liver", "Kidney"]'::jsonb, 'Heart', 5),
  ('Which gas do humans need to breathe in for respiration?', '["Oxygen", "Carbon dioxide", "Nitrogen", "Helium"]'::jsonb, 'Oxygen', 6),
  ('What is the SI unit of force?', '["Newton", "Joule", "Watt", "Pascal"]'::jsonb, 'Newton', 7),
  ('Which planet is closest to the Sun?', '["Mercury", "Venus", "Earth", "Mars"]'::jsonb, 'Mercury', 8),
  ('A solid changing into a liquid is called…', '["Melting", "Freezing", "Condensation", "Evaporation"]'::jsonb, 'Melting', 9)
) as v(prompt, options, answer, pos) where c.slug = 'quiz-science-1'
  and not exists (select 1 from public.arena_questions x where x.challenge_id = c.id);

insert into public.arena_questions (challenge_id, prompt, options, answer, position)
select c.id, v.prompt, v.options, v.answer, v.pos from public.arena_challenges c, (values
  ('Which organelle releases energy in a cell?', '["Mitochondrion", "Nucleus", "Ribosome", "Cell wall"]'::jsonb, 'Mitochondrion', 0),
  ('What is the pH of a neutral solution?', '["7", "0", "1", "14"]'::jsonb, '7', 1),
  ('According to Ohm''s law, voltage V equals…', '["I × R", "I ÷ R", "R ÷ I", "I + R"]'::jsonb, 'I × R', 2),
  ('Speed is calculated as…', '["Distance ÷ time", "Time ÷ distance", "Distance × time", "Mass × distance"]'::jsonb, 'Distance ÷ time', 3),
  ('Which gas makes up most of the Earth''s atmosphere?', '["Nitrogen", "Oxygen", "Carbon dioxide", "Argon"]'::jsonb, 'Nitrogen', 4),
  ('What is the chemical symbol for sodium?', '["Na", "S", "So", "Sd"]'::jsonb, 'Na', 5),
  ('Which blood cells help fight infection?', '["White blood cells", "Red blood cells", "Platelets", "Plasma"]'::jsonb, 'White blood cells', 6),
  ('What is the unit of electrical resistance?', '["Ohm", "Volt", "Ampere", "Watt"]'::jsonb, 'Ohm', 7),
  ('Energy stored in food is…', '["Chemical energy", "Sound energy", "Light energy", "Nuclear energy"]'::jsonb, 'Chemical energy', 8),
  ('A liquid changing into a gas at its surface is called…', '["Evaporation", "Condensation", "Melting", "Sublimation"]'::jsonb, 'Evaporation', 9)
) as v(prompt, options, answer, pos) where c.slug = 'quiz-science-2'
  and not exists (select 1 from public.arena_questions x where x.challenge_id = c.id);

insert into public.arena_questions (challenge_id, prompt, options, answer, position)
select c.id, v.prompt, v.options, v.answer, v.pos from public.arena_challenges c, (values
  ('Acceleration due to gravity near the Earth''s surface is about…', '["9.8 m/s²", "1.6 m/s²", "98 m/s²", "3.0 m/s²"]'::jsonb, '9.8 m/s²', 0),
  ('An element''s atomic number equals its number of…', '["Protons", "Neutrons", "Electrons in the outer shell", "Nucleons"]'::jsonb, 'Protons', 1),
  ('Which part of a plant cell contains chlorophyll?', '["Chloroplast", "Vacuole", "Nucleus", "Cell membrane"]'::jsonb, 'Chloroplast', 2),
  ('Newton''s first law is also called the law of…', '["Inertia", "Acceleration", "Gravitation", "Reaction"]'::jsonb, 'Inertia', 3),
  ('An acid reacts with a base to form…', '["Salt and water", "Oxygen and hydrogen", "Only water", "Carbon dioxide only"]'::jsonb, 'Salt and water', 4),
  ('Which gas is released during photosynthesis?', '["Oxygen", "Carbon dioxide", "Nitrogen", "Methane"]'::jsonb, 'Oxygen', 5),
  ('Power is calculated as…', '["Work done ÷ time", "Force × time", "Mass × acceleration", "Work done × time"]'::jsonb, 'Work done ÷ time', 6),
  ('DNA stands for…', '["Deoxyribonucleic acid", "Dinitrogen acid", "Deoxyribose nitrate acid", "Double nucleic acid"]'::jsonb, 'Deoxyribonucleic acid', 7),
  ('What is the unit of frequency?', '["Hertz", "Decibel", "Newton", "Joule"]'::jsonb, 'Hertz', 8),
  ('Copper is widely used in wires because it is a good…', '["Conductor of electricity", "Insulator", "Magnet", "Semiconductor only"]'::jsonb, 'Conductor of electricity', 9)
) as v(prompt, options, answer, pos) where c.slug = 'quiz-science-3'
  and not exists (select 1 from public.arena_questions x where x.challenge_id = c.id);

insert into public.arena_questions (challenge_id, prompt, options, answer, position)
select c.id, v.prompt, v.options, v.answer, v.pos from public.arena_challenges c, (values
  ('7 × 8 = ?', '["56", "54", "64", "48"]'::jsonb, '56', 0),
  ('Which fraction equals 0.5?', '["1/2", "1/5", "2/5", "2/1"]'::jsonb, '1/2', 1),
  ('The perimeter of a square with side 5 cm is…', '["20 cm", "25 cm", "10 cm", "15 cm"]'::jsonb, '20 cm', 2),
  ('What is 15% of 200?', '["30", "15", "20", "40"]'::jsonb, '30', 3),
  ('What is the next prime number after 7?', '["11", "9", "8", "10"]'::jsonb, '11', 4),
  ('The angles in a triangle add up to…', '["180°", "90°", "360°", "270°"]'::jsonb, '180°', 5),
  ('3² + 4² = ?', '["25", "49", "14", "7"]'::jsonb, '25', 6),
  ('What is the LCM of 4 and 6?', '["12", "24", "2", "10"]'::jsonb, '12', 7),
  ('Round 3.76 to one decimal place.', '["3.8", "3.7", "4.0", "3.76"]'::jsonb, '3.8', 8),
  ('Solve: x + 5 = 12', '["7", "17", "5", "12"]'::jsonb, '7', 9)
) as v(prompt, options, answer, pos) where c.slug = 'quiz-math-1'
  and not exists (select 1 from public.arena_questions x where x.challenge_id = c.id);

insert into public.arena_questions (challenge_id, prompt, options, answer, position)
select c.id, v.prompt, v.options, v.answer, v.pos from public.arena_challenges c, (values
  ('Solve: 3x − 4 = 11', '["5", "3", "7", "15"]'::jsonb, '5', 0),
  ('The area of a circle with radius r is…', '["πr²", "2πr", "πd", "r²"]'::jsonb, 'πr²', 1),
  ('What is the gradient of y = 2x + 3?', '["2", "3", "5", "1"]'::jsonb, '2', 2),
  ('√144 = ?', '["12", "14", "16", "72"]'::jsonb, '12', 3),
  ('What is the mean of 2, 4, 6 and 8?', '["5", "4", "6", "20"]'::jsonb, '5', 4),
  ('(−3) × (−4) = ?', '["12", "−12", "7", "−7"]'::jsonb, '12', 5),
  ('Simplify 2a + 3a.', '["5a", "6a", "5a²", "6a²"]'::jsonb, '5a', 6),
  ('Expand 2(x + 3).', '["2x + 6", "2x + 3", "x + 6", "2x + 5"]'::jsonb, '2x + 6', 7),
  ('The probability of getting a head with a fair coin is…', '["1/2", "1/4", "1", "1/3"]'::jsonb, '1/2', 8),
  ('The interior angles of a quadrilateral add up to…', '["360°", "180°", "540°", "90°"]'::jsonb, '360°', 9)
) as v(prompt, options, answer, pos) where c.slug = 'quiz-math-2'
  and not exists (select 1 from public.arena_questions x where x.challenge_id = c.id);

insert into public.arena_questions (challenge_id, prompt, options, answer, position)
select c.id, v.prompt, v.options, v.answer, v.pos from public.arena_challenges c, (values
  ('What is the capital city of Ghana?', '["Accra", "Kumasi", "Tamale", "Cape Coast"]'::jsonb, 'Accra', 0),
  ('In which year did Ghana gain independence?', '["1957", "1960", "1966", "1945"]'::jsonb, '1957', 1),
  ('Who was Ghana''s first President?', '["Kwame Nkrumah", "J. B. Danquah", "Kofi Annan", "Jerry John Rawlings"]'::jsonb, 'Kwame Nkrumah', 2),
  ('What is the name of Ghana''s currency?', '["Cedi", "Naira", "Rand", "Shilling"]'::jsonb, 'Cedi', 3),
  ('What was Ghana called before independence?', '["Gold Coast", "Ivory Coast", "Slave Coast", "Grain Coast"]'::jsonb, 'Gold Coast', 4),
  ('Ghana is located on which continent?', '["Africa", "Asia", "Europe", "South America"]'::jsonb, 'Africa', 5),
  ('What is the official language of Ghana?', '["English", "French", "Twi", "Hausa"]'::jsonb, 'English', 6),
  ('How many regions does Ghana have (since 2019)?', '["16", "10", "12", "18"]'::jsonb, '16', 7),
  ('Which large man-made lake is found in Ghana?', '["Lake Volta", "Lake Victoria", "Lake Chad", "Lake Bosomtwe"]'::jsonb, 'Lake Volta', 8),
  ('How many continents are there?', '["7", "5", "6", "8"]'::jsonb, '7', 9)
) as v(prompt, options, answer, pos) where c.slug = 'quiz-general-1'
  and not exists (select 1 from public.arena_questions x where x.challenge_id = c.id);

insert into public.arena_questions (challenge_id, prompt, answer, position)
select c.id, v.prompt, v.answer, v.pos from public.arena_challenges c, (values
  ('Opposite of cold', 'HOT', 0),
  ('An animal that barks', 'DOG', 1),
  ('You read it', 'BOOK', 2),
  ('It shines in the daytime sky', 'SUN', 3),
  ('Frozen water', 'ICE', 4),
  ('You write with it', 'PEN', 5),
  ('Kicked in football', 'BALL', 6),
  ('It has a trunk, branches and leaves', 'TREE', 7)
) as v(prompt, answer, pos) where c.slug = 'word-builder-1'
  and not exists (select 1 from public.arena_questions x where x.challenge_id = c.id);

insert into public.arena_questions (challenge_id, prompt, answer, position)
select c.id, v.prompt, v.answer, v.pos from public.arena_challenges c, (values
  ('You drink it every day', 'WATER', 0),
  ('A living thing that grows in soil', 'PLANT', 1),
  ('You sit on it', 'CHAIR', 2),
  ('The opposite of dark', 'LIGHT', 3),
  ('Feeling joyful', 'HAPPY', 4),
  ('The Volta is one', 'RIVER', 5),
  ('Baked from flour', 'BREAD', 6),
  ('Sounds organised in rhythm and melody', 'MUSIC', 7)
) as v(prompt, answer, pos) where c.slug = 'word-builder-2'
  and not exists (select 1 from public.arena_questions x where x.challenge_id = c.id);

insert into public.arena_questions (challenge_id, prompt, answer, position)
select c.id, v.prompt, v.answer, v.pos from public.arena_challenges c, (values
  ('The study of the natural world', 'SCIENCE', 0),
  ('Someone you like and trust', 'FRIEND', 1),
  ('A place full of books to borrow', 'LIBRARY', 2),
  ('Earth is one', 'PLANET', 3),
  ('The ability to do work', 'ENERGY', 4),
  ('Where goods are bought and sold', 'MARKET', 5),
  ('Digits make one', 'NUMBER', 6),
  ('Where flowers and vegetables grow', 'GARDEN', 7)
) as v(prompt, answer, pos) where c.slug = 'word-builder-3'
  and not exists (select 1 from public.arena_questions x where x.challenge_id = c.id);

insert into public.arena_questions (challenge_id, prompt, answer, position)
select c.id, v.prompt, v.answer, v.pos from public.arena_challenges c, (values
  ('A machine that processes data', 'COMPUTER', 0),
  ('You type on it', 'KEYBOARD', 1),
  ('The largest land animal', 'ELEPHANT', 2),
  ('A person who helps you learn', 'TEACHER', 3),
  ('Gaining knowledge or skills', 'LEARNING', 4),
  ('Much taller than a hill', 'MOUNTAIN', 5),
  ('The study of past events', 'HISTORY', 6),
  ('The state of being free', 'FREEDOM', 7)
) as v(prompt, answer, pos) where c.slug = 'word-builder-4'
  and not exists (select 1 from public.arena_questions x where x.challenge_id = c.id);

insert into public.arena_questions (challenge_id, prompt, answer, position)
select c.id, v.prompt, v.answer, v.pos from public.arena_challenges c, (values
  ('Facts and skills gained through learning', 'KNOWLEDGE', 0),
  ('Teaching and learning in schools', 'EDUCATION', 1),
  ('Tools and machines made using science', 'TECHNOLOGY', 2),
  ('Step-by-step instructions to solve a problem', 'ALGORITHM', 3),
  ('Our natural surroundings', 'ENVIRONMENT', 4),
  ('Government by the people', 'DEMOCRACY', 5),
  ('Flowing electric charge', 'ELECTRICITY', 6),
  ('The study of places and the Earth''s features', 'GEOGRAPHY', 7)
) as v(prompt, answer, pos) where c.slug = 'word-builder-5'
  and not exists (select 1 from public.arena_questions x where x.challenge_id = c.id);
