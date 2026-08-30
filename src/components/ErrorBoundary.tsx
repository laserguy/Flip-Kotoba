import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Appearance, Pressable, StyleSheet, Text, View } from 'react-native';
import { darkColors, lightColors } from '../theme/tokens';

interface Props {
  children: ReactNode;
  onError?: (error: Error, componentStack: string) => void;
}

interface State {
  error: Error | null;
}

// Last-resort catch for render/lifecycle errors anywhere in the tree. Without
// it a thrown error unmounts the whole app to a blank screen; here the user
// sees that something broke and can retry or restart. Must be a class
// component — React has no hook equivalent for error boundaries.
export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Unhandled UI error:', error, info.componentStack);
    this.props.onError?.(error, info.componentStack ?? '');
  }

  private reset = () => {
    this.setState({ error: null });
  };

  render() {
    if (!this.state.error) return this.props.children;

    const colors = Appearance.getColorScheme() === 'dark' ? darkColors : lightColors;
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <Text style={[styles.title, { color: colors.textPrimary }]}>Something went wrong</Text>
        <Text style={[styles.body, { color: colors.textSecondary }]}>
          Tap Try Again below. If it keeps happening, close and reopen Flip Kotoba.
        </Text>
        <Pressable style={[styles.button, { backgroundColor: colors.accent }]} onPress={this.reset}>
          <Text style={[styles.buttonText, { color: colors.textOnAccent }]}>Try Again</Text>
        </Pressable>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  title: { fontSize: 18, fontWeight: '700', marginBottom: 8 },
  body: { fontSize: 14, textAlign: 'center', lineHeight: 20, marginBottom: 20 },
  button: { borderRadius: 8, paddingHorizontal: 20, paddingVertical: 12 },
  buttonText: { fontSize: 16, fontWeight: '600' },
});
