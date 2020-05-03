/*
 * modal dialog for revealing previously hidden game state
 *
 * used for no-bid kitty reveals and successful fly contests
 */
import * as React from 'react'

import * as P from 'protocol/protocol.ts'

import { CardBase, Suit } from 'lib/zpy/cards.ts'
import { Tractor } from 'lib/zpy/trick.ts'
import { ZPY } from 'lib/zpy/zpy.ts'
import * as ZPYEngine from 'lib/zpy/engine.ts'

import { Client } from 'components/zpy/common.ts'
import { Card } from 'components/zpy/Card.tsx'

import assert from 'utils/assert.ts'


export const card_width = 100;
const clip_pct = 0.25 * 1.5;

export class Reveal extends React.Component<Reveal.Props, {}> {
  constructor(props: Reveal.Props) {
    super(props);
  }

  renderRevealKitty(kitty: CardBase[]) {
    const zpy = this.props.client.state;
    const [card, rank] = zpy.reveal_highest(kitty);

    const suitname = Suit[card.suit].toLowerCase();

    return <>
      <div className="reveal-desc">
        flipped the kitty and
        set <span className={suitname}>{zpy.tr.toString()}</span> as trump
      </div>
      <div className="reveal-cards">
        {kitty.map((cb, i) =>
          <Card
            key={'' + i}
            card={cb}
            width={card_width}
            xclip={clip_pct}
            selected={CardBase.same(cb, card)}
          />
        )}
      </div>
    </>;
  }

  renderRejectFly(
    player: P.UserID,
    reveal: CardBase[],
    tractor: Tractor,
  ) {
    const users = Object.fromEntries(
      this.props.client.users.map(u => [u.id, u])
    );
    const zpy = this.props.client.state;

    return <>
      <div className="reveal-desc">
        <b>{users[player].nick}</b> says
        that <b>{users[zpy.leader].nick}</b>'s play doesn't fly:
      </div>
      <div className="reveal-multi">
        <div className="reveal-cards">
          {reveal.map((cb, i) =>
            <Card
              key={'' + i}
              card={cb}
              width={card_width}
              xclip={clip_pct}
            />
          )}
        </div>
        <div style={{
          paddingLeft: "1rem",
          paddingRight: "1rem",
        }}>
          beats
        </div>
        <div className="reveal-cards">
          {[...tractor.gen_cards(zpy.tr)].map((cb, i) =>
            <Card
              key={'' + i}
              card={cb}
              width={card_width}
              xclip={clip_pct}
            />
          )}
        </div>
      </div>
    </>;
  }

  renderFinish(
    prev_host: P.UserID,
    kitty: CardBase[],
  ) {
    const users = Object.fromEntries(
      this.props.client.users.map(u => [u.id, u])
    );
    const zpy = this.props.client.state;
    const {
      kitty_points,
      atk_points,
      delta,
      winner
    } = zpy.compute_round_outcome(kitty);

    const points_reveal = (() => {
      if (kitty_points === null) {
        return <div className="reveal-desc">
          attacking team got {atk_points} points
        </div>
      }
      return <>
        <div className="reveal-desc">
          attacking team got {atk_points} points,
          including {kitty_points} from the kitty:
        </div>
        <div className="reveal-cards">
          {kitty.map((cb, i) =>
            <Card
              key={'' + i}
              card={cb}
              width={card_width}
              xclip={clip_pct}
            />
          )}
        </div>
      </>;
    })();

    const rank_txt = delta !== 0 ? ` and ascends ${delta} ranks` : '';

    return <>
      {points_reveal}
      <div className="reveal-desc">
        <b>{winner}</b> team won{rank_txt}!
      </div>
      <div className="reveal-desc">
        <b>{users[zpy.host].nick}</b> is the next host
      </div>
    </>
  }

  render() {
    const effect = this.props.effect;
    if (effect === null) return null;

    const inner = (() => {
      switch (effect.kind) {
        case 'install_host':
          return this.renderRevealKitty(effect.args[1]);
        case 'reject_fly':
          return this.renderRejectFly(...effect.args);
        case 'finish':
          return this.renderFinish(...effect.args);
        default: break;
      }
      return null;
    })();
    assert(inner !== null, 'invalid Reveal effect', effect);

    return <div className="reveal">{inner}</div>;
  }
}

export namespace Reveal {

export type Props = {
  effect: null | ZPYEngine.Effect;
  client: Client;
};

}
