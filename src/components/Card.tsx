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

export const aspect_ratio = 239.0 / 335.0;

const card_to_bounding_box_x = 239.0 / 264.0;
const card_to_bounding_box_y = 335.0 / 360.0;

const padding_x_ratio = 12.5 / 264.0;
const padding_y_ratio = 12.5 / 360.0;

const border_radius_x_ratio = 12.0 / 239.0;

const chain_background_image = (
  style: React.CSSProperties,
  prepend: string,
): React.CSSProperties => {
  return {
    backgroundImage: (('backgroundImage' in style)
      ? `${prepend}, ${style.backgroundImage}`
      : prepend),
  };
};

///////////////////////////////////////////////////////////////////////////////

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
  let {width, clip = 1, dim = null, style = {}, ...more} = props;

  if (clip < 0 || clip > 1) clip = 1;
  if (dim < 0 || dim > 1) dim = null;

  const height = width / aspect_ratio;

  const svg_width = width / card_to_bounding_box_x;
  const svg_height = height / card_to_bounding_box_y;

  const padding_x = padding_x_ratio * svg_width;
  const padding_y = padding_y_ratio * svg_height;

  const border_radius = Math.ceil(border_radius_x_ratio * width + 1);

  const background_image = dim !== null
    ? chain_background_image(
      style,
      `linear-gradient(rgba(0,0,0,${dim}), rgba(0,0,0,${dim}))`
    )
    : {};

  return <div
    style={{
      width: width * clip,
      height: height,
      paddingRight: width * (1 - clip),
      marginRight: -width * (1 - clip),
      backgroundPosition: "-" + padding_x + "px -" + padding_y + "px",
      backgroundSize: svg_width + "px " + svg_height + "px",
      borderRadius: border_radius + "px",
      boxShadow: "0px 1px 1px rgba(0, 0, 0, 0.4)",
      border: "solid black 1px",
      ...style,
      ...background_image,
    }}
    {...more}
  />
};

///////////////////////////////////////////////////////////////////////////////

export type CardProps = CardShapeProps & {
  // string of the form "c1", "sq", "d10", "ja", "jb", etc.
  card: string;
};

export const Card = (props: CardProps) => {
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
