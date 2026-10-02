import { act, renderHook, waitFor } from '@testing-library/react-native';
import { useWordReviewSession } from './useWordReviewSession';
import { getDueCounts, getDueWords } from '../composition/container';
import type { ReviewDirection, Word } from '../domain/entities/Word';
import type { DueCounts } from '../domain/reviewDirection';

jest.mock('../composition/container', () => ({
  getDueWords: jest.fn(),
  getDueCounts: jest.fn(),
}));

// Outside a navigator, a screen is always focused — so a focus effect behaves
// like a plain effect.
jest.mock('@react-navigation/native', () => {
  const { useEffect } = require('react');
  return { useFocusEffect: (effect: () => void) => useEffect(effect, [effect]) };
});

const mockedGetDueWords = getDueWords as jest.MockedFunction<typeof getDueWords>;
const mockedGetDueCounts = getDueCounts as jest.MockedFunction<typeof getDueCounts>;

const DECK_ID = 7;

function word(id: number): Word {
  const reviewState = { boxLevel: 1, rightStreak: 0, nextDueAt: new Date(), lastReviewedAt: null };
  return {
    id,
    deckId: DECK_ID,
    originDeckId: null,
    kanji: null,
    furigana: `ことば${id}`,
    englishMeaning: `word ${id}`,
    exampleSentenceJp: null,
    exampleSentenceEn: null,
    jpToEn: reviewState,
    enToJp: reviewState,
    createdAt: new Date(),
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((settle) => {
    resolve = settle;
  });
  return { promise, resolve };
}

function dueWordsByDirection(byDirection: Record<ReviewDirection, Word[]>) {
  mockedGetDueWords.mockImplementation(async (_deckId, direction) => byDirection[direction]);
}

function dueCounts(counts: DueCounts) {
  mockedGetDueCounts.mockResolvedValue(counts);
}

function renderSession(isReviewing: boolean) {
  return renderHook(({ reviewing }: { reviewing: boolean }) => useWordReviewSession(DECK_ID, reviewing), {
    initialProps: { reviewing: isReviewing },
  });
}

beforeEach(() => {
  mockedGetDueWords.mockReset();
  mockedGetDueCounts.mockReset();
});

describe('useWordReviewSession', () => {
  it('loads nothing until review starts', async () => {
    dueWordsByDirection({ jpToEn: [word(1)], enToJp: [] });
    dueCounts({ jpToEn: 1, enToJp: 0 });

    const { result } = await renderSession(false);

    expect(mockedGetDueWords).not.toHaveBeenCalled();
    expect(result.current.dueWords).toBeNull();
  });

  it('loads JP→EN due words and both due counts on entering review', async () => {
    dueWordsByDirection({ jpToEn: [word(1), word(2)], enToJp: [word(3)] });
    dueCounts({ jpToEn: 2, enToJp: 1 });

    const { result } = await renderSession(true);

    await waitFor(() => expect(result.current.dueWords?.map((w) => w.id)).toEqual([1, 2]));
    expect(result.current.direction).toBe('jpToEn');
    expect(result.current.dueCounts).toEqual({ jpToEn: 2, enToJp: 1 });
    expect(mockedGetDueWords).toHaveBeenCalledWith(DECK_ID, 'jpToEn');
  });

  it('loads a fresh EN→JP queue after JP→EN is finished and the direction is switched', async () => {
    // Regression: the EN→JP words were fetched but never reached the card stack.
    dueWordsByDirection({ jpToEn: [], enToJp: [word(3), word(4)] });
    dueCounts({ jpToEn: 0, enToJp: 2 });
    const { result } = await renderSession(true);
    await waitFor(() => expect(result.current.dueWords).toEqual([]));

    await act(async () => result.current.switchDirection('enToJp'));

    await waitFor(() => expect(result.current.dueWords?.map((w) => w.id)).toEqual([3, 4]));
    expect(result.current.direction).toBe('enToJp');
    expect(mockedGetDueWords).toHaveBeenLastCalledWith(DECK_ID, 'enToJp');
  });

  it('clears the queue the moment the direction switches, so no old cards carry over', async () => {
    const enToJpWords = deferred<Word[]>();
    mockedGetDueWords.mockImplementation((_deckId, direction) =>
      direction === 'jpToEn' ? Promise.resolve([word(1)]) : enToJpWords.promise,
    );
    dueCounts({ jpToEn: 1, enToJp: 1 });
    const { result } = await renderSession(true);
    await waitFor(() => expect(result.current.dueWords?.map((w) => w.id)).toEqual([1]));

    await act(async () => result.current.switchDirection('enToJp'));
    expect(result.current.dueWords).toBeNull();

    await act(async () => enToJpWords.resolve([word(2)]));
    expect(result.current.dueWords?.map((w) => w.id)).toEqual([2]);
  });

  it('drops a slow response for a direction the user already switched away from', async () => {
    const slowJpToEn = deferred<Word[]>();
    mockedGetDueWords.mockImplementation((_deckId, direction) =>
      direction === 'jpToEn' ? slowJpToEn.promise : Promise.resolve([word(9)]),
    );
    dueCounts({ jpToEn: 1, enToJp: 1 });
    const { result } = await renderSession(true);

    await act(async () => result.current.switchDirection('enToJp'));
    await waitFor(() => expect(result.current.dueWords?.map((w) => w.id)).toEqual([9]));

    await act(async () => slowJpToEn.resolve([word(1)]));
    expect(result.current.dueWords?.map((w) => w.id)).toEqual([9]);
    expect(result.current.direction).toBe('enToJp');
  });

  it('reloads when switching to the direction already selected, instead of leaving an empty screen', async () => {
    dueWordsByDirection({ jpToEn: [word(1)], enToJp: [] });
    dueCounts({ jpToEn: 1, enToJp: 0 });
    const { result } = await renderSession(true);
    await waitFor(() => expect(result.current.dueWords).not.toBeNull());

    await act(async () => result.current.switchDirection('jpToEn'));

    await waitFor(() => expect(result.current.dueWords?.map((w) => w.id)).toEqual([1]));
  });

  it('starts a fresh session with current due words when review is re-entered', async () => {
    dueWordsByDirection({ jpToEn: [word(1)], enToJp: [] });
    dueCounts({ jpToEn: 1, enToJp: 0 });
    const { result, rerender } = await renderSession(true);
    await waitFor(() => expect(result.current.dueWords?.map((w) => w.id)).toEqual([1]));

    await rerender({ reviewing: false });
    dueWordsByDirection({ jpToEn: [word(1), word(5)], enToJp: [] });
    await act(async () => result.current.startSession());
    expect(result.current.dueWords).toBeNull();
    await rerender({ reviewing: true });

    await waitFor(() => expect(result.current.dueWords?.map((w) => w.id)).toEqual([1, 5]));
  });

  it('refreshes due counts on request, e.g. after a swipe', async () => {
    dueWordsByDirection({ jpToEn: [word(1)], enToJp: [word(1)] });
    dueCounts({ jpToEn: 1, enToJp: 1 });
    const { result } = await renderSession(true);
    await waitFor(() => expect(result.current.dueCounts).toEqual({ jpToEn: 1, enToJp: 1 }));

    dueCounts({ jpToEn: 0, enToJp: 1 });
    await act(async () => result.current.refreshDueCounts());

    await waitFor(() => expect(result.current.dueCounts).toEqual({ jpToEn: 0, enToJp: 1 }));
    expect(mockedGetDueCounts).toHaveBeenLastCalledWith(DECK_ID);
  });

  it('keeps the older of two overlapping count refreshes from overwriting the newer one', async () => {
    dueWordsByDirection({ jpToEn: [word(1)], enToJp: [] });
    dueCounts({ jpToEn: 1, enToJp: 0 });
    const { result } = await renderSession(true);
    await waitFor(() => expect(result.current.dueCounts).not.toBeNull());

    const older = deferred<DueCounts>();
    const newer = deferred<DueCounts>();
    mockedGetDueCounts.mockReturnValueOnce(older.promise).mockReturnValueOnce(newer.promise);
    await act(async () => {
      result.current.refreshDueCounts();
      result.current.refreshDueCounts();
    });

    await act(async () => newer.resolve({ jpToEn: 0, enToJp: 0 }));
    await act(async () => older.resolve({ jpToEn: 1, enToJp: 0 }));
    expect(result.current.dueCounts).toEqual({ jpToEn: 0, enToJp: 0 });
  });
});
