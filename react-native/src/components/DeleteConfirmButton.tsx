import { useState } from 'react'
import { ConfirmModal } from './ConfirmModal'
import { TrashButton } from './TrashButton'

type Props = {
  title: string
  message: string
  onConfirm: () => void
}

export function DeleteConfirmButton({ title, message, onConfirm }: Props) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <TrashButton onPress={() => setOpen(true)} />
      <ConfirmModal
        visible={open}
        title={title}
        message={message}
        onCancel={() => setOpen(false)}
        onConfirm={() => {
          setOpen(false)
          onConfirm()
        }}
      />
    </>
  )
}
