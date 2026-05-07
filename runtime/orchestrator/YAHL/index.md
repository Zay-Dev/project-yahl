# YAHL (Yet Another High-level Language)

YAHL is a new language that allow developer to write pseudo code to communicate with AI.

### Syntaxes

#### System tags

Ignore system tags unless otherwise indicated, treat them as a space and not more than a space

- REPLACE: 
- EXTENDS: 
- IF: 
- ELSE: 
- END: 

#### *func(...args)

Syntax of "*some_text(...args)" is a virtual function, that means
1. the function does not exist, that means the execution details will leave to you
2. the "some_text" is usually a meaningful name that you can understand, e.g. *scan_file_system_for clearly means scan the file system for something
3. "...args" will provide more context, e.g. *scan_file_system_for(json_file) clearly means scan the file system for all json files
4. treat "...args" very carefully, do NOT miss any of them, usually they are the user_requirements
5. the variable name to store the result can also provide context of the purpose of the virtual function, e.g. const newest_news = *... // means it is very likely to skip out dated news
6. after analyzing the purpose and args of the virtual function, generate bash command for the user to execute

examples:
- const decision = *ask_user(a2ui, [multipleChoice], choose_scope) means emit runtime `ask_user` tool arguments with `version:"askUser.v1"` and `kind:"multipleChoice"`
- const sum = *sum([1,3,5,6,10]) means get the sum of the args (1+3+5+6+10)
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

### Instructions

- NEVER throw error if you cannot find the skill, try to fallback to your capabilities to solve the problem.

## Example, taste of the language

const context = ''; // no context yet

const topic_question = *ask_user(a2ui, [multipleChoice], no_question); // emit ask_user multipleChoice payload

const topic = *get_input(*render(topic_question)); // runtime will wait for user answer and continue with answer context

const knowledge = *scan_file_system_of(topic); // start with *, meaning no actual scan_file_system_of function,  understand this is to scan file system of the topic by user input

const question = *ask_user(a2ui, [multipleChoice], topic, context, knowledge, asking_about:'the areas of the user want to discuss about'); // ask user via runtime ask_user tool

const answer = *get_input(*render(question));

context = *manage_context(context, knowledge, topic, answer) // update the context by considering the passing in args

## ask_user mapping

When `*ask_user(...)` is selected, generate `ask_user` tool arguments matching:

```json
{
  "version": "askUser.v1",
  "kind": "multipleChoice",
  "title": "Choose one option",
  "description": "Optional context for user.",
  "options": [
    { "id": "a", "label": "Option A" },
    { "id": "b", "label": "Option B" }
  ],
  "allowMultiple": false
}
```

Constraints:
- at least 2 options
- non-empty `id` and `label`
- only `multipleChoice` is supported

Execution semantics:
- when an ask_user call resolves, runtime resumes the same stage and replaces inline `/ask-user(...)` with the selected answer value
- runtime writes the selected value into global context key `ask_user_last_answer`
- `ask_user_last_answer` is scalar only: numeric option ids become numbers, otherwise string