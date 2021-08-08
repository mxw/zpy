/*
 * self-resizing editable text box
 */
import * as React from 'react'

import { isMac } from 'components/utils/platform'

import * as options from 'options'
import assert from 'utils/assert'


export class Editable extends React.Component<Editable.Props, Editable.State> {
  parent: HTMLDivElement;
  sizer: HTMLDivElement;

  constructor(props: Editable.Props) {
    super(props);

    this.onClickOut = this.onClickOut.bind(this);
    this.onDblClick = this.onDblClick.bind(this);
    this.onKeyDown = this.onKeyDown.bind(this);

    this.state = {
      value: props.init,
      editing: false,
      width: null,
    };
  }

  componentDidMount() {
    window.addEventListener('click', this.onClickOut);
    window.addEventListener('touchend', this.onClickOut);
  }

  componentWillUnmount() {
    window.removeEventListener('click', this.onClickOut);
    window.removeEventListener('touchend', this.onClickOut);
  }

  /////////////////////////////////////////////////////////////////////////////

  componentDidUpdate(
    prevProps: Editable.Props,
    prevState: Editable.State,
  ) {
    this.updateWidth(prevState);
  }

  /*
   * commit the edited value when clicking outside its container
   */
  onClickOut(
    ev: React.MouseEvent | React.TouchEvent | MouseEvent | TouchEvent
  ) {
    if (ev.defaultPrevented) return;
    if ('button' in ev && ev.button !== 0) return;

    if (this.parent?.contains(ev.target as Node)) return;
    if (!this.state.editing) return;

    this.onSubmit();
  }

  /*
   * transition the element into edit mode
   */
  onDblClick(ev: React.MouseEvent | React.TouchEvent) {
    if (ev.defaultPrevented) return;
    if ('button' in ev && ev.button !== 0) return;

    if (this.state.editing) return;

    ev.preventDefault();
    this.setState({editing: true});
  }

  /*
   * capture ctrl-A and Enter behaviors on the edit input
   */
  onKeyDown(ev: React.KeyboardEvent) {
    if (ev.defaultPrevented) return;

    const metaKey = isMac() ? ev.metaKey : ev.ctrlKey;

    // enable other keydown handlers to prevent their behaviors if this was an
    // keydown captured by our text input during editing
    const native_ev = ev.nativeEvent;
    const ne = native_ev as (typeof native_ev & {editableCaptured: boolean});
    ne.editableCaptured = true;

    if (ev.key !== 'Enter') return;

    ev.preventDefault();
    this.onSubmit();
  }

  /*
   * update the width of the edit input and re-render
   *
   * we use a hidden, absolute-positioned element which just contains the input
   * value text to determine the appropriate size
   *
   * ref: https://github.com/JedWatson/react-input-autosize/blob/master/src/AutosizeInput.js
   */
  updateWidth(prevState: Editable.State) {
    const width = this.sizer?.scrollWidth;
    if (!width) return; // including if 0

    if (width !== prevState.width) {
      this.setState({width});
    }
  }

  /*
   * commit a value change
   */
  onSubmit() {
    this.setState((state, props) => {
      const value = props.onSubmit?.(state.value) ?? state.value;
      return {value, editing: false};
    });
  }

  /////////////////////////////////////////////////////////////////////////////

  render() {
    const className = this.props.className ?? 'editable';

    if (!this.state.editing) {
      return <div
        className={className}
        onDoubleClick={this.onDblClick}
      >
        {this.state.value}
      </div>;
    }

    return <div ref={node => this.parent = node}>
      <input
        className={`${className}-edit`}
        type="text"
        value={this.state.value}
        style={{width: this.state.width ?? "auto"}}
        onChange={ev => {
          const value = ev.target.value;
          this.setState((state, props) => ({
            value: this.props.onChange?.(value, state.value) ?? value
          }))
        }}
        onKeyDown={this.onKeyDown}
      />
      <div
        ref={node => this.sizer = node}
        className={`${className}-sizer`}
        style={{
          visibility: "hidden",
          whiteSpace: "pre",
          position: "absolute",
        }}
      >
        {this.state.value}
      </div>
    </div>;
  }
}

export namespace Editable {

export type Props = {
  init: string;
  // base class to apply to all elements; defaults to "editable"
  className?: string;
  // callback for edit events; returns the value to commit
  onChange?: (val: string, prev: string) => string;
  // callback for submit events; returns the value to commit
  onSubmit?: (val: string) => string;
};

export type State = {
  value: string;
  editing: boolean;
  width: null | number;
};

}
