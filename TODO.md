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

- undo state for "readying"?  or make it more obvious you need to bid?

- make it more clear when instruction test changes

- use `identity` instead of `me` for all checks in UI

- double-click cards to move them between areas

- if you have a fresh session with fresh cookies, join a game, change your
  name, it doesn't update, and if you refresh you get reinstantiated

- make clubs and spades more distinct

- highlight the "me" player

- disable current selector during KITTY phase

- sort your own trump bid rank first in free-for-all draws

- trigger renege when someone fails to contest a fly

- make team affiliations more obvious

- fix sorting of off-suit natural trumps together

- make help icon more obvious

- condense points space more

- limit nickname lengths
