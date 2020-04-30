# TODO

## protocol & nav

- implement reconnects

- implement a homepage: specifically, a way to set your nickname and explicitly
  create games

## game UI

- stop assuming that PlayArea.State is always updated on phase change; the
  phase might, e.g., change to KITTY (e.g., due to a no-bid draw) and we may
  not have our 1-indexed area set up yet

- fix the bug where two CardArea's are rendered right after a replace_kitty

- implement a Reveal area for shared publicized information, like a revealed
  kitty or the cards used to contest a fly

- add an instructional text area just beneath the action area indicating what
  actions are possible in the current phase

- add tooltips to all icons and indicators (host crown, team symbol, current
  trick winner trophy, attempted fly question mark, trump indicator, friends
  indicator, points section, current player border)

- display errors... somewhere

## wishlist

- dynamically size the cards in ActionInfo

- add labels on the left or right for the different player column sections
