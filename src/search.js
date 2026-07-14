import Fuse from 'fuse.js';

const SEARCH_SEPARATOR = /[\s\u3000\-_.,，。！？、；：'"“”‘’()（）\[\]【】{}<>《》!@#$%^&*+=/\\|?]+/g;

const SEARCH_OPTIONS = {
  includeMatches: true,
  includeScore: true,
  ignoreLocation: true,
  minMatchCharLength: 2,
  shouldSort: true,
  threshold: 0.35,
  keys: [
    { name: 'textIndex', weight: 0.75 },
    { name: 'rawTextIndex', weight: 0.25 },
  ],
};

export function normalizeSearchText(value) {
  return String(value || '')
    .normalize('NFKC')
    .toLowerCase()
    .replace(SEARCH_SEPARATOR, '');
}

function toSearchDocument(note) {
  return {
    note,
    textIndex: normalizeSearchText(note.text),
    rawTextIndex: normalizeSearchText(note.rawText),
  };
}

function rankResult(a, b) {
  if (a.matchRank !== b.matchRank) return a.matchRank - b.matchRank;
  if (a.score !== b.score) return a.score - b.score;
  return (b.note.createdAt || 0) - (a.note.createdAt || 0);
}

function directMatchResult(document, query) {
  const textMatch = document.textIndex.includes(query);
  const rawMatch = document.rawTextIndex.includes(query);
  if (!textMatch && !rawMatch) return null;

  return {
    note: document.note,
    score: 0,
    matchRank: textMatch ? 0 : 1,
    matchFields: [textMatch && 'text', rawMatch && 'rawText'].filter(Boolean),
  };
}

function fuzzyMatchFields(matches) {
  return [...new Set((matches || [])
    .map((match) => match.key === 'textIndex' ? 'text' : 'rawText'))];
}

/**
 * Searches active notes without mutating or persisting them. Exact normalized
 * matches rank before typo-tolerant matches; ties are newest first.
 */
export function searchNotes(notes, query) {
  const normalizedQuery = normalizeSearchText(query);
  const documents = (notes || [])
    .filter((note) => !note?.deletedAt)
    .map(toSearchDocument);

  if (!normalizedQuery) {
    return documents
      .map(({ note }) => ({ note, score: 0, matchRank: 0, matchFields: [] }))
      .sort((a, b) => (b.note.createdAt || 0) - (a.note.createdAt || 0));
  }

  const directResults = documents
    .map((document) => directMatchResult(document, normalizedQuery))
    .filter(Boolean);

  // A one-character fuzzy query creates too much noise in a Chinese note library.
  if (normalizedQuery.length < 2) return directResults.sort(rankResult);

  const exactIds = new Set(directResults.map((result) => result.note.id));
  const fuzzyResults = new Fuse(documents, SEARCH_OPTIONS)
    .search(normalizedQuery)
    .filter((result) => !exactIds.has(result.item.note.id))
    .map((result) => ({
      note: result.item.note,
      score: result.score ?? 1,
      matchRank: 2,
      matchFields: fuzzyMatchFields(result.matches),
    }));

  return [...directResults, ...fuzzyResults].sort(rankResult);
}

export function matchesNoteQuery(note, query) {
  return searchNotes([note], query).length > 0;
}
