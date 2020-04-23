import * as React from 'react'

// this exists because the svgs we have checked in are monstrous
// and we need to shove the math somewhere

// the svgs define a bounding box of
// x,y =  -132, -180
// width,height = 264,360
//
// but the card graphics sit at
// -119.5, -167.5
// with size
// 239, 335
// and corner radius 12
//
// this means the card is centered and there's 12.5 units of padding around it
// on all sides

const aspect_ratio = 239.0 / 335.0;

const card_to_bounding_box_x = 239.0 / 264.0;
const card_to_bounding_box_y = 335.0 / 360.0;

const padding_x_ratio = 12.5 / 264.0;
const padding_y_ratio = 12.5 / 360.0;

const border_radius_x_ratio = 12.0 / 239.0;

export type CardProps = {
  card: string;
  width: number;
  position: "absolute" | "fixed" | "relative";
  x: number;
  y: number;

  [more: string]: any;
};

export const Card = (props: CardProps) => {
  let {card, width, position, x, y, ...more} = props;

  let height = width / aspect_ratio;

  let svg_width = width / card_to_bounding_box_x;
  let svg_height = height / card_to_bounding_box_y;

  let padding_x = padding_x_ratio * svg_width;
  let padding_y = padding_y_ratio * svg_height;

  let border_radius = Math.ceil(border_radius_x_ratio * width + 1);

  let svg = "url(/static/svg/cards/" + card + ".svg)";

  return <div style={{
    position: props.position,
    top: y,
    left: x,
    width: width,
    height: height,
    backgroundImage: svg,
    backgroundPosition: "-" + padding_x + "px -" + padding_y + "px",
    backgroundSize: svg_width + "px " + svg_height + "px",
    borderRadius: border_radius + "px",
    boxShadow: "0px 1px 1px rgba(0, 0, 0, 0.4)",
    border: "solid black 1px",
  }}
    {...more}
  />
};
