/*
 * interactive play portion of the ZPY board
 */
import * as React from 'react'

import { ZPY } from 'lib/zpy/zpy.ts'
import * as ZPYEngine from 'lib/zpy/engine.ts'

import { range } from 'utils/iterable.ts'

import assert from 'utils/assert.ts'


export class ConfigArea extends React.Component<ConfigArea.Props, {}> {
  constructor(props: ConfigArea.Props) {
    super(props);
  }

  renderOption<K extends ConfigArea.Key>(
    label: any,
    key: K,
    val: ConfigArea.T[K],
    tooltip?: string,
    tooltip_props?: Record<string, any>,
  ) {
    const classes = [key as string];
    if (val === this.props.config[key]) classes.push('selected');

    if (tooltip) {
      return <div
        key={'' + val}
        className={classes.join(' ')}
        aria-label={tooltip}
        data-balloon-pos="up"
        onClick={ev => this.props.onChange(key, val)}
        {...tooltip_props}
      >
        {label}
      </div>;
    }

    return <div
      key={'' + val}
      className={classes.join(' ')}
      onClick={ev => this.props.onChange(key, val)}
    >
      {label}
    </div>;
  }

  render() {
    const pr = this.props;

    return <div className="config-container">
      game settings
      <div className="config">
        <label className="ndecks">
          <div># decks</div>
          <div className="config-options">
            {[...range(
              ZPY.min_ndecks(pr.nplayers),
              ZPY.max_ndecks(pr.nplayers) + 1,
            )].map(
              i => this.renderOption(i, 'ndecks', i)
            )}
          </div>
        </label>
        <label className="hidden-info">
          <div>hidden info</div>
          <div className="config-options">
            {this.renderOption(
              'visible', 'info', ZPY.HiddenInfoRule.VISIBLE,
              'all public information is visible',
            )}
            {this.renderOption(
              'hide pts', 'info', ZPY.HiddenInfoRule.HIDE_PTS,
              'hide host team\'s points',
            )}
            {this.renderOption(
              'hide play', 'info', ZPY.HiddenInfoRule.HIDE_PLAY,
              'hide play history from the game log',
            )}
            {this.renderOption(
              'hide all', 'info', ZPY.HiddenInfoRule.HIDE_ALL,
              'hide host team points and play history',
            )}
          </div>
        </label>
        <label className="rank-skip">
          <div>rank up</div>
          <div className="config-options">
            {this.renderOption(
              'host once', 'rank', ZPY.RankSkipRule.HOST_ONCE,
              'must host 5,10,J,K once before ranking past',
            )}
            {this.renderOption(
              'no skip', 'rank', ZPY.RankSkipRule.NO_SKIP,
              'must pause at 5,10,J,K before ranking past (no skipping)',
            )}
            {this.renderOption(
              'no pass', 'rank', ZPY.RankSkipRule.NO_PASS,
              'can only rank up past 5,10,J,K by winning as host',
            )}
            {this.renderOption(
              'no rule', 'rank', ZPY.RankSkipRule.NO_RULE,
              'no rank up restrictions',
            )}
          </div>
        </label>
        <label className="hook">
          <div>hook</div>
          <div className="config-options">
            {this.renderOption(
              'j-hook', 'hook', ZPY.JackHookRule.WIN_HOOK,
              'attacking team hooks host team to 2 if they win a J round ' +
              'with an on-suit J (or halfway with an off-suit J)',
              {'data-balloon-length': 'large'},
            )}
            {this.renderOption(
              'no hook', 'hook', ZPY.JackHookRule.NO_HOOK,
              'no special rules for J rounds',
            )}
          </div>
        </label>
        <label className="kitty-mult">
          <div>kitty</div>
          <div className="config-options">
            {this.renderOption(
              <>2<sup><i>n</i></sup></>,
              'kitty', ZPY.KittyMultiplierRule.EXP,
              'multiply kitty points by 2 to the power of ' +
              'the size of the biggest tractor/tuple in the ' +
              'attacking team\'s winning play',
              {'data-balloon-length': 'large'},
            )}
            {this.renderOption(
              <>2<i>n</i></>,
              'kitty', ZPY.KittyMultiplierRule.MULT,
              'multiply kitty points by twice the size of the ' +
              'attacking team\'s winning play',
              {'data-balloon-length': 'large'},
            )}
          </div>
        </label>
      </div>
    </div>;
  }
}

export namespace ConfigArea {

export type T = ZPYEngine.Config & {ndecks: number};
export type Key = keyof T;

export type Props = {
  nplayers: number;
  config: T;

  onChange: (key: Key, val: any) => void;
};

}
