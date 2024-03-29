/*
 * help hovercard
 */
import * as React from 'react'

import { isMac } from 'components/utils/platform'

import assert from 'utils/assert'


export function Help(props: {}) {
  const pointer = <img
    className="help-pointer-icon"
    src="/static/png/icons/backhand-index-pointing-up.png"
  />;

  const cmd = <kbd>{isMac() ? 'cmd' : 'ctrl'}</kbd>;
  const shift = <kbd>shift</kbd>;
  const enter = <kbd>↵ Enter</kbd>;

  return <div className="help-wrapper" tabIndex={-1}>
    <div className="help-icon-wrapper">
      <img
        className="help-icon"
        src="/static/png/icons/white-question-mark.png"
      />
    </div>
    <div className="help-info">
      <h2>halp!</h2>
      <p>
        this is a help section! it's very helpful.
      </p>

      <h3>changing your name</h3>
      <p>
        double-click your nickname to edit it.
        (your player icon is the one with food.)
      </p>
      <p>
        you can also change your current rank by double-clicking it, if your
        group wants to continue a previous game or skip certain ranks.
        (use <b>J</b> for jack and <b>W</b> for joker.)
      </p>

      <h3>playing cards</h3>
      <p>
        click or drag and drop cards to move them between your hand and the
        play area.
      </p>

      <div className="help-shortcuts">
        <div className="help-key">{pointer}</div>
        <div>teleport cards b/w hand and play area</div>

        <div className="help-key">{cmd}+{pointer}</div>
        <div>select/deselect cards</div>

        <div className="help-key">{shift}+{pointer}</div>
        <div>select range of cards</div>

        <div className="help-key">{enter}</div>
        <div>submit a play or confirm a prompt</div>

        <div className="help-key">{cmd}+<kbd>z</kbd></div>
        <div>undo a play</div>
      </div>

      <h3>keyboard shortcuts</h3>
      <div className="help-shortcuts">
        <div className="help-key">{cmd}+<kbd>a</kbd></div>
        <div>select <u>a</u>ll cards</div>

        <div className="help-key">{shift}+<kbd>s</kbd></div>
        <div><u>s</u>ort hand</div>

        <div className="help-key">{shift}+<kbd>r</kbd></div>
        <div><u>r</u>eset all cards back to your hand</div>
      </div>

      <h3>credits</h3>
      <p>
        made with love
        by <a href="https://github.com/mxw">https://github.com/mxw</a>
      </p>
      <p>
        emoji set from facebook messenger
      </p>
    </div>
  </div>;
}
