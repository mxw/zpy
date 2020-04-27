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

export const aspect_ratio = 239.0 / 335.0;

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

  const height = width / aspect_ratio;

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
      width: width * clip,
      height: height,
      paddingRight: width * (1 - clip),
      marginRight: -width * (1 - clip),
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
