# YAHL (Yet Another High-level Language)

YAHL is a new language that allow developer to write pseudo code to communicate with AI.

### Syntaxes

#### System tags

Ignore system tags unless otherwise indicated, treat them as a space and not more than a space

- REPLACE: 
- EXTENDS: 

#### *func(...args)

Syntax of "*some_text(...args)" is a virtual function, that means
1. the function does not exist
2. the "some_text" is usually a meaningful name that you can understand, e.g. *scan_file_system_for clearly means scan the file system for something
3. "...args" will provide more context, e.g. *scan_file_system_for(json_file) clearly means scan the file system for all json files
4. the variable name to store the result can also provide context of the purpose of the virtual function, e.g. const newest_news = *... // means it is very likely to skip out dated news
5. after analyzing the purpose and args of the virtual function, generate bash command for the user to execute

examples:
- const topic = *ask_user(a2ui, [textarea]) means return an A2UI schema textarea to ask user for the topic
- const sum = *sum([1,3,5,6,10]) means get the sum of the args
- const filtered = *filter([1,3,2,5,6,3,2,692345,3], even_number) means find the even numbers in the array
- const filtered = *filter([1,3,2,5,6,3,2,692345,3], even_number, new Set() as Array) means find the even numbers in the array, remove all duplicated numbers ('2' should show only one time in the result)
- const html = *browse_or_curl('https://x.com') means getting the html from x.com

#### /skill(...args)

Syntax of "/skill(...args)" is a skill, that means
1. search SKILLS/ for the skill, (e.g. /web-search('apple new CEO') means there is a skill 'web-search')
2. follow the skill instruction to complete the command and return the result (e.g. const result = /web-search('apple new CEO'))

#### ~/file-system

Syntax of "~/some-text" means the workspace, it takes the linux's home (~/) syntax sematically, usually means accessing (read/write) the file system, we only access file-system when this syntax presents, and ~/ means our workspace (user's home), use bash command to validate if you have written content correctly if it is a write virtual function

examples:
- *read(~/knowledges/news-monitor/sources.json) means reading the content of the file at that absolute path
- *find(~/knowledges/**/*.json) means find all json files recursively under the ~/knowledges folder
- *save(~/memory.md, new_memory) means saving new memory to the ~/memory.md file

#### return

To return a value as the result, use the set_context tool to set the value to the key 'result'

### Instructions

- NEVER throw error if you cannot find the skill, try to fallback to your capabilities to solve the problem.

## Example, taste of the language

const context = ''; // no context yet

const topic_question = *ask_user(a2ui, [textarea], no_question); // return textarea in a2ui scehma for the user to input the topic, no need to think of any question

const topic = *get_input(*render(topic_question)); // render the topic_question on UI, then get the input from the user

const knowledge = *scan_file_system_of(topic); // start with *, meaning no actual scan_file_system_of function,  understand this is to scan file system of the topic by user input

const question = *ask_user(a2ui, [textarea, radio, checkbox], topic, context, knowledge, asking_about:'the areas of the user want to discuss about'); // ask user in a2ui schema again, need to consider the topic, context, knowledge, asking_about is the direction of what question we are asking

const answer = *get_input(*render(question));

context = *manage_context(context, knowledge, topic, answer) // update the context by considering the passing in args