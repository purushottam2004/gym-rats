import { Text, type StyleProp, type TextStyle } from 'react-native'
import { ordinalSuffix } from '../lib/ordinal'

type Props = {
  value: number
  style?: StyleProp<TextStyle>
  suffixStyle?: StyleProp<TextStyle>
}

/** Renders `1ˢᵗ`-style ordinals with the suffix as a raised (superscript) run. */
export function OrdinalNumber({ value, style, suffixStyle }: Props) {
  return (
    <Text style={style}>
      {value}
      <Text style={[{ fontSize: 11, lineHeight: 14 }, suffixStyle]}>{ordinalSuffix(value)}</Text>
    </Text>
  )
}
