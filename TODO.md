# TODO

## protocol & nav

- implement reconnects

- implement a homepage: specifically, a way to set your nickname and explicitly
  create games

## game engine

- un-ready everybody if somebody bids trump during the PREPARE phase

## game UI

- fix CardArea issues:
  - when we get an update that isn't a response to a player-initiated action,
    we sometimes need to rejigger the card areas (e.g., when we are given a
    kitty due to a no-bid draw, or when we are put into CONTEST_FLY)
  - currently, two CardArea's are rendered for the host right after a
    `replace_kitty` is sent

- implement a Reveal area for shared publicized information, like a revealed
  kitty or the cards used to contest a fly

- implement a "reset" shortcut for putting everything back into the hand, and
  auto-apply it for bids during the "ready" phase

- add tooltips to all icons and indicators (host crown, team symbol, current
  trick winner trophy, attempted fly question mark, trump indicator, friends
  indicator, points section, current player border)

- add team indicators and show "team point total" somewhere

- display errors... somewhere

## game style

- fix the host crown offset bug that happens when the host infobox has the
  current player border

## wishlist

- dynamically size the cards in ActionInfo

- add labels on the left or right for the different player column sections
