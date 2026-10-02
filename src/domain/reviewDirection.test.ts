import { guidanceForEmptyQueue, otherDirection } from './reviewDirection';

describe('otherDirection', () => {
  it('flips between the two review directions', () => {
    expect(otherDirection('jpToEn')).toBe('enToJp');
    expect(otherDirection('enToJp')).toBe('jpToEn');
  });
});

describe('guidanceForEmptyQueue', () => {
  it('points JP→EN reviewers at EN→JP when words are still due there', () => {
    expect(guidanceForEmptyQueue('jpToEn', { jpToEn: 0, enToJp: 12 })).toEqual({
      kind: 'switchDirection',
      direction: 'enToJp',
      dueCount: 12,
    });
  });

  it('points EN→JP reviewers at JP→EN when words are still due there', () => {
    expect(guidanceForEmptyQueue('enToJp', { jpToEn: 3, enToJp: 0 })).toEqual({
      kind: 'switchDirection',
      direction: 'jpToEn',
      dueCount: 3,
    });
  });

  it('reports a single remaining word in the other direction', () => {
    expect(guidanceForEmptyQueue('jpToEn', { jpToEn: 0, enToJp: 1 })).toEqual({
      kind: 'switchDirection',
      direction: 'enToJp',
      dueCount: 1,
    });
  });

  it('reports all caught up when neither direction has anything due', () => {
    expect(guidanceForEmptyQueue('jpToEn', { jpToEn: 0, enToJp: 0 })).toEqual({ kind: 'allCaughtUp' });
    expect(guidanceForEmptyQueue('enToJp', { jpToEn: 0, enToJp: 0 })).toEqual({ kind: 'allCaughtUp' });
  });
});
