import React, {Component} from 'react';
import {View} from 'react-native';
import {styles} from '../appStyles';

const BARCODE_BARS = [
  {width: 3, gap: 2},
  {width: 2, gap: 3},
  {width: 4, gap: 2},
  {width: 2, gap: 2},
  {width: 3, gap: 3},
  {width: 2, gap: 2},
  {width: 4, gap: 0},
] as const;

export class BarcodeIcon extends Component {
  render() {
    return (
      <View style={styles.barcodeIcon}>
        {BARCODE_BARS.map((bar, index) => (
          <React.Fragment key={index}>
            <View style={[styles.barcodeBar, {width: bar.width}]} />
            {index < BARCODE_BARS.length - 1 ? <View style={{width: bar.gap}} /> : null}
          </React.Fragment>
        ))}
      </View>
    );
  }
}
