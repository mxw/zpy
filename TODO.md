# TODO

## engine

- perform validation to detect when someone fails to contest a fly

## ui

- make clubs and spades more distinct

- dynamically size the cards in ActionInfo

- add labels on the left or right for the different player column sections

## tech debt

- use `identity` instead of `me` for all checks in UI

- use `who` instead of the first argument for ZPY methods

- thread the state through all the onUpdate/onReject callbacks; it's not safe
  to use the one on the component, since it could be stale when the callback
  triggers (even though in practice it's necessarily the same state unless a
  reset occurred---which is definitely possible)
