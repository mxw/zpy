# TODO

## protocol & nav

- implement reconnects

- implement a homepage

## game engine

## game UI

- show "team point total" somewhere

## game style

## wishlist

- dynamically size the cards in ActionInfo

- add labels on the left or right for the different player column sections

- thread the state through all the onUpdate/onReject callbacks; it's not safe
  to use the one on the component, since it could be stale when the callback
  triggers (even though in practice it's necessarily the same state unless a
  reset occurred---which is definitely possible)
