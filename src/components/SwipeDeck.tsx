import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Dimensions, Pressable, StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Extrapolation,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useTheme } from '../theme/useTheme';
import type { ThemeColors } from '../theme/tokens';

const SCREEN_WIDTH = Dimensions.get('window').width;
const SWIPE_THRESHOLD = SCREEN_WIDTH * 0.28;
const STAMP_RANGE = SWIPE_THRESHOLD * 0.8;

type SwipeDirection = 'right' | 'left';

export interface SwipeDeckProps<T> {
  cards: T[];
  renderFront: (card: T) => ReactNode;
  renderBack: (card: T) => ReactNode;
  // Called once the fling-away animation has finished. May report that the item
  // has earned graduation, which shows the memorize prompt, and/or a brief
  // non-blocking note to acknowledge on screen for a couple of seconds.
  onSwipe: (card: T, direction: SwipeDirection) => Promise<{ readyToMemorize: boolean; note?: string | null }>;
  renderMemorizePrompt: (card: T, dismiss: () => void) => ReactNode;
  emptyText: string;
  remainingText: (count: number) => string;
  // When given, shows an edit affordance for the card currently on top.
  onEdit?: (card: T) => void;
}

// A missed card goes back into the queue three cards later, so it comes around
// again this session without immediately repeating.
function requeueAfterLeft<T>(rest: T[], card: T): T[] {
  const next = [...rest];
  next.splice(Math.min(3, next.length), 0, card);
  return next;
}

export default function SwipeDeck<T extends { id: number }>({
  cards,
  renderFront,
  renderBack,
  onSwipe,
  renderMemorizePrompt,
  emptyText,
  remainingText,
  onEdit,
}: SwipeDeckProps<T>) {
  const [queue, setQueue] = useState<T[]>(() => cards);
  const [flipped, setFlipped] = useState(false);
  const [pendingMemorize, setPendingMemorize] = useState<T | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  // Keeps cards already in the session's queue up to date (e.g. after editing
  // one mid-review) without reordering or resetting review progress when the
  // due list is refetched on screen focus.
  useEffect(() => {
    setQueue((prevQueue) => prevQueue.map((item) => cards.find((card) => card.id === item.id) ?? item));
  }, [cards]);

  const translateX = useSharedValue(0);
  const rotate = useSharedValue(0);

  const current = queue[0] ?? null;

  // Runs only after the fling-away animation has finished, so it never fights an
  // in-flight animation by resetting position mid-flight.
  const completeSwipe = (direction: SwipeDirection) => {
    const card = queue[0];
    if (!card) return;

    setFlipped(false);
    setQueue((prev) => {
      const rest = prev.slice(1);
      return direction === 'left' ? requeueAfterLeft(rest, card) : rest;
    });
    translateX.value = 0;
    rotate.value = 0;

    Promise.resolve(onSwipe(card, direction))
      .then((result) => {
        if (result?.readyToMemorize) setPendingMemorize(card);
        else if (result?.note) {
          setNote(result.note);
          setTimeout(() => setNote(null), 2200);
        }
      })
      .catch((error) => {
        // The card already advanced; a failed write just means this item's
        // schedule didn't update and it comes due again sooner than intended.
        console.warn('Swipe handler failed:', error);
      });
  };

  const pan = Gesture.Pan()
    .onUpdate((event) => {
      translateX.value = event.translationX;
      rotate.value = interpolate(event.translationX, [-SCREEN_WIDTH, SCREEN_WIDTH], [-15, 15], Extrapolation.CLAMP);
    })
    .onEnd((event) => {
      if (event.translationX > SWIPE_THRESHOLD) {
        translateX.value = withTiming(SCREEN_WIDTH * 1.5, { duration: 220 }, (finished) => {
          if (finished) runOnJS(completeSwipe)('right');
        });
      } else if (event.translationX < -SWIPE_THRESHOLD) {
        translateX.value = withTiming(-SCREEN_WIDTH * 1.5, { duration: 220 }, (finished) => {
          if (finished) runOnJS(completeSwipe)('left');
        });
      } else {
        translateX.value = withSpring(0);
        rotate.value = withSpring(0);
      }
    });

  const tap = Gesture.Tap().onEnd(() => {
    runOnJS(setFlipped)(!flipped);
  });

  const composed = Gesture.Race(pan, tap);

  const cardStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }, { rotate: `${rotate.value}deg` }],
  }));

  const knowStampStyle = useAnimatedStyle(() => ({
    opacity: interpolate(translateX.value, [0, STAMP_RANGE], [0, 1], Extrapolation.CLAMP),
  }));

  const dontKnowStampStyle = useAnimatedStyle(() => ({
    opacity: interpolate(translateX.value, [-STAMP_RANGE, 0], [1, 0], Extrapolation.CLAMP),
  }));

  if (pendingMemorize) {
    return <View style={styles.container}>{renderMemorizePrompt(pendingMemorize, () => setPendingMemorize(null))}</View>;
  }

  if (!current) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>{emptyText}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {note && (
        <View style={styles.noteBanner} pointerEvents="none">
          <Text style={styles.noteBannerText}>{note}</Text>
        </View>
      )}
      <View style={styles.cardWrapper}>
        <GestureDetector gesture={composed}>
          <Animated.View style={[styles.card, cardStyle]}>
            <Animated.View style={[styles.stamp, styles.knowStamp, knowStampStyle]} pointerEvents="none">
              <Text style={[styles.stampText, styles.knowStampText]}>KNOW IT</Text>
            </Animated.View>
            <Animated.View style={[styles.stamp, styles.dontKnowStamp, dontKnowStampStyle]} pointerEvents="none">
              <Text style={[styles.stampText, styles.dontKnowStampText]}>DON'T KNOW</Text>
            </Animated.View>

            {flipped ? renderBack(current) : renderFront(current)}
          </Animated.View>
        </GestureDetector>

        {onEdit && (
          <Pressable
            style={styles.editButton}
            onPress={() => onEdit(current)}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Edit"
          >
            <Text style={styles.editButtonText}>✎</Text>
          </Pressable>
        )}
      </View>

      <Text style={styles.hint}>Tap to flip · Swipe right = know it · Swipe left = don't know it</Text>
      <Text style={styles.remaining}>{remainingText(queue.length)}</Text>
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 16, backgroundColor: colors.background },
    emptyContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, backgroundColor: colors.background },
    emptyText: { fontSize: 16, color: colors.textSecondary, textAlign: 'center' },
    cardWrapper: { width: '90%' },
    card: {
      width: '100%',
      minHeight: 260,
      borderRadius: 16,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
      padding: 24,
      shadowColor: '#000',
      shadowOpacity: 0.1,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 4 },
      elevation: 3,
    },
    hint: { marginTop: 20, color: colors.textMuted, fontSize: 13, textAlign: 'center' },
    remaining: { marginTop: 8, color: colors.textSecondary, fontSize: 13 },
    stamp: {
      position: 'absolute',
      top: 24,
      zIndex: 10,
      borderWidth: 4,
      borderRadius: 8,
      paddingHorizontal: 12,
      paddingVertical: 6,
    },
    knowStamp: { right: 16, borderColor: colors.success, transform: [{ rotate: '12deg' }] },
    dontKnowStamp: { left: 16, borderColor: colors.danger, transform: [{ rotate: '-12deg' }] },
    stampText: { fontSize: 20, fontWeight: '800', letterSpacing: 1 },
    knowStampText: { color: colors.success },
    dontKnowStampText: { color: colors.danger },
    editButton: {
      position: 'absolute',
      top: -10,
      right: 4,
      zIndex: 20,
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      shadowColor: '#000',
      shadowOpacity: 0.12,
      shadowRadius: 6,
      shadowOffset: { width: 0, height: 2 },
      elevation: 3,
    },
    editButtonText: { fontSize: 16, color: colors.accent },
    noteBanner: {
      position: 'absolute',
      top: 12,
      alignSelf: 'center',
      zIndex: 30,
      maxWidth: '90%',
      backgroundColor: colors.surfaceAlt,
      borderRadius: 20,
      paddingHorizontal: 16,
      paddingVertical: 10,
      borderWidth: 1,
      borderColor: colors.border,
    },
    noteBannerText: { color: colors.textPrimary, fontSize: 14, fontWeight: '600', textAlign: 'center' },
  });
}
