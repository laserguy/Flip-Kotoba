import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../types/navigation';
import WordDeckDetailScreen from './WordDeckDetailScreen';
import KanjiDeckDetailScreen from './KanjiDeckDetailScreen';

type Props = NativeStackScreenProps<RootStackParamList, 'DeckDetail'>;

// The word and kanji deck screens share a shape but differ enough (queries,
// sort options, item rows, header action) that each is its own screen. This
// picks between them by the deck's content type.
export default function DeckDetailScreen(props: Props) {
  return props.route.params.deckContent === 'kanji' ? (
    <KanjiDeckDetailScreen {...props} />
  ) : (
    <WordDeckDetailScreen {...props} />
  );
}
