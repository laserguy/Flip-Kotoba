import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../types/navigation';
import DeckListScreen from '../screens/DeckListScreen';
import DeckDetailScreen from '../screens/DeckDetailScreen';
import DeckFormScreen from '../screens/DeckFormScreen';
import WordFormScreen from '../screens/WordFormScreen';
import WordDetailScreen from '../screens/WordDetailScreen';
import SettingsScreen from '../screens/SettingsScreen';
import ScanVocabScreen from '../screens/ScanVocabScreen';
import ScanKanjiScreen from '../screens/ScanKanjiScreen';
import KanjiDetailScreen from '../screens/KanjiDetailScreen';
import OnboardingScreen from '../screens/OnboardingScreen';

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function RootNavigator({ initialRouteName }: { initialRouteName: 'DeckList' | 'Onboarding' }) {
  return (
    <Stack.Navigator initialRouteName={initialRouteName}>
      <Stack.Screen
        name="Onboarding"
        component={OnboardingScreen}
        initialParams={{ mode: 'first-launch' }}
        options={({ route }) => ({
          headerShown: route.params.mode === 'replay',
          title: 'How to Use',
        })}
      />
      <Stack.Screen name="DeckList" component={DeckListScreen} options={{ title: 'Decks' }} />
      <Stack.Screen
        name="DeckDetail"
        component={DeckDetailScreen}
        options={({ route }) => ({ title: route.params.deckName })}
      />
      <Stack.Screen
        name="DeckForm"
        component={DeckFormScreen}
        options={({ route }) => ({
          title: route.params.content === 'kanji' ? 'New Kanji Deck' : 'New Deck',
          presentation: 'modal',
        })}
      />
      <Stack.Screen
        name="WordForm"
        component={WordFormScreen}
        options={({ route }) => ({
          title: route.params.wordId != null ? 'Edit Word' : 'Add Word',
          presentation: 'modal',
        })}
      />
      <Stack.Screen name="WordDetail" component={WordDetailScreen} options={{ title: 'Word' }} />
      <Stack.Screen name="Settings" component={SettingsScreen} options={{ title: 'Settings', presentation: 'modal' }} />
      <Stack.Screen
        name="ScanVocab"
        component={ScanVocabScreen}
        options={{ title: 'Scan Vocab Page', presentation: 'modal' }}
      />
      <Stack.Screen
        name="ScanKanji"
        component={ScanKanjiScreen}
        options={{ title: 'Scan Kanji Page', presentation: 'modal' }}
      />
      <Stack.Screen name="KanjiDetail" component={KanjiDetailScreen} options={{ title: 'Kanji' }} />
    </Stack.Navigator>
  );
}
