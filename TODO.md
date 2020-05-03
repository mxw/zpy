# TODO

## public release

- implement a homepage

- show "team point total" somewhere

- support parts

- support adding/removing players between rounds

- reap dead games and clients

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

- does click-out of name-edit send over the socket?

- make sure that enter submits nick and not card

- undo state for "readying"?  or make it more obvious you need to bid?

- sort hand alternating colors

- indicate how many cards are in the kitty in instruction test

- fix bug where cards just suddenly reorder?  putting natural trumps before
  other trumps?

- highlight background for current player

- make it more obvious when it's your turn to draw?

- make it more clear when instruction test changes
