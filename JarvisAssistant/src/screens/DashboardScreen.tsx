import React, { useEffect, useMemo, useState } from 'react';
import {
  AppState,
  FlatList,
  Linking,
  NativeModules,
  ScrollView,
  StatusBar,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AnimatedPressable } from '../components/AnimatedPressable';
import { Calendar } from '../components/Calendar';
import { ExpenseEditor } from '../components/ExpenseEditor';
import { Icon, categoryAppearance } from '../components/Icon';
import { Sheet } from '../components/Sheet';
import { OrbState } from '../components/JarvisOrb';
import { addDays, dayKey, parseDay } from '../expenses/dates';
import { buildDayReport } from '../expenses/expenseSummary';
import { EditableExpense, ExpenseEdit } from '../expenses/types';
import { Colors } from '../theme/colors';
import { dashboardStyles as s } from './DashboardScreen.styles';

export interface DashboardScreenProps {
  isRecordingCommand: boolean;
  commandText: string;
  orbState: OrbState;
  notifPermission: string;
  showNotifModal: boolean;
  expenses: EditableExpense[];
  categoryOptions: string[];
  dataStatus: 'loading' | 'synced' | 'cached' | 'pending' | 'error';
  setShowNotifModal: (show: boolean) => void;
  startListening: () => void;
  stopListening: () => void;
  onExpenseSave: (id: string, edit: ExpenseEdit) => Promise<void>;
  onRequestNotifPermission: () => void;
  onRetry: () => void;
  saveFailed?: boolean;
  onRetrySave?: () => void;
  onDismissSaveError?: () => void;
  dailyNotes: string;
  setDailyNotes: (notes: string) => void;
}
const money = (amount: number) => `Rp ${amount.toLocaleString('id-ID')}`;
const compactMoney = (amount: number) =>
  amount >= 1000000
    ? `${(amount / 1000000).toLocaleString('id-ID', {
        maximumFractionDigits: 1,
      })} jt`
    : amount >= 1000
    ? `${(amount / 1000).toLocaleString('id-ID', {
        maximumFractionDigits: 0,
      })} rb`
    : String(amount);

export const DashboardScreen: React.FC<DashboardScreenProps> = props => {
  const [tab, setTab] = useState<'today' | 'home'>('today');
  const [now, setNow] = useState(new Date());
  const [chosenDay, setChosenDay] = useState<string | null>(null);
  const [panel, setPanel] = useState<'calendar' | 'voice' | 'settings' | null>(
    null,
  );
  const [editing, setEditing] = useState<EditableExpense | null>(null);
  const [rebindStatus, setRebindStatus] = useState<string | null>(null);

  const handleRebindListener = async () => {
    try {
      if (NativeModules.NotificationManagerModule?.rebindListener) {
        await NativeModules.NotificationManagerModule.rebindListener();
        setRebindStatus('Reconnected successfully');
      } else {
        setRebindStatus('Reconnected');
      }
    } catch {
      setRebindStatus('Failed to reconnect');
    }
    setTimeout(() => setRebindStatus(null), 3000);
  };

  const handleOpenBatterySettings = () => {
    Linking.openSettings();
  };
  useEffect(() => {
    const tick = () => setNow(new Date());
    const timer = setInterval(tick, 30000);
    const subscription = AppState.addEventListener('change', state => {
      if (state === 'active') tick();
    });
    return () => {
      clearInterval(timer);
      subscription.remove();
    };
  }, []);
  const selected = chosenDay ? parseDay(chosenDay)! : now;
  const selectedKey = dayKey(selected);
  const isToday = selectedKey === dayKey(now);
  const report = useMemo(
    () => buildDayReport(props.expenses, selected),
    [props.expenses, selected],
  );
  const selectDay = (date: Date) =>
    setChosenDay(dayKey(date) === dayKey(new Date()) ? null : dayKey(date));
  const maxBar = Math.max(...report.week.map(day => day.total), 1);
  const ready = props.dataStatus !== 'loading' && props.dataStatus !== 'error';
  const statusText = {
    loading: 'Loading your expenses…',
    synced: 'Up to date',
    cached: 'Offline · showing saved records',
    pending: 'Changes waiting to sync',
    error: 'Couldn’t load expenses',
  }[props.dataStatus];
  const activeTitle = props.isRecordingCommand
    ? props.orbState === 'speaking'
      ? 'Jarvis is speaking'
      : 'Jarvis is listening'
    : 'Ask Jarvis';
  const openVoice = () => setPanel('voice');

  const header = (
    <>
      <View style={s.top}>
        <View style={s.brand}>
          <View style={s.brandMark}>
            <Icon name="spark" color={Colors.accent} size={21} />
          </View>
          <Text style={s.brandName}>jarvis</Text>
        </View>
        <AnimatedPressable
          onPress={() => setPanel('settings')}
          accessibilityLabel="Open settings"
          style={s.iconButton}
        >
          <Icon name="settings" />
        </AnimatedPressable>
      </View>
      <View style={s.intro}>
        <Text style={s.eyebrow}>YOUR EVERYDAY COMPANION</Text>
        <Text accessibilityRole="header" style={s.title}>
          {tab === 'today'
            ? 'A little more clarity.'
            : 'Make yourself at home.'}
        </Text>
      </View>
    </>
  );
  const spendingHeader = (
    <>
      {header}
      <View style={s.dateHeader}>
        <AnimatedPressable
          onPress={() => setPanel('calendar')}
          accessibilityLabel="Choose a date"
          style={s.dateLabel}
        >
          <Text style={s.month}>
            {selected.toLocaleDateString('en-GB', {
              month: 'long',
              year: 'numeric',
            })}
          </Text>
          <Icon name="calendar" size={18} />
        </AnimatedPressable>
        {!isToday && (
          <AnimatedPressable
            onPress={() => setChosenDay(null)}
            accessibilityLabel="Return to today"
            style={s.todayButton}
          >
            <Text style={s.link}>Today</Text>
          </AnimatedPressable>
        )}
        <AnimatedPressable
          onPress={() => selectDay(addDays(selected, -7))}
          style={s.iconButton}
          accessibilityLabel="Previous week"
        >
          <Icon name="chevronLeft" size={18} />
        </AnimatedPressable>
        <AnimatedPressable
          disabled={addDays(report.week[0].date, 7) > now}
          onPress={() =>
            selectDay(addDays(selected, 7) > now ? now : addDays(selected, 7))
          }
          style={s.iconButton}
          accessibilityLabel="Next week"
        >
          <Icon
            name="chevronRight"
            size={18}
            color={
              addDays(report.week[0].date, 7) > now
                ? '#AFB4AD'
                : Colors.textPrimary
            }
          />
        </AnimatedPressable>
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={s.days}
      >
        {report.week.map(day => {
          const active = dayKey(day.date) === selectedKey;
          return (
            <AnimatedPressable
              key={day.label}
              onPress={() => selectDay(day.date)}
              disabled={day.date > now}
              accessibilityLabel={`${day.date.toDateString()}, ${
                ready ? money(day.total) : 'spending unavailable'
              }`}
              accessibilityState={{
                selected: active,
                disabled: day.date > now,
              }}
              style={s.dayCell}
            >
              <Text style={[s.weekday, active && s.activeLabel]}>
                {day.label.slice(0, 1)}
              </Text>
              <View style={[s.dayCircle, active && s.dayCircleActive]}>
                <Text
                  style={[
                    s.dayNumber,
                    active && s.dayNumberActive,
                    day.date > now && s.future,
                  ]}
                >
                  {day.date.getDate()}
                </Text>
              </View>
              <View
                style={[
                  s.dot,
                  ready &&
                    day.total > 0 &&
                    (active ? s.dotActive : s.dotRecorded),
                ]}
              />
            </AnimatedPressable>
          );
        })}
      </ScrollView>
      <View style={s.summary}>
        <View style={s.rowBetween}>
          <Text style={s.meta}>
            {isToday
              ? 'Today’s spending'
              : selected.toLocaleDateString('en-GB', {
                  weekday: 'long',
                  day: 'numeric',
                  month: 'short',
                })}
          </Text>
          <Text style={s.count}>
            {ready
              ? report.incomeCount > 0
                ? `${report.expenseCount} expenses · ${report.incomeCount} income`
                : `${report.expenseCount} expenses`
              : '—'}
          </Text>
        </View>
        <Text
          style={s.total}
          adjustsFontSizeToFit
          minimumFontScale={0.65}
          numberOfLines={1}
        >
          {ready ? money(report.total) : '—'}
        </Text>
        {ready && report.incomeTotal > 0 && (
          <View style={s.netSummaryRow}>
            <View style={s.incomeBadgeRow}>
              <Text style={s.incomeBadgeText}>
                {`Received: +${money(report.incomeTotal)}`}
              </Text>
            </View>
            <View
              style={[
                s.actualSpendBadge,
                report.netSpend < 0
                  ? s.actualSpendBadgeSurplus
                  : s.actualSpendBadgeDeficit,
              ]}
            >
              <Text
                style={[
                  s.actualSpendText,
                  report.netSpend < 0
                    ? s.actualSpendTextSurplus
                    : s.actualSpendTextDeficit,
                ]}
              >
                {report.netSpend < 0
                  ? `Net saved: +${money(Math.abs(report.netSpend))}`
                  : `Actual spend: ${money(report.netSpend)}`}
              </Text>
            </View>
          </View>
        )}
        <View style={s.summaryDivider} />
        <View style={s.rowBetween}>
          <View>
            <Text style={s.smallHeading}>
              {dayKey(report.week[0].date) ===
              dayKey(addDays(now, -((now.getDay() + 6) % 7)))
                ? 'This week'
                : `Week of ${report.week[0].date.toLocaleDateString('en-GB', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                  })}`}
            </Text>
            {ready && report.weekIncomeTotal > 0 && (
              <Text style={s.weekBreakdown}>
                {`${money(report.weekTotal)} spent · +${money(
                  report.weekIncomeTotal,
                )} earned`}
              </Text>
            )}
          </View>
          <View
            style={
              ready && report.weekIncomeTotal > 0 ? s.weekRight : undefined
            }
          >
            {ready && report.weekIncomeTotal > 0 && (
              <Text style={s.weekActualLabel}>Actual spend</Text>
            )}
            <Text
              style={[
                s.weekTotal,
                ready &&
                  report.weekIncomeTotal > 0 &&
                  report.weekNetSpend < 0 &&
                  s.weekTotalSurplus,
              ]}
            >
              {ready
                ? report.weekIncomeTotal > 0
                  ? report.weekNetSpend < 0
                    ? `-${money(Math.abs(report.weekNetSpend))}`
                    : money(report.weekNetSpend)
                  : money(report.weekTotal)
                : '—'}
            </Text>
          </View>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={s.chart}
        >
          {report.week.map(day => {
            const active = dayKey(day.date) === selectedKey;
            const barHeight = ready
              ? Math.max(day.total > 0 ? 6 : 3, (day.total / maxBar) * 56)
              : 3;
            return (
              <AnimatedPressable
                key={day.label}
                onPress={() => selectDay(day.date)}
                disabled={day.date > now}
                accessibilityLabel={`${day.label}, ${
                  ready ? money(day.total) : 'spending unavailable'
                }`}
                accessibilityState={{ selected: active }}
                style={s.barColumn}
              >
                <Text numberOfLines={1} style={s.barValue}>
                  {ready && day.total > 0 ? compactMoney(day.total) : '–'}
                </Text>
                <View style={s.barTrack}>
                  <View
                    style={[
                      s.bar,
                      { height: barHeight },
                      active ? s.barActive : s.barMuted,
                    ]}
                  />
                </View>
                <Text style={[s.chartLabel, active && s.activeLabel]}>
                  {day.label}
                </Text>
              </AnimatedPressable>
            );
          })}
        </ScrollView>
      </View>
      <View style={s.listHeading}>
        <Text accessibilityRole="header" style={s.sectionTitle}>
          {isToday ? 'Today’s expenses' : 'Your expenses'}
        </Text>
        <Text style={s.meta}>Tap to edit</Text>
      </View>
      {props.dataStatus !== 'synced' && (
        <View style={s.notice}>
          <Text accessibilityLiveRegion="polite" style={s.noticeText}>
            {statusText}
          </Text>
          {props.dataStatus === 'error' && (
            <AnimatedPressable onPress={props.onRetry} style={s.retry}>
              <Text style={s.link}>Retry</Text>
            </AnimatedPressable>
          )}
        </View>
      )}
    </>
  );

  return (
    <SafeAreaView
      style={s.container}
      edges={['top', 'left', 'right', 'bottom']}
    >
      <StatusBar barStyle="dark-content" backgroundColor={Colors.background} />
      {tab === 'today' ? (
        <FlatList
          data={ready ? report.expenses : []}
          keyExtractor={expense => expense.id}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={s.list}
          ListHeaderComponent={spendingHeader}
          ListEmptyComponent={
            <View style={s.empty}>
              <View style={s.emptyIcon}>
                <Icon name="wallet" size={28} />
              </View>
              <Text style={s.emptyTitle}>
                {ready
                  ? 'A quiet day for your wallet.'
                  : props.dataStatus === 'error'
                  ? 'Your expenses are unavailable.'
                  : 'Gathering your day…'}
              </Text>
              <Text style={s.emptyText}>
                {ready
                  ? 'No expenses recorded for this day. New spending notifications will appear here.'
                  : 'Your totals will appear when spending data is available.'}
              </Text>
            </View>
          }
          renderItem={({ item }) => {
            const isIncome = item.type === 'income';
            const appearance = categoryAppearance(item.category);
            const merchant =
              item.merchant !== item.category && item.merchant !== 'Unknown'
                ? `${item.merchant} · `
                : '';
            const amountPrefix = isIncome ? '+' : '';
            return (
              <AnimatedPressable
                onPress={() => setEditing(item)}
                accessibilityLabel={`Edit ${item.category}, ${amountPrefix}${money(
                  item.amount,
                )}${item.note ? `, note: ${item.note}` : ''}`}
                style={s.expenseCard}
              >
                <View
                  style={[
                    s.categoryIcon,
                    { backgroundColor: appearance.background },
                  ]}
                >
                  <Icon name={appearance.icon} color={appearance.color} />
                </View>
                <View style={s.expenseBody}>
                  <View style={s.expenseMain}>
                    <Text style={s.expenseCategory}>{item.category}</Text>
                    <Text
                      style={[
                        s.expenseAmount,
                        isIncome && s.incomeAmount,
                      ]}
                    >
                      {`${amountPrefix}${money(item.amount)}`}
                    </Text>
                  </View>
                  <Text style={s.expenseMeta}>
                    {merchant}
                    {item.bank} ·{' '}
                    {new Date(item.date).toLocaleTimeString('en-GB', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </Text>
                  {!!item.note && (
                    <Text style={s.expenseNote} numberOfLines={2}>
                      {item.note}
                    </Text>
                  )}
                </View>
                <Icon name="chevronRight" size={14} color="#8B938B" />
              </AnimatedPressable>

            );
          }}
          ListFooterComponent={
            <Text style={s.footerNote}>
              Your day, in your phone’s timezone.
            </Text>
          }
        />
      ) : (
        <ScrollView
          contentContainerStyle={s.list}
          showsVerticalScrollIndicator={false}
        >
          {header}
          <Text style={s.homeIntro}>
            A place for the things Jarvis will help you control.
          </Text>
          <View style={s.deviceCard}>
            <View style={s.deviceIcon}>
              <Icon name="lamp" size={32} />
            </View>
            <Text style={s.deviceBadge}>SETUP NEXT</Text>
            <Text style={s.deviceName}>Your Prolink lamp</Text>
            <Text style={s.deviceMeta}>DS-3601 · 9W · mEzee</Text>
            <Text style={s.deviceDescription}>
              Keep using mEzee for now. We’ll connect your lamp to Jarvis after
              the design update.
            </Text>
          </View>
          <View style={s.deviceCard}>
            <View style={s.deviceIcon}>
              <Icon name="speaker" size={32} />
            </View>
            <Text style={s.deviceBadge}>AWAITING ARRIVAL</Text>
            <Text style={s.deviceName}>Your Bluetooth speaker</Text>
            <Text style={s.deviceDescription}>
              Once it arrives, we’ll test pairing and music playback at home.
            </Text>
          </View>
          <View style={s.homeVoice}>
            <Icon name="spark" />
            <Text style={s.homeVoiceText}>
              In the meantime, ask Jarvis about your spending.
            </Text>
          </View>
        </ScrollView>
      )}
      {props.saveFailed && (
        <View style={s.notice}>
          <Text accessibilityRole="alert" style={s.noticeText}>
            An expense change could not sync. Retry to save it.
          </Text>
          <AnimatedPressable
            accessibilityLabel="Retry expense save"
            style={s.retry}
            onPress={props.onRetrySave}
          >
            <Text style={s.link}>Retry</Text>
          </AnimatedPressable>
          <AnimatedPressable
            accessibilityLabel="Dismiss save error"
            style={s.iconButton}
            onPress={props.onDismissSaveError}
          >
            <Icon name="close" size={18} />
          </AnimatedPressable>
        </View>
      )}
      <View style={s.navigation}>
        <AnimatedPressable
          onPress={() => setTab('today')}
          accessibilityRole="tab"
          accessibilityState={{ selected: tab === 'today' }}
          style={s.navItem}
        >
          <Icon
            name="calendar"
            color={tab === 'today' ? Colors.coral : Colors.textSecondary}
            size={21}
          />
          <Text style={[s.navLabel, tab === 'today' && s.navActive]}>
            Today
          </Text>
        </AnimatedPressable>
        <AnimatedPressable
          onPress={openVoice}
          style={s.voiceButton}
          accessibilityLabel={activeTitle}
        >
          <Icon name="mic" color="#FFFFFF" size={19} />
          <Text style={s.voiceButtonText}>
            {props.isRecordingCommand
              ? props.orbState === 'speaking'
                ? 'Speaking'
                : 'Listening'
              : 'Ask Jarvis'}
          </Text>
        </AnimatedPressable>
        <AnimatedPressable
          onPress={() => setTab('home')}
          accessibilityRole="tab"
          accessibilityState={{ selected: tab === 'home' }}
          style={s.navItem}
        >
          <Icon
            name="home"
            color={tab === 'home' ? Colors.coral : Colors.textSecondary}
            size={21}
          />
          <Text style={[s.navLabel, tab === 'home' && s.navActive]}>Home</Text>
        </AnimatedPressable>
      </View>
      {editing && (
        <ExpenseEditor
          expense={editing}
          categories={props.categoryOptions}
          onSave={props.onExpenseSave}
          onClose={() => setEditing(null)}
        />
      )}
      {panel === 'calendar' && (
        <Sheet title="Choose a day" onClose={() => setPanel(null)}>
          <Calendar
            value={selected}
            onSelect={date => {
              selectDay(date);
              setPanel(null);
            }}
          />
        </Sheet>
      )}
      {panel === 'voice' && (
        <Sheet title={activeTitle} onClose={() => setPanel(null)}>
          <View style={s.voiceArt}>
            <Icon name="spark" color={Colors.accent} size={54} />
          </View>
          <Text style={s.voicePrompt}>
            {props.commandText || '“How much did I spend today?”'}
          </Text>
          <Text style={s.voiceHint}>
            {props.isRecordingCommand
              ? 'You can close this panel while the conversation continues. Tap Stop to end it.'
              : 'Tap below to start a conversation. Your microphone is used only while a session is active.'}
          </Text>
          <AnimatedPressable
            onPress={
              props.isRecordingCommand
                ? props.stopListening
                : props.startListening
            }
            style={s.primaryButton}
          >
            <Text style={s.primaryText}>
              {props.isRecordingCommand ? 'Stop conversation' : 'Start talking'}
            </Text>
          </AnimatedPressable>
        </Sheet>
      )}
      {panel === 'settings' && (
        <Sheet title="Your Jarvis" onClose={() => setPanel(null)}>
          <Text style={s.smallHeading}>Spending capture</Text>
          <Text style={s.deviceDescription}>
            {props.notifPermission === 'authorized'
              ? 'Notification access is enabled. Supported spending alerts are read on your phone.'
              : 'Allow notification access to capture supported spending alerts.'}
          </Text>
          <AnimatedPressable
            onPress={props.onRequestNotifPermission}
            style={s.settingButton}
            accessibilityLabel="Notification settings"
          >
            <Text style={s.link}>Notification settings</Text>
            <Icon name="chevronRight" size={18} />
          </AnimatedPressable>
          <View style={s.tipBox}>
            <Text style={s.tipTitle}>Samsung & Android Battery</Text>
            <Text style={s.tipText}>
              Set Battery to “Unrestricted” in App Info so overnight alerts are not paused by Android or Samsung power management.
            </Text>
          </View>
          <AnimatedPressable
            onPress={handleOpenBatterySettings}
            style={s.settingButton}
            accessibilityLabel="Battery settings"
          >
            <Text style={s.link}>Battery settings (Unrestricted)</Text>
            <Icon name="chevronRight" size={18} />
          </AnimatedPressable>
          <AnimatedPressable
            onPress={handleRebindListener}
            style={s.settingButton}
            accessibilityLabel="Re-connect listener"
          >
            <Text style={s.link}>Re-connect listener</Text>
            <Icon name="refresh" size={18} />
          </AnimatedPressable>
          {rebindStatus && (
            <Text style={s.rebindStatusText}>{rebindStatus}</Text>
          )}
          <Text style={s.smallHeading}>Date & time</Text>
          <Text style={s.deviceDescription}>
            Follows your phone’s timezone. If you travel, expenses near midnight
            may move to another day.
          </Text>
          <Text style={s.smallHeading}>Data status</Text>
          <Text style={s.deviceDescription}>{statusText}</Text>
          <Text style={s.smallHeading}>Session notes</Text>
          <Text style={s.deviceDescription}>
            A scratchpad for this session. Notes are cleared when the app
            restarts.
          </Text>
          <TextInput
            multiline
            value={props.dailyNotes}
            onChangeText={props.setDailyNotes}
            style={s.notes}
            accessibilityLabel="Session notes"
            placeholder="Something to remember…"
            placeholderTextColor={Colors.textSecondary}
          />
        </Sheet>
      )}
      {props.showNotifModal && (
        <Sheet
          title="Capture your spending"
          onClose={() => props.setShowNotifModal(false)}
        >
          <Text style={s.deviceDescription}>
            Allow Jarvis notification access in Android Settings to read
            supported bank spending alerts. Notification extraction happens on
            your phone.
          </Text>
          <View style={s.tipBox}>
            <Text style={s.tipTitle}>Samsung / Android Tip</Text>
            <Text style={s.tipText}>
              Also set Battery to “Unrestricted” in App Info so overnight spending alerts are captured without being put to sleep.
            </Text>
          </View>
          <AnimatedPressable
            style={s.primaryButton}
            onPress={props.onRequestNotifPermission}
            accessibilityLabel="Open notification settings"
          >
            <Text style={s.primaryText}>Open notification settings</Text>
          </AnimatedPressable>
          <AnimatedPressable
            style={s.secondaryButton}
            onPress={handleOpenBatterySettings}
            accessibilityLabel="Open battery settings"
          >
            <Text style={s.secondaryButtonText}>Open battery settings</Text>
          </AnimatedPressable>
          <AnimatedPressable
            style={s.settingButton}
            onPress={() => props.setShowNotifModal(false)}
            accessibilityLabel="Not now"
          >
            <Text style={s.link}>Not now</Text>
          </AnimatedPressable>
        </Sheet>
      )}
    </SafeAreaView>
  );
};
