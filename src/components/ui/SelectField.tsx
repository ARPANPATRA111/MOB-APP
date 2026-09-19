import React, { useMemo, useState } from "react";
import { FlatList, Keyboard, Modal, Pressable, TextInput, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "../../contexts/ThemeContext";
import { AppText } from "../../contexts/TypographyContext";
import { SearchField, useInTable } from "./CommerceUI";

/**
 * iOS picker row: label left, current value right, opens a sheet of options.
 * Use `inset` when the row sits inside a `Group` (adds the table padding).
 */
export default function SelectField({
  label,
  value,
  options,
  onChange,
  disabled = false,
  inset,
  placeholder = "Choose",
}: {
  label: string;
  value: string;
  options: { value: string; label: string; detail?: string }[];
  onChange: (value: string) => void;
  disabled?: boolean;
  inset?: boolean;
  placeholder?: string;
}) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const inTable = useInTable();
  const padded = inset ?? inTable;
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const current = options.find((o) => o.value === value);
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter(
      (o) =>
        o.label.toLowerCase().includes(q) ||
        o.value.toLowerCase().includes(q) ||
        o.detail?.toLowerCase().includes(q),
    );
  }, [options, query]);
  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityValue={{ text: current?.label ?? placeholder }}
        accessibilityState={{ disabled }}
        disabled={disabled}
        onPress={() => {
          TextInput.State.currentlyFocusedInput()?.blur();
          Keyboard.dismiss();
          setQuery("");
          setOpen(true);
        }}
        style={({ pressed }) => ({
          minHeight: 46,
          flexDirection: "row",
          alignItems: "center",
          gap: 12,
          paddingHorizontal: padded ? 14 : 0,
          backgroundColor: pressed ? theme.inputBackground : "transparent",
          opacity: disabled ? 0.5 : 1,
        })}
      >
        <AppText style={{ color: theme.text, fontSize: 14 }}>{label}</AppText>
        <AppText
          numberOfLines={1}
          style={{
            flex: 1,
            textAlign: "right",
            color: current ? theme.textSecondary : theme.placeholder,
            fontSize: 14,
          }}
        >
          {current?.label || placeholder}
        </AppText>
        <Ionicons name="chevron-expand-outline" color={theme.placeholder} size={16} />
      </Pressable>
      <Modal
        visible={open}
        animationType="slide"
        transparent
        statusBarTranslucent
        onRequestClose={() => setOpen(false)}
      >
        <Pressable
          accessibilityLabel="Dismiss"
          onPress={() => setOpen(false)}
          style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.35)" }}
        />
        <View
          style={{
            backgroundColor: theme.background,
            borderTopLeftRadius: 18,
            borderTopRightRadius: 18,
            maxHeight: "78%",
            paddingBottom: insets.bottom + 8,
          }}
        >
          <View style={{ alignItems: "center", paddingTop: 8 }}>
            <View style={{ width: 36, height: 5, borderRadius: 3, backgroundColor: theme.disabled }} />
          </View>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              paddingHorizontal: 16,
              paddingTop: 8,
              paddingBottom: 8,
            }}
          >
            <AppText style={{ color: theme.text, fontSize: 17, fontWeight: "600" }}>{label}</AppText>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close selection"
              onPress={() => setOpen(false)}
              hitSlop={8}
            >
              <AppText style={{ color: theme.primary, fontSize: 15, fontWeight: "600" }}>Done</AppText>
            </Pressable>
          </View>
          {options.length > 8 && (
            <View style={{ paddingHorizontal: 16, paddingBottom: 8 }}>
              <SearchField value={query} onChangeText={setQuery} placeholder="Search" autoFocus />
            </View>
          )}
          <FlatList
            data={filtered}
            keyExtractor={(o) => o.value}
            keyboardShouldPersistTaps="handled"
            initialNumToRender={16}
            contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 8 }}
            style={{ flexGrow: 0 }}
            renderItem={({ item, index }) => {
              const selected = item.value === value;
              return (
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  onPress={() => {
                    onChange(item.value);
                    setOpen(false);
                  }}
                  style={({ pressed }) => ({
                    minHeight: 46,
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 12,
                    paddingHorizontal: 14,
                    backgroundColor: pressed ? theme.inputBackground : theme.cardBackground,
                    borderTopLeftRadius: index === 0 ? 14 : 0,
                    borderTopRightRadius: index === 0 ? 14 : 0,
                    borderBottomLeftRadius: index === filtered.length - 1 ? 14 : 0,
                    borderBottomRightRadius: index === filtered.length - 1 ? 14 : 0,
                    borderTopWidth: index === 0 ? 0 : 0.5,
                    borderTopColor: theme.divider,
                  })}
                >
                  <View style={{ flex: 1 }}>
                    <AppText style={{ color: theme.text, fontSize: 14, fontWeight: selected ? "600" : "400" }}>
                      {item.label}
                    </AppText>
                    {item.detail && (
                      <AppText style={{ color: theme.textSecondary, fontSize: 12 }}>{item.detail}</AppText>
                    )}
                  </View>
                  {selected && <Ionicons name="checkmark" size={20} color={theme.primary} />}
                </Pressable>
              );
            }}
            ListEmptyComponent={
              <AppText style={{ color: theme.textSecondary, padding: 14, textAlign: "center" }}>
                No matches
              </AppText>
            }
          />
        </View>
      </Modal>
    </>
  );
}
