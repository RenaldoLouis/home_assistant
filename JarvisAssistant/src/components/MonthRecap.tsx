import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { AnimatedPressable } from './AnimatedPressable';
import { Icon, categoryAppearance } from './Icon';
import {
  MonthRecap,
  RecapWeek,
  TOP_CATEGORY_COUNT,
} from '../expenses/monthRecap';
import { money } from '../expenses/money';
import { Colors } from '../theme/colors';

const CHART_HEIGHT = 64;
const AXIS_DAYS = [1, 8, 15, 22, 29];
const DISABLED_ICON = '#AFB4AD';

const monthName = (date: Date) =>
  date.toLocaleDateString('en-GB', { month: 'long' });
const monthTitle = (date: Date) => `${monthName(date)} ${date.getFullYear()}`;
const shortDay = (date: Date) =>
  date.toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
const rangeLabel = (start: Date, end: Date) => {
  const month = end.toLocaleDateString('en-GB', { month: 'short' });
  return start.getDate() === end.getDate()
    ? `${start.getDate()} ${month}`
    : `${start.getDate()}–${end.getDate()} ${month}`;
};
const percentOf = (part: number, whole: number) =>
  Math.round((part / whole) * 100);
const plural = (count: number, word: string) =>
  `${count} ${word}${count === 1 ? '' : 's'}`;

type Trend = 'up' | 'down' | 'flat' | 'none';

interface ComparisonCopy {
  text: string;
  spoken: string;
  trend: Trend;
}

function describeComparison(recap: MonthRecap): ComparisonCopy | null {
  const { comparison, isComplete } = recap;
  if (recap.daysElapsed === 0) return null;
  const previous = comparison.previousMonthStart;
  const period = isComplete
    ? monthName(previous)
    : rangeLabel(
        previous,
        new Date(
          previous.getFullYear(),
          previous.getMonth(),
          comparison.previousPeriodDays,
        ),
      );

  if (comparison.changeRatio === null) {
    if (recap.total === 0) return null;
    const text = `Nothing recorded ${isComplete ? 'in' : 'for'} ${period}`;
    return { text, spoken: text.toLowerCase(), trend: 'none' };
  }
  const percent = Math.round(Math.abs(comparison.changeRatio) * 100);
  if (percent === 0) {
    return {
      text: `Same as ${period}`,
      spoken: `same as ${period}`,
      trend: 'flat',
    };
  }
  const up = comparison.changeRatio > 0;
  return {
    text: `${up ? '↑' : '↓'} ${percent}% vs ${period}`,
    spoken: `${up ? 'up' : 'down'} ${percent}% versus ${period}`,
    trend: up ? 'up' : 'down',
  };
}

function TrendBadge({ comparison }: { comparison: ComparisonCopy }) {
  return (
    <View style={[styles.badge, badgeTone[comparison.trend].badge]}>
      <Text style={[styles.badgeText, badgeTone[comparison.trend].text]}>
        {comparison.text}
      </Text>
    </View>
  );
}

export function MonthRecapCard({
  recap,
  ready,
  onPress,
}: {
  recap: MonthRecap;
  ready: boolean;
  onPress: () => void;
}) {
  const title = recap.isComplete
    ? monthTitle(recap.monthStart)
    : `${monthName(recap.monthStart)} so far`;
  const comparison = ready ? describeComparison(recap) : null;
  return (
    <AnimatedPressable
      testID="month-recap-card"
      disabled={!ready}
      onPress={onPress}
      accessibilityLabel={
        ready
          ? `${title}, ${money(recap.total)}${
              comparison ? `, ${comparison.spoken}` : ''
            }. Open month recap`
          : `${title}, spending unavailable`
      }
      style={styles.card}
    >
      <View style={styles.rowBetween}>
        <Text style={styles.eyebrow}>{title.toUpperCase()}</Text>
        <Icon name="chevronRight" size={16} color="#8B938B" />
      </View>
      <View style={styles.cardTotalRow}>
        <Text
          style={styles.cardTotal}
          adjustsFontSizeToFit
          minimumFontScale={0.7}
          numberOfLines={1}
        >
          {ready ? money(recap.total) : '—'}
        </Text>
        {comparison && <TrendBadge comparison={comparison} />}
      </View>
      {ready && (
        <Text style={styles.meta}>
          {recap.peakDay
            ? `Highest day · ${shortDay(recap.peakDay.date)} · ${money(
                recap.peakDay.total,
              )}`
            : `No spending recorded${recap.isComplete ? '' : ' yet'}`}
        </Text>
      )}
    </AnimatedPressable>
  );
}

export function MonthRecapDetails({
  recap,
  canGoBack,
  canGoForward,
  onPrevious,
  onNext,
  onSelectDay,
}: {
  recap: MonthRecap;
  canGoBack: boolean;
  canGoForward: boolean;
  onPrevious: () => void;
  onNext: () => void;
  onSelectDay: (date: Date) => void;
}) {
  const comparison = describeComparison(recap);
  const previousName = monthName(recap.comparison.previousMonthStart);
  return (
    <>
      <View style={styles.monthNav}>
        <AnimatedPressable
          onPress={onPrevious}
          disabled={!canGoBack}
          accessibilityLabel="Previous month"
          accessibilityState={{ disabled: !canGoBack }}
          style={styles.iconButton}
        >
          <Icon
            name="chevronLeft"
            size={18}
            color={canGoBack ? Colors.textPrimary : DISABLED_ICON}
          />
        </AnimatedPressable>
        <Text accessibilityRole="header" style={styles.monthLabel}>
          {monthTitle(recap.monthStart)}
        </Text>
        <AnimatedPressable
          onPress={onNext}
          disabled={!canGoForward}
          accessibilityLabel="Next month"
          accessibilityState={{ disabled: !canGoForward }}
          style={styles.iconButton}
        >
          <Icon
            name="chevronRight"
            size={18}
            color={canGoForward ? Colors.textPrimary : DISABLED_ICON}
          />
        </AnimatedPressable>
      </View>

      <View style={styles.overview}>
        <Text style={styles.eyebrow}>
          {recap.isComplete ? 'SPENT THIS MONTH' : 'SPENT SO FAR'}
        </Text>
        <Text
          style={styles.total}
          adjustsFontSizeToFit
          minimumFontScale={0.65}
          numberOfLines={1}
        >
          {money(recap.total)}
        </Text>
        {comparison && <TrendBadge comparison={comparison} />}
        {recap.daysElapsed > 0 && (
          <Text style={styles.meta}>
            {`${money(recap.dailyAverage)} a day on average · ${plural(
              recap.expenseCount,
              'expense',
            )}`}
          </Text>
        )}
        {!recap.isComplete && recap.comparison.previousMonthTotal > 0 && (
          <Text style={styles.meta}>
            {`All of ${previousName}: ${money(
              recap.comparison.previousMonthTotal,
            )}`}
          </Text>
        )}
        {recap.incomeTotal > 0 && (
          <Text style={styles.meta}>
            {`+${money(recap.incomeTotal)} received · ${
              recap.netSpend < 0
                ? `net saved ${money(Math.abs(recap.netSpend))}`
                : `actual spend ${money(recap.netSpend)}`
            }`}
          </Text>
        )}
      </View>

      {recap.peakDay && recap.peakWeek ? (
        <>
          <DailyChart recap={recap} />
          <View style={styles.peaks}>
            <PeakRow
              heading="Highest day"
              title={shortDay(recap.peakDay.date)}
              meta={`${percentOf(
                recap.peakDay.total,
                recap.total,
              )}% of the month`}
              amount={recap.peakDay.total}
              accessibilityLabel={`View highest day, ${shortDay(
                recap.peakDay.date,
              )}`}
              onPress={() => onSelectDay(recap.peakDay!.date)}
            />
            <PeakRow
              heading="Highest week"
              title={rangeLabel(recap.peakWeek.start, recap.peakWeek.end)}
              meta={`${weekSpan(recap, recap.peakWeek)} · ${percentOf(
                recap.peakWeek.total,
                recap.total,
              )}% of the month`}
              amount={recap.peakWeek.total}
              accessibilityLabel={`View highest week, ${rangeLabel(
                recap.peakWeek.start,
                recap.peakWeek.end,
              )}`}
              onPress={() => onSelectDay(recap.peakWeek!.start)}
            />
          </View>
          <TopCategories recap={recap} />
        </>
      ) : (
        <Text style={styles.empty}>
          {recap.daysElapsed === 0
            ? 'This month hasn’t started yet.'
            : `No spending recorded in ${monthName(recap.monthStart)}${
                recap.isComplete ? '' : ' yet'
              }.`}
        </Text>
      )}
    </>
  );
}

/** Explains why a week can be shorter than Monday–Sunday. */
function weekSpan(recap: MonthRecap, week: RecapWeek): string {
  const length = week.end.getDate() - week.start.getDate() + 1;
  if (length === 7) return 'Mon–Sun';
  const inProgress =
    !recap.isComplete && week.end.getDate() === recap.daysElapsed;
  return `${plural(length, 'day')}${inProgress ? ' so far' : ', partial week'}`;
}

function DailyChart({ recap }: { recap: MonthRecap }) {
  const max = Math.max(...recap.days.map(day => day.total), 1);
  const peakDate = recap.peakDay!.date.getDate();
  return (
    <View
      accessible
      accessibilityLabel={`Daily spending in ${monthName(
        recap.monthStart,
      )}. Highest on ${shortDay(recap.peakDay!.date)}, ${money(
        recap.peakDay!.total,
      )}.`}
    >
      <Text style={styles.sectionHeading}>Daily spending</Text>
      <View style={styles.chart}>
        {recap.days.map((day, index) => {
          const height =
            day.total > 0 ? Math.max(4, (day.total / max) * CHART_HEIGHT) : 2;
          return (
            <View key={index} style={styles.chartSlot}>
              <View
                style={[
                  styles.chartBar,
                  { height },
                  day.date.getDate() === peakDate
                    ? styles.chartBarPeak
                    : index >= recap.daysElapsed
                    ? styles.chartBarFuture
                    : styles.chartBarMuted,
                ]}
              />
            </View>
          );
        })}
      </View>
      <View style={styles.chartAxis}>
        {recap.days.map((day, index) => (
          <View key={index} style={styles.chartSlot}>
            {AXIS_DAYS.includes(index + 1) && (
              <Text style={styles.axisLabel}>{index + 1}</Text>
            )}
          </View>
        ))}
      </View>
    </View>
  );
}

function PeakRow({
  heading,
  title,
  meta,
  amount,
  accessibilityLabel,
  onPress,
}: {
  heading: string;
  title: string;
  meta: string;
  amount: number;
  accessibilityLabel: string;
  onPress: () => void;
}) {
  return (
    <AnimatedPressable
      onPress={onPress}
      accessibilityLabel={accessibilityLabel}
      style={styles.peakRow}
    >
      <View style={styles.peakBody}>
        <Text style={styles.peakHeading}>{heading}</Text>
        <Text style={styles.peakTitle}>{title}</Text>
        <Text style={styles.meta}>{meta}</Text>
      </View>
      <Text style={styles.peakAmount}>{money(amount)}</Text>
      <Icon name="chevronRight" size={14} color="#8B938B" />
    </AnimatedPressable>
  );
}

function TopCategories({ recap }: { recap: MonthRecap }) {
  const shown = recap.categories.slice(0, TOP_CATEGORY_COUNT);
  const hidden = recap.categories.length - shown.length;
  return (
    <View style={styles.categories}>
      <Text style={styles.sectionHeading}>Top categories</Text>
      {shown.map(item => {
        const appearance = categoryAppearance(item.category);
        const percent = Math.round(item.share * 100);
        return (
          <View
            key={item.category}
            accessible
            accessibilityLabel={`${item.category}, ${money(
              item.total,
            )}, ${percent}% of spending`}
            style={styles.categoryRow}
          >
            <View
              style={[
                styles.categoryIcon,
                { backgroundColor: appearance.background },
              ]}
            >
              <Icon name={appearance.icon} color={appearance.color} size={16} />
            </View>
            <View style={styles.categoryBody}>
              <View style={styles.categoryLine}>
                <Text style={styles.categoryName} numberOfLines={1}>
                  {item.category}
                </Text>
                <Text style={styles.categoryAmount}>{money(item.total)}</Text>
                <Text style={styles.categoryShare}>{`${percent}%`}</Text>
              </View>
              <View style={styles.categoryTrack}>
                <View style={[styles.categoryFill, { width: `${percent}%` }]} />
              </View>
            </View>
          </View>
        );
      })}
      {hidden > 0 && (
        <Text style={styles.meta}>
          {`+${hidden} more ${hidden === 1 ? 'category' : 'categories'}`}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginTop: 12,
    padding: 18,
    backgroundColor: Colors.card,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#EBECE5',
    gap: 8,
  },
  rowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  eyebrow: {
    fontSize: 10.5,
    fontWeight: '600',
    letterSpacing: 1.6,
    color: Colors.textSecondary,
  },
  cardTotalRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 10,
  },
  cardTotal: {
    fontSize: 26,
    fontWeight: '500',
    letterSpacing: -1,
    color: Colors.textPrimary,
    fontVariant: ['tabular-nums'],
    flexShrink: 1,
  },
  meta: { fontSize: 12.5, color: Colors.textSecondary, lineHeight: 18 },
  badge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  badgeText: {
    fontSize: 12.5,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  monthNav: { flexDirection: 'row', alignItems: 'center' },
  monthLabel: {
    flex: 1,
    textAlign: 'center',
    color: Colors.textPrimary,
    fontWeight: '600',
    fontSize: 15,
  },
  iconButton: {
    width: 48,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  overview: { gap: 8 },
  total: {
    fontSize: 36,
    fontWeight: '500',
    letterSpacing: -1.5,
    color: Colors.textPrimary,
    fontVariant: ['tabular-nums'],
  },
  sectionHeading: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textPrimary,
    marginBottom: 12,
  },
  chart: {
    height: CHART_HEIGHT,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 2,
  },
  chartSlot: { flex: 1, alignItems: 'center' },
  chartBar: { width: '100%', borderRadius: 3 },
  chartBarPeak: { backgroundColor: Colors.accent },
  chartBarMuted: { backgroundColor: '#D6E4D9' },
  chartBarFuture: { backgroundColor: '#EFEFE9' },
  chartAxis: { flexDirection: 'row', gap: 2, marginTop: 6 },
  axisLabel: {
    width: 20,
    textAlign: 'center',
    fontSize: 10,
    color: Colors.textSecondary,
  },
  peaks: { gap: 10 },
  peakRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 64,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    backgroundColor: Colors.background,
  },
  peakBody: { flex: 1, gap: 2 },
  peakHeading: {
    fontSize: 10.5,
    fontWeight: '600',
    letterSpacing: 1.2,
    color: Colors.accent,
    textTransform: 'uppercase',
  },
  peakTitle: { fontSize: 15, fontWeight: '600', color: Colors.textPrimary },
  peakAmount: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.textPrimary,
    fontVariant: ['tabular-nums'],
  },
  categories: { gap: 12 },
  categoryRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  categoryIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryBody: { flex: 1, gap: 6 },
  categoryLine: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  categoryName: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  categoryAmount: {
    fontSize: 13,
    color: Colors.textPrimary,
    fontVariant: ['tabular-nums'],
  },
  categoryShare: {
    minWidth: 34,
    textAlign: 'right',
    fontSize: 12,
    color: Colors.textSecondary,
    fontVariant: ['tabular-nums'],
  },
  categoryTrack: {
    height: 4,
    borderRadius: 2,
    backgroundColor: '#F0F0EB',
    overflow: 'hidden',
  },
  categoryFill: { height: 4, borderRadius: 2, backgroundColor: Colors.accent },
  empty: {
    fontSize: 14,
    lineHeight: 21,
    color: Colors.textSecondary,
    textAlign: 'center',
    paddingVertical: 24,
  },
});

const badgeTone: Record<Trend, { badge: object; text: object }> = {
  up: {
    badge: { backgroundColor: '#F7EFE3' },
    text: { color: Colors.warning },
  },
  down: { badge: { backgroundColor: '#E8F6EE' }, text: { color: '#1B8755' } },
  flat: {
    badge: { backgroundColor: '#F3F4ED' },
    text: { color: Colors.textPrimary },
  },
  none: {
    badge: { backgroundColor: '#F3F4ED' },
    text: { color: Colors.textSecondary },
  },
};
