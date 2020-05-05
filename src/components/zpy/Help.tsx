/*
 * help hovercard
 */
import * as React from 'react'

import { isWindows } from 'components/utils/platform.ts'

import assert from 'utils/assert.ts'


export function Help(props: {}) {
  const pointer = <img
    className="help-pointer-icon"
    src="/static/png/icons/backhand-index-pointing-up.png"
  />;

  const cmd = <kbd>{isWindows() ? 'ctrl' : 'cmd'}</kbd>;
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
      made with love
      by <a href="https://github.com/mxw">https://github.com/mxw</a>
    </div>
  </div>;
}
