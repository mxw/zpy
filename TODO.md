# TODO

## public release

- logging

- persistence?

## wishlist

- dynamically size the cards in ActionInfo

- add labels on the left or right for the different player column sections

- thread the state through all the onUpdate/onReject callbacks; it's not safe
  to use the one on the component, since it could be stale when the callback
  triggers (even though in practice it's necessarily the same state unless a
  reset occurred---which is definitely possible)

- support game persistence across server disruptions (serialize state to some
  database)

## notes

- undo state for "readying"?  or make it more obvious you need to bid?

- use `identity` instead of `me` for all checks in UI

- make clubs and spades more distinct

- trigger renege when someone fails to contest a fly
