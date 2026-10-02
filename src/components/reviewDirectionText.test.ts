import { directionToggleLabel, emptyQueueText, switchDirectionLabel } from './reviewDirectionText';

describe('emptyQueueText', () => {
  it('names the finished direction and how many words wait in the other one', () => {
    expect(emptyQueueText('jpToEn', { kind: 'switchDirection', direction: 'enToJp', dueCount: 12 })).toBe(
      'All caught up on JP → EN. 12 words still due in EN → JP.',
    );
    expect(emptyQueueText('enToJp', { kind: 'switchDirection', direction: 'jpToEn', dueCount: 3 })).toBe(
      'All caught up on EN → JP. 3 words still due in JP → EN.',
    );
  });

  it('uses the singular for a single remaining word', () => {
    expect(emptyQueueText('jpToEn', { kind: 'switchDirection', direction: 'enToJp', dueCount: 1 })).toBe(
      'All caught up on JP → EN. 1 word still due in EN → JP.',
    );
  });

  it('says both directions are done when nothing is due anywhere', () => {
    expect(emptyQueueText('jpToEn', { kind: 'allCaughtUp' })).toBe('All caught up in both directions!');
  });
});

describe('switchDirectionLabel', () => {
  it('names the direction the button switches to', () => {
    expect(switchDirectionLabel('enToJp')).toBe('Review EN → JP');
    expect(switchDirectionLabel('jpToEn')).toBe('Review JP → EN');
  });
});

describe('directionToggleLabel', () => {
  it('shows the due count next to the direction', () => {
    expect(directionToggleLabel('jpToEn', 0)).toBe('JP → EN (0)');
    expect(directionToggleLabel('enToJp', 12)).toBe('EN → JP (12)');
  });

  it('shows just the direction while counts are still loading', () => {
    expect(directionToggleLabel('jpToEn', undefined)).toBe('JP → EN');
  });
});
