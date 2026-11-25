import { useState } from 'react'
import { Modal, Pressable, Text, View } from 'react-native'
import { logSet } from '../lib/gym'
import { type SetAttempt } from '../lib/nextSetAttempt'
import { AppTextInput } from './AppTextInput'
import { screen } from './screenStyles'

const SET_NUMBERS = [1, 2, 3, 4, 5] as const

type Props = {
  visible: boolean
  liftId: string
  liftName: string
  day: string
  /** Prefill for set number (e.g. next unused attempt). Remount to refresh. */
  initialAttempt?: SetAttempt
  onSaved: () => void
  onCancel: () => void
}

export function AddSetModal({
  visible,
  liftId,
  liftName,
  day,
  initialAttempt = 1,
  onSaved,
  onCancel,
}: Props) {
  const [setNumber, setSetNumber] = useState<SetAttempt>(initialAttempt)
  const [reps, setReps] = useState('')
  const [loadKg, setLoadKg] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function save() {
    const repsValue = Number(reps)
    const loadValue = Number(loadKg)
    if (!liftId || !day) {
      setError('Pick a lift and day first')
      return
    }
    if (!Number.isInteger(repsValue) || repsValue < 1) {
      setError('Reps are a whole number, 1 or more')
      return
    }
    if (!(loadValue >= 0)) {
      setError('Kilograms cannot be negative')
      return
    }
    setBusy(true)
    try {
      await logSet({ liftId, day, attempt: setNumber, reps: repsValue, loadKg: loadValue })
      onSaved()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal animationType="fade" transparent visible={visible} onRequestClose={onCancel}>
      <View style={screen.modalBackdrop}>
        <View style={screen.confirmCard}>
          <Text style={screen.sectionTitle}>Add a set</Text>
          <Text style={screen.body}>{liftName}</Text>
          <Text style={screen.label}>Set Number</Text>
          <View style={screen.setNumberRow}>
            {SET_NUMBERS.map((n) => {
              const selected = setNumber === n
              return (
                <Pressable
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                  disabled={busy}
                  key={n}
                  onPress={() => setSetNumber(n)}
                  style={({ pressed }) => [
                    screen.setNumberCircle,
                    selected && screen.setNumberCircleSelected,
                    pressed && !selected && screen.setNumberCirclePressed,
                  ]}
                >
                  <Text style={[screen.setNumberCircleText, selected && screen.setNumberCircleTextSelected]}>
                    {n}
                  </Text>
                </Pressable>
              )
            })}
          </View>
          <Text style={screen.label}>Reps</Text>
          <AppTextInput
            editable={!busy}
            keyboardType="number-pad"
            onChangeText={setReps}
            placeholder="Reps"
            style={screen.input}
            value={reps}
          />
          <Text style={screen.label}>Kilograms</Text>
          <AppTextInput
            editable={!busy}
            keyboardType="decimal-pad"
            onChangeText={setLoadKg}
            placeholder="kg"
            style={screen.input}
            value={loadKg}
          />
          {error ? <Text style={screen.error}>{error}</Text> : null}
          <View style={screen.confirmActions}>
            <Pressable
              accessibilityRole="button"
              disabled={busy}
              onPress={onCancel}
              style={({ pressed }) => [screen.confirmCancel, pressed && screen.rowPressed]}
            >
              <Text style={screen.secondaryButtonText}>Cancel</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              disabled={busy}
              onPress={() => void save()}
              style={({ pressed }) => [
                screen.confirmPrimary,
                busy && screen.buttonDisabled,
                pressed && screen.rowPressed,
              ]}
            >
              <Text style={screen.confirmPrimaryText}>Save</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  )
}
