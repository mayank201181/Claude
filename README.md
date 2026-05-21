# WordLab — Vocabulary Dashboard

A self-contained vocabulary trainer built for an IGCSE English student, focused on
**literature & analysis** vocabulary with **quizzes and self-testing** at its core.

## How to use it

No installation, no internet needed. Just **open `index.html` in any browser**
(double-click it, or drag it into a browser tab). It works on a laptop, an iPad,
or anything with a browser.

To put it online for free, push this repo and enable **GitHub Pages** (Settings →
Pages → deploy from branch). The site is fully static.

## What's inside

- **Learn** — browse every word with its part of speech, definition, an example
  sentence (drawn from literary analysis), and synonyms. Search, filter by
  category or difficulty, star favourites, and mark words as "known".
- **Quiz** — four self-test modes: definition → word, word → definition,
  fill-in-the-blank (using the example sentence), and mixed. Instant feedback
  and an end-of-quiz review of every answer.
- **Word of the day** — a different word surfaced each day.
- **Progress** — words mastered, favourites, quiz accuracy, a day streak, and
  mastery bars per category. All saved in the browser (localStorage).

## Word bank

The words live in `js/words.js` as a plain array. Each entry looks like:

```js
{
  word: "juxtaposition",
  pos: "noun",
  definition: "Placing two contrasting ideas, images or characters close together for effect.",
  example: "The juxtaposition of wealth and poverty in the opening chapter exposes social inequality.",
  synonyms: ["contrast", "comparison"],
  category: "Literary Devices",
  difficulty: 2   // 1 = foundation, 2 = intermediate, 3 = advanced
}
```

**Adding more words** is as simple as appending objects to that array — the whole
dashboard updates automatically. The bank currently holds curated, hand-written
entries across six categories: Literary Devices, Form & Structure, Character &
Narrative, Analytical Verbs, Tone & Mood, and Sophisticated Vocabulary.
