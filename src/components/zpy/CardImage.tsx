/*
 * unopinionated, styleable box with a card in it
 *
 * this exists because the svgs we have checked in are monstrous and we need to
 * shove the math somewhere
 *
 * the svgs define a bounding box of
 *    x,y = -132, -180
 *    w,h = 264,360
 *
 * but the card graphics sit at
 *    x,y = -119.5, -167.5
 *    w,h = 239, 335
 * and corner radius 12
 *
 * this means the card is centered and there's 12.5 units of padding around it
 * on all sides
 */
import * as React from 'react'

import { strict as assert} from 'assert'


///////////////////////////////////////////////////////////////////////////////

const svg_card_width = 239.0;
const svg_card_height = 335.0;
const svg_bounding_box_width = 264.0;
const svg_bounding_box_height = 360.0;
const svg_padding = 12.5;
const svg_border_radius = 12.0;

const rem_per_px = 1.0 / 16.0;

export const aspect_ratio = svg_card_width / svg_card_height;

export type CardShapeProps = {
  // width of the whole card
  width: number;
  // fraction of the card (from the left edge) to set the div width to
  clip?: number; // in [0, 1]
  // amount of dimming to apply to the image
  dim?: number; // in [0, 1]

  style?: React.CSSProperties;
  [more: string]: any;
};

export const CardShape = (props: CardShapeProps) => {
  const {width, clip = 1, dim = null, style = {}, ...more} = props;
  assert(clip >= 0 && clip <= 1);
  assert(dim === null || (dim >= 0 && dim <= 1));

  // use rems for everything
  const w = width * rem_per_px;
  const h = w / aspect_ratio;

  const bg_w = w * svg_bounding_box_width  / svg_card_width;
  const bg_h = h * svg_bounding_box_height / svg_card_height;

  const bg_off_x = -w * svg_padding / svg_card_width;
  const bg_off_y = -h * svg_padding / svg_card_height;

  const border_radius = w * svg_border_radius / svg_card_width + rem_per_px;

  const background_image = (() => {
    if (dim === null) return {};

    let prefix = `linear-gradient(rgba(0,0,0,${dim}), rgba(0,0,0,${dim}))`;

    return {
      backgroundImage: ('backgroundImage' in style)
        ? `${prefix}, ${style.backgroundImage}`
        : prefix
    };
  })();

  return <div className="card"
    style={{
      width: `${w * clip}rem`,
      height: `${h}rem`,
      paddingRight: `${w * (1 - clip)}rem`,
      marginRight: `${-w * (1 - clip)}rem`,
      backgroundSize: `${bg_w}rem ${bg_h}rem`,
      backgroundPosition: `${bg_off_x}rem ${bg_off_y}rem`,
      borderRadius: `${border_radius}rem`,
      border: `solid black ${rem_per_px}rem`,
      boxShadow: `0px ${rem_per_px}rem ${rem_per_px}rem rgba(0, 0, 0, 0.4)`,
      ...style,
      ...background_image,
    }}
    {...more}
  />
};

///////////////////////////////////////////////////////////////////////////////

export type CardImageProps = CardShapeProps & {
  // string of the form "c1", "sq", "d10", "ja", "jb", etc.
  card: string;
};

export const CardImage = (props: CardImageProps) => {
  const {card, style, ...more} = props;

  const svg = "url(/static/svg/cards/" + card + ".svg)";

  return <CardShape
    style={{
      ...style,
      backgroundImage: svg,
    }}
    {...more}
  />
};
