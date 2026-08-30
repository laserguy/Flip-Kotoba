import { useMemo, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../theme/useTheme';
import type { ThemeColors } from '../theme/tokens';

export interface HeaderMenuItem {
  label: string;
  destructive?: boolean;
  onPress: () => void;
}

// A "⋮" header button that opens a small dropdown of actions. Render it from a
// screen's `headerRight`. Renders nothing when there are no items.
export default function HeaderMenu({ items }: { items: HeaderMenuItem[] }) {
  const [open, setOpen] = useState(false);
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  if (items.length === 0) return null;

  return (
    <>
      <Pressable onPress={() => setOpen(true)} hitSlop={12} accessibilityRole="button" accessibilityLabel="More options">
        <Text style={styles.trigger}>⋮</Text>
      </Pressable>

      <Modal transparent visible={open} animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <View style={[styles.menu, { top: insets.top + 44 }]}>
            {items.map((item, index) => (
              <Pressable
                key={item.label}
                style={[styles.item, index > 0 && styles.itemDivider]}
                onPress={() => {
                  setOpen(false);
                  item.onPress();
                }}
              >
                <Text style={[styles.itemText, item.destructive && styles.itemTextDestructive]}>{item.label}</Text>
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Modal>
    </>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    trigger: { color: colors.accent, fontSize: 22, fontWeight: '700', paddingHorizontal: 4 },
    backdrop: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.15)' },
    menu: {
      position: 'absolute',
      right: 8,
      minWidth: 180,
      backgroundColor: colors.surface,
      borderRadius: 10,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      overflow: 'hidden',
      shadowColor: '#000',
      shadowOpacity: 0.15,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 4 },
      elevation: 6,
    },
    item: { paddingVertical: 13, paddingHorizontal: 16 },
    itemDivider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
    itemText: { fontSize: 15, color: colors.textPrimary },
    itemTextDestructive: { color: colors.danger },
  });
}
