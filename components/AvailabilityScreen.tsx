import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, BackHandler, Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { ScheduleSaveResult, loadSchedule, saveSchedule } from '../lib/matchmaking';
import { clearDraft, readDraft, storeDraft } from '../lib/drafts';
import { DAYS, SPORTS, Schedule, Slot, Sport, copyDay, errorMessage, hourTime, minutes, scheduleKey, timeLabel, validateSchedule, windowIssue } from '../lib/schedule';
import { Button, ErrorNotice, useUI } from './ui';
import { Palette } from './ThemeProvider';

type Props = { userId: string; onBack: () => void; onSaved: (result: ScheduleSaveResult) => void };
type Editing = { index: number; field: 'start_time' | 'end_time' };

export default function AvailabilityScreen({ userId, onBack, onSaved }: Props) {
  const { colors, ui, reduceMotion } = useUI();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [sports, setSports] = useState<Sport[]>([]);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [storageError, setStorageError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [leavingBusy, setLeavingBusy] = useState(false);
  const [baseline, setBaseline] = useState('');
  const [pendingDraft, setPendingDraft] = useState<(Schedule & { base: string }) | null>(null);
  const [reload, setReload] = useState(0);
  const [editing, setEditing] = useState<Editing | null>(null);
  const [copySource, setCopySource] = useState<number | null>(null);
  const [copyTargets, setCopyTargets] = useState<number[]>([]);
  const saveLock = useRef(false);
  const alive = useRef(true);
  const leaving = useRef(false);
  const snapshot = { sports, slots };
  const dirty = baseline !== '' && scheduleKey(snapshot) !== baseline;
  const validation = validateSchedule(sports, slots);
  const locked = saving || leavingBusy || pendingDraft !== null;
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setLoadError(null);
    async function load() {
      try {
        const saved = await loadSchedule(userId);
        if (!active) return;
        setSports(saved.sports);
        setSlots(saved.slots);
        setBaseline(scheduleKey(saved));
        try {
          const draft = await readDraft(userId, saved);
          if (active) setPendingDraft(draft);
        } catch (error) { if (active) setStorageError(errorMessage(error)); }
      } catch (error) { if (active) setLoadError(errorMessage(error)); }
      finally { if (active) setLoading(false); }
    }
    void load();
    return () => { active = false; };
  }, [userId, reload]);

  useEffect(() => {
    if (loading || loadError || pendingDraft || !baseline || leaving.current || saveLock.current) return;
    const operation = dirty ? storeDraft(userId, { sports, slots }, baseline) : clearDraft(userId);
    operation.catch(error => { if (alive.current) setStorageError(`Draft could not be saved on this device: ${errorMessage(error)}`); });
  }, [sports, slots, baseline, dirty, loading, loadError, pendingDraft, userId]);

  function changeSlots(next: Slot[]) { setSlots(next); setSaveError(null); }
  async function leave(keepDraft: boolean) {
    leaving.current = true;
    setLeavingBusy(true);
    try {
      if (keepDraft) await storeDraft(userId, snapshot, baseline);
      else await clearDraft(userId);
      if (alive.current) onBack();
    } catch (error) { leaving.current = false; if (alive.current) { setLeavingBusy(false); setStorageError(errorMessage(error)); } }
  }
  function back() {
    if (saveLock.current || leaving.current) return;
    if (dirty) Alert.alert('Leave your schedule?', 'You can keep a draft on this device or discard these changes.', [
      { text: 'Keep editing', style: 'cancel' },
      { text: 'Keep draft & leave', onPress: () => { void leave(true); } },
      { text: 'Discard changes', style: 'destructive', onPress: () => { void leave(false); } },
    ]);
    else onBack();
  }
  useEffect(() => {
    const listener = BackHandler.addEventListener('hardwareBackPress', () => { back(); return true; });
    return () => listener.remove();
  });

  function addWindow(day: number) {
    const existing = slots.filter(slot => slot.day_of_week === day);
    const hour = Array.from({ length: 24 }, (_, i) => (i + 17) % 24).find(hour =>
      !existing.some(slot => hour * 60 < minutes(slot.end_time) && (hour + 1) * 60 > minutes(slot.start_time)));
    if (hour === undefined) { Alert.alert('Day is full', 'Remove or adjust a window to add another.'); return; }
    changeSlots([...slots, { day_of_week: day, start_time: hourTime(hour), end_time: hourTime(hour + 1) }]);
  }
  async function save() {
    if (saveLock.current || loading || loadError || pendingDraft || leaving.current) return;
    if (validation) { setSaveError(validation); return; }
    saveLock.current = true;
    setSaving(true);
    setSaveError(null);
    try {
      const result = await saveSchedule(sports, slots);
      leaving.current = true;
      try { await clearDraft(userId); }
      catch { if (alive.current) Alert.alert('Schedule saved', 'Your schedule was saved, but the local draft could not be cleared.'); }
      if (alive.current) onSaved(result);
    } catch (error) { if (alive.current) setSaveError(errorMessage(error)); }
    finally { saveLock.current = false; if (alive.current) setSaving(false); }
  }
  async function discardPending() {
    try { await clearDraft(userId); if (alive.current) { setPendingDraft(null); setStorageError(null); } }
    catch (error) { if (alive.current) setStorageError(errorMessage(error)); }
  }

  return <View style={ui.screen}>
    <ScrollView contentContainerStyle={ui.content}>
      <Text style={ui.title}>Availability</Text>
      <Button label="Back to home" secondary onPress={back} disabled={saving || leavingBusy} />
      {storageError && <ErrorNotice message={storageError} />}
      {pendingDraft && <View style={ui.card}>
        <Text style={ui.heading}>Continue your draft?</Text>
        <Text style={ui.text}>{pendingDraft.base !== baseline
          ? 'Your saved schedule has changed since this draft was started. Restoring brings back the draft for review; saving it will replace the current schedule.'
          : 'An unfinished schedule was found on this device. It has not been sent to RunIt.'}</Text>
        <Button label="Restore draft" onPress={() => { setSports(pendingDraft.sports); setSlots(pendingDraft.slots); setPendingDraft(null); }} />
        <Button label="Discard draft & use saved schedule" secondary onPress={() => { void discardPending(); }} />
      </View>}
      {loading ? <ActivityIndicator accessibilityLabel="Loading saved schedule" color={colors.green} size="large" /> : loadError ? <>
        <ErrorNotice message={`Unable to load your schedule: ${loadError}`} />
        <Button label="Try again" onPress={() => setReload(value => value + 1)} />
      </> : <>
        <View style={{ gap: 12 }}>
          <Text style={ui.heading}>Sports</Text>
          <Text style={ui.text}>Choose one or more. Your hours apply to all selected sports.</Text>
          {SPORTS.map(sport => {
            const selected = sports.includes(sport.id);
            return <TouchableOpacity key={sport.id} accessibilityRole="checkbox" accessibilityState={{ checked: selected, disabled: locked }} disabled={locked}
              onPress={() => { setSports(selected ? sports.filter(id => id !== sport.id) : [...sports, sport.id]); setSaveError(null); }}
              style={[styles.sport, selected && styles.selected]}>
              <Text style={styles.sportText}>{sport.label}</Text><Text style={styles.link}>{selected ? 'Selected' : 'Select'}</Text>
            </TouchableOpacity>;
          })}
        </View>
        <Text style={ui.heading}>Weekly hours</Text>
        <Text style={ui.text}>Amherst time (America/New_York). Split overnight hours across two days.</Text>
        {slots.some(slot => !Number.isInteger(slot.day_of_week) || slot.day_of_week < 1 || slot.day_of_week > 7) && <View style={ui.card}>
          <ErrorNotice message="Some saved windows have an invalid weekday. Remove them and add the correct day below." />
          <Button label="Remove windows with invalid days" secondary disabled={locked} onPress={() => changeSlots(slots.filter(slot => Number.isInteger(slot.day_of_week) && slot.day_of_week >= 1 && slot.day_of_week <= 7))} />
        </View>}
        {DAYS.map((day, dayIndex) => {
          const daySlots = slots.map((slot, index) => ({ slot, index })).filter(({ slot }) => slot.day_of_week === dayIndex + 1);
          return <View key={day} style={ui.card}>
            <View style={ui.row}><Text style={styles.day}>{day}</Text>
              <TouchableOpacity accessibilityRole="button" accessibilityLabel={`Add window on ${day}`} disabled={locked} onPress={() => addWindow(dayIndex + 1)} style={styles.add}><Text style={styles.link}>+ Add time</Text></TouchableOpacity>
            </View>
            {!daySlots.length && <Text style={ui.text}>No availability added</Text>}
            {daySlots.map(({ slot, index }) => <View key={index} style={styles.window}>
              <View style={styles.times}>{(['start_time', 'end_time'] as const).map(field => <TouchableOpacity key={field} accessibilityRole="button" accessibilityLabel={`${day} ${field === 'start_time' ? 'start' : 'end'} time, ${timeLabel(slot[field])}`}
                onPress={() => setEditing({ index, field })} disabled={locked} style={styles.time}>
                <Text style={styles.caption}>{field === 'start_time' ? 'FROM' : 'UNTIL'}</Text><Text style={styles.timeText}>{timeLabel(slot[field])}</Text>
              </TouchableOpacity>)}</View>
              {windowIssue(slots, index) && <Text accessibilityRole="alert" style={styles.problem}>{windowIssue(slots, index)}</Text>}
              <TouchableOpacity accessibilityRole="button" accessibilityLabel={`Remove ${day} window ${index + 1}`} disabled={locked}
                onPress={() => changeSlots(slots.filter((_, slotIndex) => slotIndex !== index))} style={styles.remove}><Text style={styles.problem}>Remove window</Text></TouchableOpacity>
            </View>)}
            {daySlots.length > 0 && <Button label="Copy hours to other days" secondary disabled={locked || daySlots.some(({ index }) => !!windowIssue(slots, index))}
              onPress={() => { setCopySource(dayIndex + 1); setCopyTargets([]); }} />}
          </View>;
        })}
        <Text style={ui.text}>Saving replaces your previous weekly schedule.</Text>
      </>}
    </ScrollView>
    {!loading && !loadError && <View style={styles.saveBar}>
      <Text style={ui.text}>{sports.length} sports · {slots.length} weekly windows{dirty ? ' · Unsaved changes' : ''}</Text>
      {validation && <Text style={styles.problem}>{validation}</Text>}
      {saveError && <ErrorNotice message={saveError} />}
      <Button label={saving ? 'Saving schedule...' : 'Save & find my games'} onPress={save} disabled={locked || !!validation} busy={saving} />
    </View>}
    <Modal visible={editing !== null} transparent animationType={reduceMotion ? 'none' : 'slide'} onRequestClose={() => setEditing(null)}>
      <View style={styles.overlay}><View style={styles.sheet}>
        <Text style={ui.heading}>Choose {editing?.field === 'start_time' ? 'start' : 'end'} time</Text>
        <Text style={ui.text}>Conflicting times are disabled.</Text>
        <ScrollView contentContainerStyle={{ gap: 8, paddingVertical: 16 }}>
          {Array.from({ length: 24 }, (_, hour) => hour + (editing?.field === 'end_time' ? 1 : 0)).map(hour => {
            const time = hourTime(hour);
            const candidate = slots.map((slot, index) => editing && index === editing.index ? { ...slot, [editing.field]: time } : slot);
            const allowed = !!editing && !windowIssue(candidate, editing.index);
            return <Button key={hour} label={timeLabel(time)} secondary disabled={!allowed} onPress={() => { changeSlots(candidate); setEditing(null); }} />;
          })}
        </ScrollView><Button label="Cancel" secondary onPress={() => setEditing(null)} />
      </View></View>
    </Modal>
    <Modal visible={copySource !== null} transparent animationType={reduceMotion ? 'none' : 'slide'} onRequestClose={() => setCopySource(null)}>
      <View style={styles.overlay}><View style={styles.sheet}>
        <Text style={ui.heading}>Copy {DAYS[(copySource ?? 1) - 1]} hours</Text>
        <Text style={ui.text}>This replaces all windows on the days you select.</Text>
        <ScrollView contentContainerStyle={{ gap: 8, paddingVertical: 16 }}>{DAYS.map((day, index) => index + 1 !== copySource &&
          <TouchableOpacity key={day} accessibilityRole="checkbox" accessibilityState={{ checked: copyTargets.includes(index + 1) }} style={styles.sport}
            onPress={() => setCopyTargets(copyTargets.includes(index + 1) ? copyTargets.filter(value => value !== index + 1) : [...copyTargets, index + 1])}>
            <Text style={styles.sportText}>{day}</Text><Text style={styles.link}>{copyTargets.includes(index + 1) ? 'Selected' : 'Select'}</Text>
          </TouchableOpacity>)}</ScrollView>
        <Button label="Apply to selected days" disabled={!copyTargets.length} onPress={() => { if (copySource) changeSlots(copyDay(slots, copySource, copyTargets)); setCopySource(null); }} />
        <Button label="Cancel" secondary onPress={() => setCopySource(null)} />
      </View></View>
    </Modal>
  </View>;
}
const createStyles = (colors: Palette) => StyleSheet.create({
  sport: { padding: 18, minHeight: 60, borderWidth: 1, borderColor: colors.line, borderRadius: 16, backgroundColor: colors.surface, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 },
  selected: { backgroundColor: colors.pale, borderColor: colors.green },
  sportText: { fontSize: 17, fontWeight: '700', color: colors.ink, flexShrink: 1 },
  day: { fontSize: 18, fontWeight: '700', color: colors.ink },
  add: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 8 },
  link: { color: colors.green, fontWeight: '700', fontSize: 15 },
  window: { borderTopWidth: 1, borderColor: colors.line, paddingTop: 14, gap: 4 },
  times: { flexDirection: 'row', gap: 12 },
  time: { flex: 1, backgroundColor: colors.paper, padding: 12, borderRadius: 12, gap: 6 },
  caption: { fontSize: 11, letterSpacing: 1, color: colors.muted, fontWeight: '700' },
  timeText: { fontSize: 16, color: colors.ink, fontWeight: '700' },
  remove: { alignSelf: 'flex-start', minHeight: 44, justifyContent: 'center' },
  problem: { color: colors.errorText, fontSize: 14, lineHeight: 20 },
  saveBar: { padding: 16, gap: 8, backgroundColor: colors.surface, borderTopWidth: 1, borderColor: colors.line },
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: '#0008' },
  sheet: { maxHeight: '80%', padding: 24, paddingBottom: 36, backgroundColor: colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, gap: 10 },
});
