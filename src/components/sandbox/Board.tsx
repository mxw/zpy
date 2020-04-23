import * as React from "react"

import * as Eng from "lib/sandbox/engine.ts"
import * as P from "protocol/protocol.ts"

import { Card } from "components/Card.tsx"
import { Client, State } from "components/sandbox/game.ts"

type BoardCardProps = {
  client: Client,
  c: Eng.Card,
  held: boolean
}

type Point = {
  x: number,
  y: number
};

type BoardCardState = {
  dragPos: Point,
  dragOffset: Point,
  dragStarted: boolean,
  dragTimer: null | ReturnType<typeof setTimeout>,
  resyncPosTimer: null | ReturnType<typeof setTimeout>,
};

export class BoardCard extends React.Component<BoardCardProps, BoardCardState> {
  constructor(props: BoardCardProps) {
    super(props)

    this.state = {
      dragPos: {x: props.c.x, y: props.c.y},
      dragOffset: {x: 0, y: 0},
      dragStarted: false,
      dragTimer: null,
      resyncPosTimer: null,
    };
  }

  render() {
    let {c, held, client} = this.props

    let x = held ? this.state.dragPos.x : c.x;
    let y = held ? this.state.dragPos.y : c.y;

    let resyncPos = () => {
      return setTimeout(() => {
        if (this.props.held) {
          this.props.client.attempt({
            verb: 'move',
            target: c.id,
            x: this.state.dragPos.x,
            y: this.state.dragPos.y,
          });
          this.setState({
            resyncPosTimer: resyncPos(),
          });
        }
      }, 300);
    }

    return (
      <Card
      card={c.card}
      width={100}
      x={x}
      y={y}
      position={"absolute"}
      onMouseDown={(ev: MouseEvent) => {
        (ev as any as {foo: number}).foo = 42;
        if (!this.state.dragStarted) {
          this.setState({
            dragStarted: true,
            dragOffset: {
              x: ev.clientX - this.props.c.x,
              y: ev.clientY - this.props.c.y,
            },
            dragPos: {
              x: c.x,
              y: c.y
            },
            resyncPosTimer: resyncPos(),
            dragTimer: setTimeout(() => {
              client.attempt({
                verb: 'grab',
                target: c.id
              });
            }, 200),
          });
        }
      }}

      onMouseMove={(ev: MouseEvent) => {
        if (this.props.held) {
          this.setState({
            dragPos: {
              x: ev.clientX - this.state.dragOffset.x,
              y: ev.clientY - this.state.dragOffset.y
            }
          });
        }
      }}

      onMouseLeave={(ev: MouseEvent) => {
        if (this.props.held) {
          client.attempt({
            verb: 'move',
            target: c.id,
            x: this.state.dragPos.x,
            y: this.state.dragPos.y,
          })
          client.attempt({
            verb: 'drop',
            target: c.id
          });
        } else if (this.state.dragTimer !== null) {
          clearTimeout(this.state.dragTimer);
          this.setState({dragTimer: null,
                         dragStarted: false,
                         resyncPosTimer: null});
        }
      }}

      onMouseUp={(ev: MouseEvent) => {
        if (this.props.held) {
          client.attempt({
            verb: 'move',
            target: c.id,
            x: this.state.dragPos.x,
            y: this.state.dragPos.y,
          })
          client.attempt({
            verb: 'drop',
            target: c.id
          });
        } else {
          clearTimeout(this.state.dragTimer);
          this.setState({dragTimer: null, resyncPosTimer: null, dragStarted: false});
        }
      }}
      />);
  }
}


export class Board extends React.Component<{client: Client, state: State}, {}> {
  render() {
    let me = this.props.client.me;

    return <div style={{position: "relative"}}
    onMouseDown={(ev) => console.log(ev)}>
      {
        this.props.state.cards.map((card: Eng.Card) =>  {
          return <BoardCard
                   client={this.props.client}
                   key={card.id}
                   c={card}
                   held={card.holder === me.id} />
        })
      }
    </div>
  }
}

