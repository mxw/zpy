# TODO

## protocol & nav

- implement reconnects

- implement PlayArea onReset logic

- implement a homepage: specifically, a way to set your nickname and explicitly
  create games

## game engine

## game UI

- be smarter about when to remove cards from our hand following a `lead_play`.
  it's not safe to do so unconditionally, since it might be a failed flight.

- show "team point total" somewhere

- display errors... somewhere

## game style

## wishlist

- dynamically size the cards in ActionInfo

- add labels on the left or right for the different player column sections

- thread the state through all the onUpdate/onReject callbacks; it's not safe
  to use the one on the component, since it could be stale when the callback
  triggers (even though in practice it's necessarily the same state unless a
  reset occurred---which is definitely possible)
