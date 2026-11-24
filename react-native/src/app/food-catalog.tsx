import { useFocusEffect, useRouter } from 'expo-router'
import { useCallback, useState } from 'react'
import { Pressable, Text, View } from 'react-native'
import { ConfirmModal } from '../components/ConfirmModal'
import { InfoButton } from '../components/InfoButton'
import { InfoListModal, type InfoListRow } from '../components/InfoListModal'
import { Screen } from '../components/Screen'
import { Toast, type ToastKind } from '../components/Toast'
import { TrashButton } from '../components/TrashButton'
import { screen } from '../components/screenStyles'
import { isFoodInUseError } from '../lib/foodDelete'
import { deleteFood, loadFoods, measureLabel, type Food } from '../lib/gym'
import {
  foodBasisLabel,
  foodTypeNutrition,
  formatNutrientTotal,
} from '../lib/nutrition'

export default function FoodCatalogScreen() {
  const router = useRouter()
  const [foods, setFoods] = useState<Food[]>([])
  const [error, setError] = useState<string | null>(null)
  const [infoModal, setInfoModal] = useState<{
    title: string
    subtitle?: string
    rows: InfoListRow[]
  } | null>(null)
  const [pendingDelete, setPendingDelete] = useState<Food | null>(null)
  const [toast, setToast] = useState<{ kind: ToastKind; message: string } | null>(null)

  const load = useCallback(async () => {
    try {
      setFoods(await loadFoods())
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load foods')
    }
  }, [])

  useFocusEffect(
    useCallback(() => {
      void load()
    }, [load]),
  )

  function showFoodInfo(food: Food) {
    const lines = foodTypeNutrition(food)
    setInfoModal({
      title: food.name,
      subtitle: foodBasisLabel(food.measure, food.basis),
      rows: lines.map((line) => ({
        key: line.id,
        label: line.name,
        value: `${formatNutrientTotal(line.total)} ${line.unit}`,
      })),
    })
  }

  async function confirmDelete() {
    const food = pendingDelete
    setPendingDelete(null)
    if (!food) return
    try {
      await deleteFood(food.id)
      await load()
      setToast({ kind: 'success', message: 'Deleted' })
    } catch (err) {
      if (isFoodInUseError(err)) {
        setToast({ kind: 'error', message: 'Can not delete, first delete all uses' })
      } else {
        setToast({
          kind: 'error',
          message: err instanceof Error ? err.message : 'Could not delete food',
        })
      }
    }
  }

  return (
    <View style={{ flex: 1 }}>
      <Screen>
        <Text style={screen.title}>Food Catalog</Text>
        {error ? <Text style={screen.error}>{error}</Text> : null}
        <View style={screen.card}>
          {foods.length > 0 ? (
            foods.map((food, index) => (
              <View key={food.id} style={[screen.row, index === 0 && screen.rowFirst]}>
                <View style={screen.rowMain}>
                  <Text style={screen.rowTitle}>{food.name}</Text>
                  <Text style={screen.muted}>{measureLabel(food.measure)}</Text>
                </View>
                <View style={screen.choiceTrail}>
                  <TrashButton onPress={() => setPendingDelete(food)} />
                  <InfoButton onPress={() => showFoodInfo(food)} />
                </View>
              </View>
            ))
          ) : (
            <View style={[screen.row, screen.rowFirst]}>
              <Text style={screen.muted}>No foods in your catalog yet.</Text>
            </View>
          )}
        </View>
        <View style={screen.section}>
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push('/new-food')}
            style={screen.save}
          >
            <Text style={screen.buttonText}>Add New Food</Text>
          </Pressable>
        </View>
      </Screen>
      <InfoListModal
        visible={infoModal !== null}
        title={infoModal?.title ?? ''}
        subtitle={infoModal?.subtitle}
        rows={infoModal?.rows ?? []}
        emptyMessage="No nutrients defined for this food."
        onClose={() => setInfoModal(null)}
      />
      <ConfirmModal
        visible={pendingDelete !== null}
        title="Delete food?"
        message={
          pendingDelete
            ? `Remove ${pendingDelete.name} from your catalog?`
            : ''
        }
        onCancel={() => setPendingDelete(null)}
        onConfirm={() => void confirmDelete()}
      />
      <Toast
        visible={toast !== null}
        kind={toast?.kind ?? 'success'}
        message={toast?.message ?? ''}
        onHide={() => setToast(null)}
      />
    </View>
  )
}
