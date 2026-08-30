import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../types/navigation';
import { markOnboardingSeen } from '../infrastructure/services/onboardingStore';
import { useTheme } from '../theme/useTheme';
import type { ThemeColors } from '../theme/tokens';

type Props = NativeStackScreenProps<RootStackParamList, 'Onboarding'>;

type Slide = {
  mark: string;
  title: string;
  body: string;
};

const SLIDES: Slide[] = [
  {
    mark: '🎴',
    title: 'Welcome to Flip Kotoba',
    body: 'Build Japanese vocabulary decks and learn them with spaced-repetition flashcards, at your own pace.',
  },
  {
    mark: '📚',
    title: 'Organize into decks',
    body: 'Create a deck, then add words to it. Each word can have a kanji form, a furigana reading, and an English meaning.',
  },
  {
    mark: '🔍',
    title: 'Let the dictionary help',
    body: 'When adding a word, tap "Look up" to auto-fill the reading, meaning, and a real example sentence — just type the word first.',
  },
  {
    mark: '📷',
    title: 'Or scan a whole page',
    body: 'Photograph a textbook vocabulary page and every entry is extracted for you to review before saving. Needs an AI provider key, set up in Settings.',
  },
  {
    mark: '漢',
    title: 'Kanji decks too',
    body: 'Switch to the Kanji tab on the deck list. Kanji decks are scan-only: photograph a kanji page and each character is pulled out with its readings, meanings and example words — topped up from the dictionary.',
  },
  {
    mark: '👆',
    title: 'Practice with flashcards',
    body: 'Tap a card to flip it. Swipe right if you knew it, left if you didn\'t. Words you know keep coming back less often; words you don\'t come back sooner.',
  },
  {
    mark: '✓',
    title: 'Watch words graduate',
    body: 'Get a word right enough times in a row and it moves itself into a "Memorized" deck automatically — one less thing to review.',
  },
];

export default function OnboardingScreen({ route, navigation }: Props) {
  const { mode } = route.params;
  const [index, setIndex] = useState(0);
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const isLast = index === SLIDES.length - 1;
  const slide = SLIDES[index];

  const finish = async () => {
    if (mode === 'first-launch') {
      await markOnboardingSeen();
      navigation.reset({ index: 0, routes: [{ name: 'DeckList' }] });
    } else {
      navigation.goBack();
    }
  };

  const onNext = () => {
    if (isLast) {
      finish();
    } else {
      setIndex((i) => i + 1);
    }
  };

  return (
    <View style={styles.container}>
      {mode === 'first-launch' && (
        <Pressable style={styles.skipButton} onPress={finish} hitSlop={12}>
          <Text style={styles.skipButtonText}>Skip</Text>
        </Pressable>
      )}

      <View style={styles.content}>
        <Text style={styles.mark}>{slide.mark}</Text>
        <Text style={styles.title}>{slide.title}</Text>
        <Text style={styles.body}>{slide.body}</Text>
      </View>

      <View style={styles.dots}>
        {SLIDES.map((s, i) => (
          <View key={s.title} style={[styles.dot, i === index && styles.dotActive]} />
        ))}
      </View>

      <View style={styles.buttonRow}>
        {index > 0 && (
          <Pressable style={styles.backButton} onPress={() => setIndex((i) => i - 1)}>
            <Text style={styles.backButtonText}>Back</Text>
          </Pressable>
        )}
        <Pressable style={styles.nextButton} onPress={onNext}>
          <Text style={styles.nextButtonText}>
            {isLast ? (mode === 'first-launch' ? 'Get Started' : 'Done') : 'Next'}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background, padding: 24 },
    skipButton: { alignSelf: 'flex-end', paddingVertical: 8, paddingHorizontal: 4 },
    skipButtonText: { color: colors.textMuted, fontSize: 15, fontWeight: '600' },
    content: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12 },
    mark: { fontSize: 72, marginBottom: 24 },
    title: { fontSize: 24, fontWeight: '700', color: colors.textPrimary, textAlign: 'center', marginBottom: 14 },
    body: { fontSize: 16, color: colors.textSecondary, textAlign: 'center', lineHeight: 23 },
    dots: { flexDirection: 'row', justifyContent: 'center', gap: 8, marginBottom: 24 },
    dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.surfaceAlt },
    dotActive: { backgroundColor: colors.accent, width: 20 },
    buttonRow: { flexDirection: 'row', gap: 12 },
    backButton: {
      paddingVertical: 16,
      paddingHorizontal: 20,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.border,
    },
    backButtonText: { color: colors.textSecondary, fontSize: 16, fontWeight: '600' },
    nextButton: {
      flex: 1,
      backgroundColor: colors.accent,
      borderRadius: 10,
      paddingVertical: 16,
      alignItems: 'center',
    },
    nextButtonText: { color: colors.textOnAccent, fontSize: 16, fontWeight: '600' },
  });
}
