import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { AnimatedPressable } from './AnimatedPressable';
import { Icon } from './Icon';
import { dayKey, startOfDay } from '../expenses/dates';
import { Colors } from '../theme/colors';

export function Calendar({
  value,
  onSelect,
}: {
  value: Date;
  onSelect: (date: Date) => void;
}) {
  const [month, setMonth] = useState(
    new Date(value.getFullYear(), value.getMonth(), 1),
  );
  const offset = (month.getDay() + 6) % 7;
  const count = new Date(
    month.getFullYear(),
    month.getMonth() + 1,
    0,
  ).getDate();
  const cells = Math.ceil((offset + count) / 7) * 7;
  const today = startOfDay(new Date());
  return (
    <View>
      <View style={styles.heading}>
        <AnimatedPressable
          accessibilityLabel="Previous month"
          style={styles.arrow}
          onPress={() =>
            setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))
          }
        >
          <Icon name="chevronLeft" />
        </AnimatedPressable>
        <Text style={styles.month}>
          {month.toLocaleDateString('en-GB', {
            month: 'long',
            year: 'numeric',
          })}
        </Text>
        <AnimatedPressable
          accessibilityLabel="Next month"
          style={styles.arrow}
          disabled={
            month.getFullYear() === today.getFullYear() &&
            month.getMonth() === today.getMonth()
          }
          onPress={() =>
            setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))
          }
        >
          <Icon name="chevronRight" />
        </AnimatedPressable>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={styles.grid}>
          <View style={styles.week}>
            {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((day, index) => (
              <Text key={index} style={styles.weekday}>
                {day}
              </Text>
            ))}
          </View>
          {Array.from({ length: cells / 7 }, (_, row) => (
            <View key={row} style={styles.week}>
              {Array.from({ length: 7 }, (unusedDay, col) => {
                const day = row * 7 + col - offset + 1;
                const date = new Date(
                  month.getFullYear(),
                  month.getMonth(),
                  day,
                );
                if (day < 1 || day > count)
                  return <View key={col} style={styles.cell} />;
                const selected = dayKey(date) === dayKey(value);
                const disabled = date > today;
                return (
                  <AnimatedPressable
                    key={col}
                    style={[styles.cell, selected && styles.selected]}
                    accessibilityLabel={date.toDateString()}
                    accessibilityState={{ selected, disabled }}
                    disabled={disabled}
                    onPress={() => onSelect(date)}
                  >
                    <Text
                      style={[
                        styles.day,
                        selected && styles.selectedText,
                        disabled && styles.disabled,
                      ]}
                    >
                      {day}
                    </Text>
                  </AnimatedPressable>
                );
              })}
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}
const styles = StyleSheet.create({
  heading: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  arrow: {
    width: 48,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
  },
  month: {
    flex: 1,
    textAlign: 'center',
    fontSize: 17,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  week: { flexDirection: 'row' },
  weekday: {
    flex: 1,
    textAlign: 'center',
    paddingVertical: 8,
    color: Colors.textSecondary,
  },
  grid: { flexGrow: 1, minWidth: 336 },
  cell: {
    flex: 1,
    minWidth: 48,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 24,
  },
  selected: { backgroundColor: Colors.accent },
  day: { fontSize: 16, color: Colors.textPrimary },
  selectedText: { color: '#FFFFFF' },
  disabled: { color: '#A2A7A1' },
});
