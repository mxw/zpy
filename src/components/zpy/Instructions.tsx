/*
 * interactive play portion of the ZPY board
 */
import * as React from 'react'

import * as P from 'protocol/protocol.ts'

import { ZPY } from 'lib/zpy/zpy.ts'
import * as ZPYEngine from 'lib/zpy/engine.ts'

import { plural } from 'utils/string.ts'

import assert from 'utils/assert.ts'


export class Instructions extends React.Component<Instructions.Props, {}> {
  constructor(props: Instructions.Props) {
    super(props);
  }

  render() {
    const me = this.props.me.id;
    const zpy = this.props.zpy;

    const enter = <kbd>↵ Enter</kbd>;

    const is_active = (() => {
      switch (this.props.phase) {
        case ZPY.Phase.INIT: return (
          me === zpy.owner &&
          zpy.players.length >= ZPY.min_players
        );
        case ZPY.Phase.DRAW: return true;
        case ZPY.Phase.PREPARE: return !zpy.consensus.has(me);
        case ZPY.Phase.KITTY: return me === zpy.host;
        case ZPY.Phase.FRIEND: return me === zpy.host;
        case ZPY.Phase.LEAD: return me === zpy.leader;
        case ZPY.Phase.FLY: return !zpy.consensus.has(me);
        case ZPY.Phase.FOLLOW: return zpy.cur_idx !== null
          ? me === zpy.current()
          : me === zpy.winning;
        case ZPY.Phase.FINISH: return me === zpy.host;
        case ZPY.Phase.WAIT: return me === zpy.host
          ? zpy.has_consensus()
          : !zpy.consensus.has(me) ;
      }
      assert(false);
      return false;
    })();

    if (!is_active) {
      const text = (() => {
        switch (this.props.phase) {
          case ZPY.Phase.INIT: return me === zpy.owner
            ? <>
                gather at least {ZPY.min_players} players.
                you can set game options with the buttons above.
              </>
            : <>waiting for the game to start</>;
          case ZPY.Phase.DRAW:
            return null;
          case ZPY.Phase.PREPARE:
            return <>waiting for everyone to be ready</>;
          case ZPY.Phase.KITTY:
            return <>waiting for the host to discard a kitty</>;
          case ZPY.Phase.FRIEND:
            return <>waiting for the host to call friends</>;
          case ZPY.Phase.LEAD:
            return <>waiting for the trick leader to play</>;
          case ZPY.Phase.FLY:
            return <>waiting on others to see if the play flies</>;
          case ZPY.Phase.FOLLOW: return zpy.cur_idx !== null
            ? <>
                waiting for the next player to play.
                you can stage your play above while you wait.
              </>
            : <>waiting for the winner to collect the trick</>;
          case ZPY.Phase.FINISH:
            return <>waiting for the host to end the round</>;
          case ZPY.Phase.WAIT: return me === zpy.host
            ? <>waiting for everyone else to be ready</>
            : <>waiting for the host to start the round</>;
        }
        return null;
      })();
      return <div className="instructions inactive">{text}</div>;
    }

    const text = (() => {
      switch (this.props.phase) {
        case ZPY.Phase.INIT:
          return <>press {enter} to start the game</>;
        case ZPY.Phase.DRAW:
          return <>
            click the deck to draw;
            drag cards above and press {enter} to submit a trump bid
          </>;
        case ZPY.Phase.PREPARE:
          return <>
            press {enter} to indicate you are ready,
            or drag cards above first to submit a trump bid.
          </>;
        case ZPY.Phase.KITTY:
          return <>
            take the kitty above, then put back that many cards
            ({zpy.kitty.length} total) and press {enter} to submit
          </>;
        case ZPY.Phase.FRIEND:
          return <>
            select {zpy.nfriends} friend{plural(zpy.nfriends)} and
            press {enter} to submit
          </>;
        case ZPY.Phase.LEAD:
          return <>
            drag cards above and press {enter} to submit your lead
          </>;
        case ZPY.Phase.FLY:
          return <>
            press {enter} if the play flies;
            or drag a card, tuple, or tractor above
            and press {enter} to contest the play
          </>;
        case ZPY.Phase.FOLLOW: return zpy.cur_idx !== null
          ? <>
              drag cards above and press {enter} to submit your play
            </>
          : <>you won the trick; press {enter} to collect it</>;
        case ZPY.Phase.FINISH:
          return <>press {enter} to end the round</>;
        case ZPY.Phase.WAIT: return me === zpy.host
          ? <>press {enter} to start the next round</>
          : <>press {enter} to indicate you are ready for the next round</>;
      }
      return null;
    })();
    if (text === null) return null;

    return <div className="instructions active">{text}</div>;
  }
}

export namespace Instructions {

export type Props = {
  me: P.User;
  phase: ZPY.Phase;
  zpy: ZPYEngine.ClientState;
};

}
