import { Text, type StyleProp, type TextStyle } from 'react-native'
import { ordinalSuffix } from '../lib/ordinal'

type Props = {
  value: number
  style?: StyleProp<TextStyle>
  suffixStyle?: StyleProp<TextStyle>
}

/** Renders `1ˢᵗ]` with the ordinal suffix raised as a superscript, then `]`. */
export function OrdinalNumber({ value, style, suffixStyle }: Props) {
  return (
    <Text style={style}>
      {value}
      <Text
        style={[
          {
            fontSize: 10,
            lineHeight: 12,
            position: 'relative',
            top: -6,
          },
          suffixStyle,
        ]}
      >
        {ordinalSuffix(value)}
      </Text>
      ]
    </Text>
  )
}
