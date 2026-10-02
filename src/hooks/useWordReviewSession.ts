import { useCallback, useRef, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { getDueCounts, getDueWords } from '../composition/container';
import type { ReviewDirection, Word } from '../domain/entities/Word';
import type { DueCounts } from '../domain/reviewDirection';

// Owns one word deck's flashcard session: the direction being reviewed, that
// direction's due queue, and how many words are due in each direction.
export function useWordReviewSession(deckId: number, isReviewing: boolean) {
  const [direction, setDirection] = useState<ReviewDirection>('jpToEn');
  const [dueWords, setDueWords] = useState<Word[] | null>(null);
  const [dueCounts, setDueCounts] = useState<DueCounts | null>(null);
  const [sessionNumber, setSessionNumber] = useState(0);

  // Only the newest request may write its result, so a slow response for a
  // direction the user has already switched away from is dropped.
  const latestDueWordsRequest = useRef(0);
  const latestDueCountsRequest = useRef(0);

  const loadDueWords = useCallback(() => {
    const requestId = ++latestDueWordsRequest.current;
    getDueWords(deckId, direction)
      .then((words) => {
        if (requestId === latestDueWordsRequest.current) setDueWords(words);
      })
      .catch((error) => console.warn('Failed to load due words:', error));
  }, [deckId, direction]);

  const refreshDueCounts = useCallback(() => {
    const requestId = ++latestDueCountsRequest.current;
    getDueCounts(deckId)
      .then((counts) => {
        if (requestId === latestDueCountsRequest.current) setDueCounts(counts);
      })
      .catch((error) => console.warn('Failed to load due counts:', error));
  }, [deckId]);

  // Loads on entering review, on every new session, and on returning to the
  // screen (e.g. after editing a word). That last case keeps the current queue
  // so an edit mid-review doesn't lose your place.
  useFocusEffect(
    useCallback(() => {
      if (!isReviewing) return;
      loadDueWords();
      refreshDueCounts();
    }, [isReviewing, sessionNumber, loadDueWords, refreshDueCounts]),
  );

  // The card stack seeds its queue only when it mounts, and afterwards merely
  // refreshes cards it already holds. Emptying the queue unmounts it, so the
  // next load starts a fresh stack instead of being merged into the old one.
  const startSession = useCallback(() => {
    latestDueWordsRequest.current += 1;
    setDueWords(null);
    setSessionNumber((current) => current + 1);
  }, []);

  const switchDirection = useCallback(
    (next: ReviewDirection) => {
      setDirection(next);
      startSession();
    },
    [startSession],
  );

  return { direction, dueWords, dueCounts, startSession, switchDirection, refreshDueCounts };
}
