/*
 * interactive play portion of the ZPY board
 */
import * as React from 'react'

import { CardBase, TrumpMeta } from 'lib/zpy/cards.ts'
import { ZPY } from 'lib/zpy/zpy.ts'

import { CardID, dims } from 'components/zpy/common.ts'
import { CardImage } from 'components/zpy/CardImage.tsx'
import { CardArea, EmptyArea } from 'components/zpy/CardArea.tsx'

import { strict as assert} from 'assert'


export class RoundState extends React.Component<
  RoundState.Props,
  RoundState.State
> {
  constructor(props: RoundState.Props) {
    super(props);
  }

  render() {
    return <div className="round">
    </div>;
  }
}

export namespace RoundState {

export type Props = {
};

export type State = {
};

}
