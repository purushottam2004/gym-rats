import { StyleSheet } from 'react-native'

export const screen = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: '#f5f5f4',
    padding: 16,
    gap: 12,
  },
  safe: {
    flex: 1,
    backgroundColor: '#f5f5f4',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    gap: 12,
    flexGrow: 1,
    paddingBottom: 24,
  },
  centered: {
    flex: 1,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: '600',
    color: '#111827',
  },
  body: {
    fontSize: 16,
    color: '#4b5563',
  },
  label: {
    fontSize: 14,
    color: '#374151',
  },
  input: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    color: '#111827',
  },
  button: {
    backgroundColor: '#111827',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryButton: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: 'center',
  },
  leave: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: 'center',
  },
  leaveText: {
    color: '#e5484d',
    fontSize: 17,
    fontWeight: '600',
  },
  youLabel: {
    fontSize: 15,
    color: '#9a3412',
    fontWeight: '600',
  },
  groupBlock: {
    gap: 12,
  },
  rowMain: {
    flex: 1,
  },
  secondaryButtonText: {
    color: '#111827',
    fontSize: 16,
    fontWeight: '600',
  },
  error: {
    color: '#e5484d',
    fontSize: 14,
  },
  result: {
    backgroundColor: '#f4f4f5',
    borderRadius: 8,
    padding: 12,
    fontSize: 13,
    color: '#111827',
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    overflow: 'hidden',
  },
  row: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: '#f0eeeb',
  },
  rowFirst: {
    borderTopWidth: 0,
  },
  rowSelected: {
    backgroundColor: '#fff7ed',
  },
  rowPressed: {
    backgroundColor: '#fafaf9',
  },
  rowSelectedPressed: {
    backgroundColor: '#ffedd5',
  },
  rowTitle: {
    fontSize: 17,
    color: '#1c1917',
    fontWeight: '600',
  },
  rowTitleSelected: {
    color: '#9a3412',
  },
  choiceTrail: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  rowMeta: {
    fontSize: 17,
    color: '#1c1917',
    fontWeight: '600',
  },
  muted: {
    fontSize: 15,
    color: '#78716c',
  },
  add: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: '#f0eeeb',
  },
  addCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  addText: {
    color: '#c2410c',
    fontSize: 17,
    fontWeight: '600',
  },
  save: {
    backgroundColor: '#1c1917',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  codeCard: {
    backgroundColor: '#1c1917',
    borderRadius: 16,
    padding: 18,
    gap: 8,
  },
  codeValue: {
    color: '#fafaf9',
    fontSize: 40,
    fontWeight: '700',
    letterSpacing: 3,
  },
  dayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  section: {
    marginTop: 12,
    gap: 12,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#111827',
  },
})
